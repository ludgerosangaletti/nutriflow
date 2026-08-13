import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { clients, patientActivationMessages } from "../../../../db/schema";
import { sendActivationWhatsApp } from "../../../whatsapp-activation";

const REMINDER_AFTER_HOURS = 24;
const RETRY_AFTER_HOURS = 6;
const MAX_FAILED_ATTEMPTS = 3;

function safeEqual(received: string, expected: string) {
  if (received.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < received.length; index += 1) {
    difference |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

async function freshActivationPath(email: string, secret: string) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invite-in-person-patient`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`,
        "content-type": "application/json",
        "x-checkin-reminder-secret": secret,
      },
      body: JSON.stringify({ email, systemReminder: true }),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as {
    activationPath?: string;
    error?: string;
  };
  if (!response.ok || !payload.activationPath) {
    throw new Error(payload.error || "Não foi possível gerar um novo link seguro.");
  }
  return payload.activationPath;
}

export async function POST(request: Request) {
  const suppliedSecret = request.headers.get("x-checkin-reminder-secret") || "";
  const expectedSecret = env.CHECKIN_REMINDER_SECRET || "";
  if (!expectedSecret || !safeEqual(suppliedSecret, expectedSecret)) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  const db = getDb();
  const now = new Date();
  const nowIso = now.toISOString();
  const allClients = await db.select().from(clients);
  const dueClients = allClients.filter((client) => {
    if (
      client.modality !== "in_person" ||
      client.profileCompletedAt ||
      !client.whatsappActivationOptInAt ||
      !client.whatsapp ||
      !client.inviteSentAt ||
      !["sent", "accepted"].includes(client.inviteStatus)
    ) {
      return false;
    }
    const hoursSinceInvite =
      (now.getTime() - new Date(client.inviteSentAt).getTime()) / 3_600_000;
    return hoursSinceInvite >= REMINDER_AFTER_HOURS;
  });
  const results: Array<{
    email: string;
    status: "accepted" | "skipped" | "failed" | "not_configured";
    error?: string;
  }> = [];

  for (const client of dueClients) {
    const deliveryKey = `activation:reminder-24h:${client.email}`;
    const [existing] = await db
      .select()
      .from(patientActivationMessages)
      .where(eq(patientActivationMessages.deliveryKey, deliveryKey))
      .limit(1);
    const hoursSinceAttempt = existing
      ? (now.getTime() - new Date(existing.updatedAt).getTime()) / 3_600_000
      : Infinity;
    if (
      ["accepted", "sent", "delivered", "read"].includes(existing?.status || "") ||
      (existing && hoursSinceAttempt < RETRY_AFTER_HOURS) ||
      (existing?.attemptCount || 0) >= MAX_FAILED_ATTEMPTS
    ) {
      results.push({ email: client.email, status: "skipped" });
      continue;
    }

    try {
      const activationPath = await freshActivationPath(client.email, expectedSecret);
      const delivery = await sendActivationWhatsApp({
        accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
        templateName: process.env.WHATSAPP_ACTIVATION_TEMPLATE_NAME,
        recipient: client.whatsapp,
        patientName: client.name,
        activationPath,
      });
      const attemptCount =
        delivery.status === "not_configured"
          ? existing?.attemptCount || 0
          : (existing?.attemptCount || 0) + 1;
      await db
        .insert(patientActivationMessages)
        .values({
          clientEmail: client.email,
          deliveryKey,
          kind: "automatic_reminder_24h",
          status: delivery.status,
          providerId: delivery.providerId || null,
          attemptCount,
          error: delivery.error || null,
          sentAt: null,
          createdAt: nowIso,
          updatedAt: nowIso,
        })
        .onConflictDoUpdate({
          target: patientActivationMessages.deliveryKey,
          set: {
            status: delivery.status,
            providerId: delivery.providerId || null,
            attemptCount,
            error: delivery.error || null,
            sentAt: null,
            updatedAt: nowIso,
          },
        });
      results.push({
        email: client.email,
        status: delivery.status,
        error: delivery.error || undefined,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 500) : "Falha desconhecida.";
      const attemptCount = (existing?.attemptCount || 0) + 1;
      await db
        .insert(patientActivationMessages)
        .values({
          clientEmail: client.email,
          deliveryKey,
          kind: "automatic_reminder_24h",
          status: "failed",
          attemptCount,
          error: message,
          createdAt: nowIso,
          updatedAt: nowIso,
        })
        .onConflictDoUpdate({
          target: patientActivationMessages.deliveryKey,
          set: { status: "failed", attemptCount, error: message, updatedAt: nowIso },
        });
      results.push({ email: client.email, status: "failed", error: message });
    }
  }

  return Response.json({
    ok: true,
    checkedAt: nowIso,
    duePatients: dueClients.length,
    accepted: results.filter((result) => result.status === "accepted").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    failed: results.filter((result) => result.status === "failed").length,
    notConfigured: results.filter((result) => result.status === "not_configured").length,
    results,
  });
}
