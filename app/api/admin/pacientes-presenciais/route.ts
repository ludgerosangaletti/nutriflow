import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import {
  appointmentChangeRequests,
  clients,
  patientActivationMessages,
} from "../../../../db/schema";
import { calculateAccessPeriod } from "../../../access";
import { getAdminSession } from "../../../supabase/server";
import {
  formatAppointment,
  normalizeBrazilPhone,
} from "../../../appointment-scheduling";
import {
  deletePatientCalendarEvent,
  getGoogleCalendarSettings,
  googleCalendarHasConflict,
  upsertPatientCalendarEvent,
} from "../../../google-calendar";
import { sendActivationWhatsApp } from "../../../whatsapp-activation";
import { resolveNutriFlowAdminContext } from "../../../nutriflow/server";

const allowedPlans = ["mensal", "trimestral", "semestral"];

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function notifyPatientDecision(
  whatsapp: string,
  message: string,
) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId || !whatsapp) return false;
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
        to: normalizeBrazilPhone(whatsapp),
        type: "text",
        text: { body: message },
      }),
    },
  );
  return response.ok;
}

async function sendInvite(
  token: string,
  payload: { email: string; resend?: boolean },
) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invite-in-person-patient`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  const result = (await response.json().catch(() => ({}))) as {
    error?: string;
    id?: string;
    activationPath?: string;
  };
  if (!response.ok) throw new Error(result.error || "Falha ao enviar o convite.");
  if (!result.id) {
    throw new Error(
      "O provedor de e-mail não confirmou o envio. Tente novamente em instantes.",
    );
  }
  if (!result.activationPath) {
    throw new Error("O provedor não devolveu um link de ativação seguro.");
  }
  return result;
}

async function deliverActivationWhatsApp(input: {
  email: string;
  name: string;
  whatsapp: string;
  activationPath: string;
  kind: "initial" | "manual_resend";
}) {
  const db = getDb();
  const now = new Date().toISOString();
  const deliveryKey =
    input.kind === "initial"
      ? `activation:initial:${input.email}`
      : `activation:manual:${input.email}:${now}`;
  const result = await sendActivationWhatsApp({
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    templateName: process.env.WHATSAPP_ACTIVATION_TEMPLATE_NAME,
    recipient: input.whatsapp,
    patientName: input.name,
    activationPath: input.activationPath,
  });
  await db.insert(patientActivationMessages).values({
    clientEmail: input.email,
    deliveryKey,
    kind: input.kind,
    status: result.status,
    providerId: result.providerId || null,
    attemptCount: 1,
    error: result.error || null,
    sentAt: result.status === "sent" ? now : null,
    createdAt: now,
    updatedAt: now,
  });
  return result;
}

export async function POST(request: Request) {
  const admin = await getAdminSession();
  const nutriFlowContext = admin ? await resolveNutriFlowAdminContext(admin.id) : null;
  if (!nutriFlowContext) return Response.json({ error: "OrganizaÃ§Ã£o nÃ£o autorizada." }, { status: 403 });
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    whatsapp?: string;
    whatsappOptIn?: boolean;
    plan?: string;
    startsAt?: string;
    nextAppointmentAt?: string;
    appointmentLocation?: string;
    requestId?: number;
  };
  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim().replace(/\s+/g, " ").slice(0, 160);
  const whatsapp = normalizeBrazilPhone(String(body.whatsapp || ""));
  const plan = String(body.plan || "");
  const startsAt = new Date(String(body.startsAt || ""));
  const nextAppointmentAt = String(body.nextAppointmentAt || "").trim();
  const appointmentLocation = String(body.appointmentLocation || "")
    .trim()
    .slice(0, 180);

  if (
    !validEmail(email) || name.length < 3 ||
    !/^55\d{10,11}$/.test(whatsapp) ||
    body.whatsappOptIn !== true ||
    !allowedPlans.includes(plan) ||
    Number.isNaN(startsAt.getTime())
  ) {
    return Response.json({ error: "Preencha os dados obrigatórios." }, { status: 400 });
  }
  if (nextAppointmentAt && Number.isNaN(new Date(nextAppointmentAt).getTime())) {
    return Response.json({ error: "Data da próxima consulta inválida." }, { status: 400 });
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(clients)
    .where(eq(clients.email, email))
    .limit(1);
  if (existing) {
    return Response.json(
      { error: "Já existe um paciente cadastrado com este e-mail." },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const access = calculateAccessPeriod(plan, startsAt);
  await db.insert(clients).values({
    organizationId: nutriFlowContext.organizationId,
    email,
    name,
    whatsapp,
    whatsappActivationOptInAt: now,
    modality: "in_person",
    plan,
    paymentStatus: "approved",
    accessStartedAt: access.startedAt,
    accessExpiresAt: access.expiresAt,
    nextAppointmentAt: nextAppointmentAt
      ? new Date(nextAppointmentAt).toISOString()
      : null,
    appointmentLocation: appointmentLocation || "Guarapuava — PR",
    inviteStatus: "sending",
    createdAt: now,
    updatedAt: now,
  });

  try {
    const result = await sendInvite(admin.session.access_token, { email });
    const whatsappResult = await deliverActivationWhatsApp({
      email,
      name,
      whatsapp,
      activationPath: result.activationPath!,
      kind: "initial",
    });
    await db
      .update(clients)
      .set({
        inviteStatus: "sent",
        inviteSentAt: now,
        inviteError: null,
        updatedAt: now,
      })
      .where(eq(clients.email, email));
    return Response.json({
      ok: true,
      warning:
        whatsappResult.status === "sent"
          ? undefined
          : "O prontuário e o convite por e-mail foram criados. O WhatsApp de ativação ainda não foi entregue.",
      patient: {
        email,
        anamnesisUrl: `/admin/clientes/${encodeURIComponent(email)}/anamnese`,
      },
      invite: {
        sent: true,
        id: result.id,
        whatsapp: whatsappResult.status,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 300) : "Falha desconhecida.";
    await db
      .update(clients)
      .set({ inviteStatus: "failed", inviteError: message, updatedAt: now })
      .where(eq(clients.email, email));
    return Response.json({
      ok: true,
      warning: `Cadastro criado, mas o convite não foi enviado: ${message}`,
      patient: { email, anamnesisUrl: `/admin/clientes/${encodeURIComponent(email)}/anamnese` },
      invite: { sent: false },
    }, { status: 201 });
  }
}

export async function PATCH(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    action?: string;
    plan?: string;
    startsAt?: string;
    nextAppointmentAt?: string | null;
    appointmentLocation?: string;
  };
  const email = String(body.email || "").trim().toLowerCase();
  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.email, email))
    .limit(1);
  if (!client || client.modality !== "in_person") {
    return Response.json({ error: "Paciente presencial não encontrado." }, { status: 404 });
  }
  const now = new Date().toISOString();

  if (body.action === "resend_invite") {
    try {
      const result = await sendInvite(admin.session.access_token, {
        email,
        resend: true,
      });
      const whatsappResult = client.whatsappActivationOptInAt
        ? await deliverActivationWhatsApp({
            email,
            name: client.name,
            whatsapp: client.whatsapp,
            activationPath: result.activationPath!,
            kind: "manual_resend",
          })
        : { status: "not_authorized" as const };
      await db
        .update(clients)
        .set({
          inviteStatus: "sent",
          inviteSentAt: now,
          inviteError: null,
          updatedAt: now,
        })
        .where(eq(clients.email, email));
      return Response.json({
        ok: true,
        invite: {
          sent: true,
          id: result.id,
          whatsapp: whatsappResult.status,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 300) : "Falha desconhecida.";
      await db
        .update(clients)
        .set({ inviteStatus: "failed", inviteError: message, updatedAt: now })
        .where(eq(clients.email, email));
      return Response.json({ error: message }, { status: 502 });
    }
  }

  if (body.action === "end_access") {
    await db
      .update(clients)
      .set({ accessExpiresAt: now, updatedAt: now })
      .where(eq(clients.email, email));
    return Response.json({ ok: true });
  }

  if (
    body.action === "approve_appointment_request" ||
    body.action === "reject_appointment_request"
  ) {
    const requestId = Number(body.requestId);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      return Response.json({ error: "Solicitação inválida." }, { status: 400 });
    }
    const [changeRequest] = await db
      .select()
      .from(appointmentChangeRequests)
      .where(eq(appointmentChangeRequests.id, requestId))
      .limit(1);
    if (
      !changeRequest ||
      changeRequest.clientEmail !== client.email ||
      changeRequest.status !== "pending"
    ) {
      return Response.json(
        { error: "Solicitação pendente não encontrada." },
        { status: 404 },
      );
    }
    const approved = body.action === "approve_appointment_request";
    if (
      approved &&
      changeRequest.action === "reschedule" &&
      changeRequest.requestedAppointmentAt
    ) {
      const occupied = await db.select().from(clients);
      const conflict = occupied.some(
        (item) =>
          item.email !== client.email &&
          item.nextAppointmentAt &&
          Math.abs(
            new Date(item.nextAppointmentAt).getTime() -
              new Date(changeRequest.requestedAppointmentAt!).getTime(),
          ) < 3_600_000,
      );
      if (conflict) {
        return Response.json(
          { error: "O horário foi ocupado por outro paciente." },
          { status: 409 },
        );
      }
      const googleSettings = await getGoogleCalendarSettings();
      if (
        googleSettings?.status === "connected" &&
        (await googleCalendarHasConflict(
          changeRequest.requestedAppointmentAt,
          client.googleCalendarEventId,
        ))
      ) {
        return Response.json(
          { error: "O horário foi ocupado no Google Agenda." },
          { status: 409 },
        );
      }
    }
    if (approved) {
      const googleSettings = await getGoogleCalendarSettings();
      if (googleSettings?.status === "connected") {
        try {
          if (changeRequest.action === "cancel") {
            await deletePatientCalendarEvent(client.googleCalendarEventId);
          } else if (changeRequest.requestedAppointmentAt) {
            await upsertPatientCalendarEvent({
              email: client.email,
              name: client.name,
              appointmentAt: changeRequest.requestedAppointmentAt,
              existingEventId: client.googleCalendarEventId,
            });
          }
        } catch (error) {
          return Response.json(
            {
              error:
                error instanceof Error
                  ? `O Google Agenda recusou a alteração: ${error.message}`
                  : "O Google Agenda recusou a alteração.",
            },
            { status: 502 },
          );
        }
      }
    }
    await db
      .update(appointmentChangeRequests)
      .set({
        status: approved ? "approved" : "rejected",
        resolvedAt: now,
        updatedAt: now,
      })
      .where(eq(appointmentChangeRequests.id, requestId));
    if (approved) {
      await db
        .update(clients)
        .set({
          nextAppointmentAt:
            changeRequest.action === "cancel"
              ? null
              : changeRequest.requestedAppointmentAt,
          appointmentStatus:
            changeRequest.action === "cancel" ? "cancelled" : "scheduled",
          appointmentConfirmedAt: null,
          appointmentConfirmationSource: null,
          updatedAt: now,
        })
        .where(eq(clients.email, client.email));
    } else {
      await db
        .update(clients)
        .set({ appointmentStatus: "scheduled", updatedAt: now })
        .where(eq(clients.email, client.email));
    }
    const decisionMessage = approved
      ? changeRequest.action === "cancel"
        ? "Seu cancelamento foi aprovado pelo Ludgero. Quando desejar reagendar, entre em contato pelo chatbot."
        : `Sua remarcação foi aprovada ✅\n\nNovo retorno: *${formatAppointment(changeRequest.requestedAppointmentAt!)}*.`
      : "Sua solicitação de alteração não foi aprovada. O horário original permanece reservado. Se precisar, entre em contato para alinhar diretamente.";
    const patientNotified = await notifyPatientDecision(
      client.whatsapp,
      decisionMessage,
    ).catch(() => false);
    return Response.json({
      ok: true,
      message: approved
        ? `Solicitação aprovada.${patientNotified ? " Paciente avisado no WhatsApp." : " O aviso pelo WhatsApp não foi entregue; faça o contato manual."}`
        : `Solicitação recusada.${patientNotified ? " Paciente avisado no WhatsApp." : " O aviso pelo WhatsApp não foi entregue; faça o contato manual."}`,
    });
  }

  if (body.action === "update_care") {
    const plan = String(body.plan || "");
    const startsAt = new Date(String(body.startsAt || ""));
    if (!allowedPlans.includes(plan) || Number.isNaN(startsAt.getTime())) {
      return Response.json({ error: "Plano ou vigência inválidos." }, { status: 400 });
    }
    const access = calculateAccessPeriod(plan, startsAt);
    const nextAppointmentAt = body.nextAppointmentAt
      ? new Date(body.nextAppointmentAt)
      : null;
    if (nextAppointmentAt && Number.isNaN(nextAppointmentAt.getTime())) {
      return Response.json({ error: "Data da próxima consulta inválida." }, { status: 400 });
    }
    const appointmentChanged =
      nextAppointmentAt?.toISOString() !== client.nextAppointmentAt;
    const googleSettings = await getGoogleCalendarSettings();
    let syncedGoogleEventId = client.googleCalendarEventId;
    if (
      appointmentChanged &&
      nextAppointmentAt &&
      googleSettings?.status === "connected"
    ) {
      if (
        await googleCalendarHasConflict(
          nextAppointmentAt.toISOString(),
          client.googleCalendarEventId,
        )
      ) {
        return Response.json(
          { error: "Esse horário já está ocupado no Google Agenda." },
          { status: 409 },
        );
      }
      syncedGoogleEventId = await upsertPatientCalendarEvent({
        email: client.email,
        name: client.name,
        appointmentAt: nextAppointmentAt.toISOString(),
        existingEventId: client.googleCalendarEventId,
      });
    } else if (
      appointmentChanged &&
      !nextAppointmentAt &&
      googleSettings?.status === "connected"
    ) {
      await deletePatientCalendarEvent(client.googleCalendarEventId);
      syncedGoogleEventId = null;
    }
    await db
      .update(clients)
      .set({
        plan,
        accessStartedAt: access.startedAt,
        accessExpiresAt: access.expiresAt,
        nextAppointmentAt: nextAppointmentAt?.toISOString() || null,
        appointmentStatus:
          nextAppointmentAt?.toISOString() === client.nextAppointmentAt
            ? client.appointmentStatus
            : nextAppointmentAt
              ? "scheduled"
              : "not_scheduled",
        appointmentConfirmedAt:
          nextAppointmentAt?.toISOString() === client.nextAppointmentAt
            ? client.appointmentConfirmedAt
            : null,
        appointmentConfirmationSource:
          nextAppointmentAt?.toISOString() === client.nextAppointmentAt
            ? client.appointmentConfirmationSource
            : null,
        appointmentLocation:
          String(body.appointmentLocation || "").trim().slice(0, 180) ||
          client.appointmentLocation,
        googleCalendarEventId: nextAppointmentAt ? syncedGoogleEventId : null,
        googleCalendarSyncedAt:
          appointmentChanged && googleSettings?.status === "connected"
            ? now
            : client.googleCalendarSyncedAt,
        updatedAt: now,
      })
      .where(eq(clients.email, email));
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Ação inválida." }, { status: 400 });
}
