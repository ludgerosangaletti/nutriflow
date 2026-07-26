import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { checkInReminders, checkIns, clients } from "../../../../db/schema";
import { hasActiveAccess } from "../../../access";

function currentWeekStart() {
  const now = new Date();
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() - day + 1);
  return utc.toISOString().slice(0, 10);
}

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
  const weekStart = currentWeekStart();
  const allClients = await db.select().from(clients);
  const activeClients = allClients.filter(hasActiveAccess);
  const results: Array<{ email: string; status: "sent" | "skipped" | "failed"; error?: string }> = [];

  for (const client of activeClients) {
    const [completed] = await db
      .select({ id: checkIns.id })
      .from(checkIns)
      .where(and(eq(checkIns.clientEmail, client.email), eq(checkIns.weekStart, weekStart)))
      .limit(1);
    if (completed) {
      results.push({ email: client.email, status: "skipped" });
      continue;
    }

    const [existing] = await db
      .select()
      .from(checkInReminders)
      .where(and(eq(checkInReminders.clientEmail, client.email), eq(checkInReminders.weekStart, weekStart)))
      .limit(1);
    if (existing?.status === "sent") {
      results.push({ email: client.email, status: "skipped" });
      continue;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/check-in-reminder-email`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`,
            "content-type": "application/json",
            "x-checkin-reminder-secret": expectedSecret,
          },
          body: JSON.stringify({ email: client.email, name: client.name }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "O envio foi recusado.");

      const now = new Date().toISOString();
      await db
        .insert(checkInReminders)
        .values({
          clientEmail: client.email,
          weekStart,
          status: "sent",
          providerId: payload.id || null,
          sentAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [checkInReminders.clientEmail, checkInReminders.weekStart],
          set: {
            status: "sent",
            providerId: payload.id || null,
            error: null,
            sentAt: now,
            updatedAt: now,
          },
        });
      results.push({ email: client.email, status: "sent" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida.";
      const now = new Date().toISOString();
      await db
        .insert(checkInReminders)
        .values({
          clientEmail: client.email,
          weekStart,
          status: "failed",
          error: message,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [checkInReminders.clientEmail, checkInReminders.weekStart],
          set: { status: "failed", error: message, updatedAt: now },
        });
      results.push({ email: client.email, status: "failed", error: message });
    }
  }

  return Response.json({
    ok: true,
    weekStart,
    activePatients: activeClients.length,
    sent: results.filter((result) => result.status === "sent").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    failed: results.filter((result) => result.status === "failed").length,
  });
}
