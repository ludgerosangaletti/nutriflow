import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { clients } from "../../../../db/schema";
import { isPlanId, plans } from "../../../plans";
import { getPatientSession } from "../../../supabase/server";

export async function POST(request: Request) {
  const auth = await getPatientSession();
  if (!auth) return Response.json({ error: "Faça login para continuar." }, { status: 401 });

  const payload = (await request.json()) as { plan?: string };
  if (!payload.plan || !isPlanId(payload.plan)) {
    return Response.json({ error: "Plano inválido." }, { status: 400 });
  }

  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.authUserId, auth.user.id))
    .limit(1);
  if (!client) {
    return Response.json({ error: "Cadastro não encontrado." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
  const shouldNotify =
    client.plan !== payload.plan ||
    client.paymentStatus !== "pending" ||
    !client.purchaseAlertSentAt ||
    new Date(client.purchaseAlertSentAt).getTime() < twelveHoursAgo;

  await db
    .update(clients)
    .set({
      plan: payload.plan,
      paymentStatus: "pending",
      purchaseStartedAt: now,
      purchaseAlertStatus: shouldNotify ? "sending" : client.purchaseAlertStatus,
      purchaseAlertError: shouldNotify ? null : client.purchaseAlertError,
      updatedAt: now,
    })
    .where(eq(clients.authUserId, auth.user.id));

  if (shouldNotify) {
    try {
      const notification = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/purchase-started-admin-email`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${auth.session.access_token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            email: client.email,
            name: client.name,
            whatsapp: client.whatsapp,
            plan: plans[payload.plan].name,
            price: plans[payload.plan].price,
          }),
        },
      );
      const result = (await notification.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!notification.ok) {
        throw new Error(result.error || "Falha ao enviar o alerta.");
      }
      await db
        .update(clients)
        .set({
          purchaseAlertStatus: "sent",
          purchaseAlertSentAt: now,
          purchaseAlertError: null,
          updatedAt: now,
        })
        .where(eq(clients.authUserId, auth.user.id));
    } catch (error) {
      await db
        .update(clients)
        .set({
          purchaseAlertStatus: "failed",
          purchaseAlertError:
            error instanceof Error
              ? error.message.slice(0, 300)
              : "Falha desconhecida.",
          updatedAt: now,
        })
        .where(eq(clients.authUserId, auth.user.id));
    }
  }

  return Response.json({ url: plans[payload.plan].paymentUrl });
}
