import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { clients } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { isPlanId, plans } from "../../plans";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Faça login para continuar." }, { status: 401 });
  }

  const payload = (await request.json()) as {
    name?: string;
    whatsapp?: string;
    plan?: string;
  };
  const name = payload.name?.trim() ?? "";
  const whatsapp = payload.whatsapp?.trim() ?? "";
  const plan = payload.plan?.trim() ?? "";

  if (!name || whatsapp.length < 8 || !isPlanId(plan)) {
    return Response.json(
      { error: "Confira nome, WhatsApp e plano selecionado." },
      { status: 400 },
    );
  }

  const db = getDb();
  const existing = await db
    .select()
    .from(clients)
    .where(eq(clients.email, user.email))
    .limit(1);

  if (existing[0]) {
    await db
      .update(clients)
      .set({
        name,
        whatsapp,
        plan,
        paymentStatus: "pending",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(clients.email, user.email));
  } else {
    await db.insert(clients).values({
      email: user.email,
      name,
      whatsapp,
      plan,
    });
  }

  return Response.json({
    paymentUrl: plans[plan].paymentUrl,
    dashboardUrl: "/area-cliente",
  });
}
