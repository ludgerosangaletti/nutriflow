import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { clients } from "../../../../db/schema";
import { isPlanId, plans } from "../../../plans";
import { getAdminSession } from "../../../supabase/server";

export async function POST(request: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return Response.json({ error: "Não autorizado." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    daysRemaining?: number;
  };
  const email = String(body.email || "").trim().toLowerCase();
  const days = Number(body.daysRemaining);
  if (!email || ![7, 3, 1].includes(days)) {
    return Response.json({ error: "Dados de teste inválidos." }, { status: 400 });
  }

  const [client] = await getDb()
    .select()
    .from(clients)
    .where(eq(clients.email, email))
    .limit(1);
  if (!client) {
    return Response.json({ error: "Paciente não encontrado." }, { status: 404 });
  }

  const syntheticExpiry = new Date(Date.now() + days * 86_400_000);
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/renewal-reminder-email`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`,
        "content-type": "application/json",
        "x-checkin-reminder-secret": env.CHECKIN_REMINDER_SECRET,
      },
      body: JSON.stringify({
        email: client.email,
        name: client.name,
        plan: isPlanId(client.plan) ? plans[client.plan].name : client.plan,
        daysRemaining: days,
        expiresAt: syntheticExpiry.toISOString(),
      }),
    },
  );
  const result = (await response.json().catch(() => ({}))) as {
    id?: string;
    error?: string;
  };
  if (!response.ok) {
    return Response.json(
      { error: result.error || "O envio de teste foi recusado." },
      { status: response.status },
    );
  }

  return Response.json({
    ok: true,
    id: result.id,
    message:
      "E-mail de teste enviado. A vigência real do paciente não foi alterada.",
  });
}
