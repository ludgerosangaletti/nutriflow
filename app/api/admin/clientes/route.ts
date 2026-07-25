import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { clients } from "../../../../db/schema";
import { calculateAccessPeriod } from "../../../access";
import { getAdminSession } from "../../../supabase/server";

export async function PATCH(request: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return Response.json({ error: "Não autorizado." }, { status: 403 });
  }

  const payload = (await request.json()) as {
    email?: string;
    paymentStatus?: string;
    renew?: boolean;
  };
  if (
    !payload.email ||
    !["pending", "approved"].includes(payload.paymentStatus ?? "")
  ) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.email, payload.email))
    .limit(1);

  if (!client) {
    return Response.json({ error: "Paciente não encontrado." }, { status: 404 });
  }

  const shouldSendEmail =
    payload.paymentStatus === "approved" &&
    client.paymentStatus !== "approved" &&
    !client.approvalEmailSentAt;
  const now = new Date().toISOString();
  const startsNewPeriod =
    payload.paymentStatus === "approved" &&
    (payload.renew ||
      client.paymentStatus !== "approved" ||
      !client.accessExpiresAt);
  const accessPeriod = startsNewPeriod
    ? calculateAccessPeriod(client.plan, new Date(now))
    : null;

  await db
    .update(clients)
    .set({
      paymentStatus: payload.paymentStatus,
      approvalEmailStatus: shouldSendEmail
        ? "sending"
        : client.approvalEmailStatus,
      approvalEmailError: shouldSendEmail ? null : client.approvalEmailError,
      accessStartedAt: accessPeriod?.startedAt ?? client.accessStartedAt,
      accessExpiresAt: accessPeriod?.expiresAt ?? client.accessExpiresAt,
      updatedAt: now,
    })
    .where(eq(clients.email, payload.email));

  if (!shouldSendEmail) {
    return Response.json({
      ok: true,
      email: {
        sent: false,
        skipped: true,
        reason: client.approvalEmailSentAt
          ? "O aviso já havia sido enviado."
          : "Nenhum novo aviso era necessário.",
      },
    });
  }

  try {
    const functionResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/payment-approved-email`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${admin.session.access_token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: client.email,
          name: client.name,
          plan: client.plan,
        }),
      },
    );

    const result = (await functionResponse.json().catch(() => ({}))) as {
      error?: string;
      id?: string;
    };
    if (!functionResponse.ok) {
      throw new Error(result.error || "Falha ao enviar o aviso.");
    }

    await db
      .update(clients)
      .set({
        approvalEmailStatus: "sent",
        approvalEmailSentAt: now,
        approvalEmailError: null,
        updatedAt: now,
      })
      .where(eq(clients.email, payload.email));

    return Response.json({ ok: true, email: { sent: true, id: result.id } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 300) : "Falha desconhecida.";
    await db
      .update(clients)
      .set({
        approvalEmailStatus: "failed",
        approvalEmailError: message,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(clients.email, payload.email));

    return Response.json({
      ok: true,
      email: { sent: false, error: message },
    });
  }
}
