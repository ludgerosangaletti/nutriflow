import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { clients } from "../../../../db/schema";
import { isPlanId, plans } from "../../../plans";
import { getPatientUser } from "../../../supabase/server";

export async function POST(request: Request) {
  const user = await getPatientUser();
  if (!user) return Response.json({ error: "Faça login para continuar." }, { status: 401 });

  const payload = (await request.json()) as { plan?: string };
  if (!payload.plan || !isPlanId(payload.plan)) {
    return Response.json({ error: "Plano inválido." }, { status: 400 });
  }

  const now = new Date().toISOString();
  await getDb()
    .update(clients)
    .set({ plan: payload.plan, paymentStatus: "pending", updatedAt: now })
    .where(eq(clients.authUserId, user.id));

  return Response.json({ url: plans[payload.plan].paymentUrl });
}
