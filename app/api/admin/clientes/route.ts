import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { clients } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (
    !user ||
    !env.ADMIN_EMAIL ||
    user.email.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()
  ) {
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
