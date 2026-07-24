import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { clients } from "../../../../db/schema";
import { getAdminUser } from "../../../supabase/server";

export async function PATCH(request: Request) {
  const user = await getAdminUser();
  if (!user) {
    return Response.json({ error: "Não autorizado." }, { status: 403 });
  }

  const payload = (await request.json()) as {
    email?: string;
    paymentStatus?: string;
  };
  if (
    !payload.email ||
    !["pending", "approved"].includes(payload.paymentStatus ?? "")
  ) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  await getDb()
    .update(clients)
    .set({
      paymentStatus: payload.paymentStatus,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(clients.email, payload.email));

  return Response.json({ ok: true });
}
