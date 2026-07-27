import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { clients, renewalReminders } from "../../../../db/schema";
import { daysRemaining, hasActiveAccess } from "../../../access";
import { isPlanId, plans } from "../../../plans";

const reminderDays = new Set([7, 3, 1]);

function safeEqual(received: string, expected: string) {
  if (received.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < received.length; index += 1) {
    difference |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export async function POST(request: Request) {
  const suppliedSecret = request.headers.get("x-checkin-reminder-secret") || "";
  const expectedSecret = env.CHECKIN_REMINDER_SECRET || "";
  if (!expectedSecret || !safeEqual(suppliedSecret, expectedSecret)) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  const db = getDb();
  const allClients = await db.select().from(clients);
  const dueClients = allClients
    .filter(hasActiveAccess)
    .flatMap((client) => {
      if (!client.accessExpiresAt) return [];
      const days = daysRemaining(client.accessExpiresAt);
      return reminderDays.has(days) ? [{ client, days }] : [];
    });
  const results: Array<{
    email: string;
    days: number;
    status: "sent" | "skipped" | "failed";
    error?: string;
  }> = [];

  for (const { client, days } of dueClients) {
    const [existing] = await db
      .select()
      .from(renewalReminders)
      .where(
        and(
          eq(renewalReminders.clientEmail, client.email),
          eq(renewalReminders.accessExpiresAt, client.accessExpiresAt!),
          eq(renewalReminders.daysBefore, days),
        ),
      )
      .limit(1);
    if (existing?.status === "sent") {
      results.push({ email: client.email, days, status: "skipped" });
      continue;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/renewal-reminder-email`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`,
            "content-type": "application/json",
            "x-checkin-reminder-secret": expectedSecret,
          },
          body: JSON.stringify({
            email: client.email,
            name: client.name,
            plan: isPlanId(client.plan) ? plans[client.plan].name : client.plan,
            daysRemaining: days,
            expiresAt: client.accessExpiresAt,
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "O envio foi recusado.");

      const now = new Date().toISOString();
      await db
        .insert(renewalReminders)
        .values({
          clientEmail: client.email,
          accessExpiresAt: client.accessExpiresAt!,
          daysBefore: days,
          status: "sent",
          providerId: payload.id || null,
          sentAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            renewalReminders.clientEmail,
            renewalReminders.accessExpiresAt,
            renewalReminders.daysBefore,
          ],
          set: {
            status: "sent",
            providerId: payload.id || null,
            error: null,
            sentAt: now,
            updatedAt: now,
          },
        });
      results.push({ email: client.email, days, status: "sent" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha desconhecida.";
      const now = new Date().toISOString();
      await db
        .insert(renewalReminders)
        .values({
          clientEmail: client.email,
          accessExpiresAt: client.accessExpiresAt!,
          daysBefore: days,
          status: "failed",
          error: message,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            renewalReminders.clientEmail,
            renewalReminders.accessExpiresAt,
            renewalReminders.daysBefore,
          ],
          set: { status: "failed", error: message, updatedAt: now },
        });
      results.push({
        email: client.email,
        days,
        status: "failed",
        error: message,
      });
    }
  }

  return Response.json({
    ok: true,
    eligible: dueClients.length,
    sent: results.filter((result) => result.status === "sent").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    failed: results.filter((result) => result.status === "failed").length,
  });
}
