import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { appointmentReminders, clients } from "../../../../db/schema";
import { hasActiveAccess } from "../../../access";

const MIN_HOURS_BEFORE = 24;
const MAX_HOURS_BEFORE = 72;

function safeEqual(received: string, expected: string) {
  if (received.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < received.length; index += 1) {
    difference |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

async function sendWhatsAppReminder(client: {
  whatsapp: string;
  name: string;
  nextAppointmentAt: string;
}) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_RETURN_TEMPLATE_NAME;
  if (!accessToken || !phoneNumberId || !templateName || !client.whatsapp) {
    return { status: "not_configured" as const };
  }

  const appointment = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(client.nextAppointmentAt));
  const firstName = client.name.trim().split(/\s+/)[0] || "Paciente";
  const confirmationText = encodeURIComponent(
    `Olá, Ludgero! Sou ${client.name}. Confirmo meu retorno agendado para ${appointment}.`,
  );
  const recipient = client.whatsapp.replace(/\D/g, "");
  const response = await fetch(
    `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to:
          recipient.length >= 12 || recipient.startsWith("55")
            ? recipient
            : `55${recipient}`,
        type: "template",
        template: {
          name: templateName,
          language: { code: "pt_BR" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: firstName },
                { type: "text", text: appointment },
              ],
            },
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: confirmationText }],
            },
          ],
        },
      }),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as {
    messages?: Array<{ id?: string }>;
  };
  if (!response.ok) {
    return { status: "failed" as const };
  }
  return {
    status: "sent" as const,
    id: payload.messages?.[0]?.id || null,
  };
}

export async function POST(request: Request) {
  const suppliedSecret = request.headers.get("x-checkin-reminder-secret") || "";
  const expectedSecret = env.CHECKIN_REMINDER_SECRET || "";
  if (!expectedSecret || !safeEqual(suppliedSecret, expectedSecret)) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  const db = getDb();
  const now = new Date();
  const allClients = await db.select().from(clients);
  const dueClients = allClients.filter((client) => {
    if (
      client.modality !== "in_person" ||
      !client.nextAppointmentAt ||
      !client.profileCompletedAt ||
      !hasActiveAccess(client)
    ) {
      return false;
    }
    const hours =
      (new Date(client.nextAppointmentAt).getTime() - now.getTime()) / 3_600_000;
    return hours >= MIN_HOURS_BEFORE && hours <= MAX_HOURS_BEFORE;
  });
  const results: Array<{
    email: string;
    status: "sent" | "skipped" | "failed";
    whatsapp?: string;
    error?: string;
  }> = [];

  for (const client of dueClients) {
    const appointmentAt = client.nextAppointmentAt!;
    const [existing] = await db
      .select()
      .from(appointmentReminders)
      .where(
        and(
          eq(appointmentReminders.clientEmail, client.email),
          eq(appointmentReminders.appointmentAt, appointmentAt),
        ),
      )
      .limit(1);
    if (existing?.status === "sent") {
      results.push({ email: client.email, status: "skipped" });
      continue;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/appointment-reminder-email`,
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
            whatsapp: client.whatsapp,
            appointmentAt,
            location: client.appointmentLocation || "Guarapuava — PR",
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        patientId?: string;
        adminId?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "O envio foi recusado.");

      const whatsapp = await sendWhatsAppReminder({
        whatsapp: client.whatsapp,
        name: client.name,
        nextAppointmentAt: appointmentAt,
      });
      const sentAt = new Date().toISOString();
      await db
        .insert(appointmentReminders)
        .values({
          clientEmail: client.email,
          appointmentAt,
          status: "sent",
          patientProviderId: payload.patientId || null,
          adminProviderId: payload.adminId || null,
          whatsappStatus: whatsapp.status,
          whatsappProviderId: whatsapp.id || null,
          sentAt,
          updatedAt: sentAt,
        })
        .onConflictDoUpdate({
          target: [
            appointmentReminders.clientEmail,
            appointmentReminders.appointmentAt,
          ],
          set: {
            status: "sent",
            patientProviderId: payload.patientId || null,
            adminProviderId: payload.adminId || null,
            whatsappStatus: whatsapp.status,
            whatsappProviderId: whatsapp.id || null,
            error: null,
            sentAt,
            updatedAt: sentAt,
          },
        });
      results.push({
        email: client.email,
        status: "sent",
        whatsapp: whatsapp.status,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 500) : "Falha desconhecida.";
      const updatedAt = new Date().toISOString();
      await db
        .insert(appointmentReminders)
        .values({
          clientEmail: client.email,
          appointmentAt,
          status: "failed",
          error: message,
          updatedAt,
        })
        .onConflictDoUpdate({
          target: [
            appointmentReminders.clientEmail,
            appointmentReminders.appointmentAt,
          ],
          set: { status: "failed", error: message, updatedAt },
        });
      results.push({ email: client.email, status: "failed", error: message });
    }
  }

  return Response.json({
    ok: true,
    checkedAt: now.toISOString(),
    duePatients: dueClients.length,
    sent: results.filter((result) => result.status === "sent").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  });
}
