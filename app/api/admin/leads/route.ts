import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { whatsappLeads } from "../../../../db/schema";
import { getAdminSession } from "../../../supabase/server";

const allowedStages = [
  "new",
  "informed",
  "qualified",
  "converted",
  "archived",
];

export async function PATCH(request: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return Response.json({ error: "Não autorizado." }, { status: 403 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    id?: number;
    stage?: string;
  };
  if (
    !Number.isInteger(payload.id) ||
    !payload.stage ||
    !allowedStages.includes(payload.stage)
  ) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const db = getDb();
  const [lead] = await db
    .select({ id: whatsappLeads.id })
    .from(whatsappLeads)
    .where(eq(whatsappLeads.id, payload.id!))
    .limit(1);

  if (!lead) {
    return Response.json({ error: "Lead não encontrado." }, { status: 404 });
  }

  await db
    .update(whatsappLeads)
    .set({
      stage: payload.stage,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(whatsappLeads.id, payload.id!));

  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return Response.json({ error: "Não autorizado." }, { status: 403 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    id?: number;
  };
  if (!Number.isInteger(payload.id)) {
    return Response.json({ error: "Lead inválido." }, { status: 400 });
  }

  const db = getDb();
  const [lead] = await db
    .select({ id: whatsappLeads.id })
    .from(whatsappLeads)
    .where(eq(whatsappLeads.id, payload.id!))
    .limit(1);
  if (!lead) {
    return Response.json({ error: "Lead não encontrado." }, { status: 404 });
  }

  await db
    .delete(whatsappLeads)
    .where(eq(whatsappLeads.id, payload.id!));

  return Response.json({ ok: true, deleted: true });
}
