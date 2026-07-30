import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { clients } from "../../../../db/schema";
import { calculateAccessPeriod } from "../../../access";
import { getAdminSession } from "../../../supabase/server";

const allowedPlans = ["mensal", "trimestral", "semestral"];

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
  };
  if (!response.ok) throw new Error(result.error || "Falha ao enviar o convite.");
  if (!result.id) {
    throw new Error(
      "O provedor de e-mail não confirmou o envio. Tente novamente em instantes.",
    );
  }
  return result;
}

export async function POST(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    plan?: string;
    startsAt?: string;
    nextAppointmentAt?: string;
    appointmentLocation?: string;
  };
  const email = String(body.email || "").trim().toLowerCase();
  const plan = String(body.plan || "");
  const startsAt = new Date(String(body.startsAt || ""));
  const nextAppointmentAt = String(body.nextAppointmentAt || "").trim();
  const appointmentLocation = String(body.appointmentLocation || "")
    .trim()
    .slice(0, 180);

  if (
    !validEmail(email) ||
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
    email,
    name: "Convite pendente",
    whatsapp: "",
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
    await db
      .update(clients)
      .set({
        inviteStatus: "sent",
        inviteSentAt: now,
        inviteError: null,
        updatedAt: now,
      })
      .where(eq(clients.email, email));
    return Response.json({ ok: true, invite: { sent: true, id: result.id } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 300) : "Falha desconhecida.";
    await db
      .update(clients)
      .set({ inviteStatus: "failed", inviteError: message, updatedAt: now })
      .where(eq(clients.email, email));
    return Response.json(
      { error: `Cadastro criado, mas o convite não foi enviado: ${message}` },
      { status: 502 },
    );
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
      await db
        .update(clients)
        .set({
          inviteStatus: "sent",
          inviteSentAt: now,
          inviteError: null,
          updatedAt: now,
        })
        .where(eq(clients.email, email));
      return Response.json({ ok: true, invite: { sent: true, id: result.id } });
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
    await db
      .update(clients)
      .set({
        plan,
        accessStartedAt: access.startedAt,
        accessExpiresAt: access.expiresAt,
        nextAppointmentAt: nextAppointmentAt?.toISOString() || null,
        appointmentLocation:
          String(body.appointmentLocation || "").trim().slice(0, 180) ||
          client.appointmentLocation,
        updatedAt: now,
      })
      .where(eq(clients.email, email));
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Ação inválida." }, { status: 400 });
}
