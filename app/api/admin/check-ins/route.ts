import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { checkIns } from "../../../../db/schema";
import { getAdminSession } from "../../../supabase/server";

export async function PATCH(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 403 });
  const body = await request.json() as { id?: number; reviewed?: boolean };
  if (!Number.isInteger(body.id) || typeof body.reviewed !== "boolean") return Response.json({ error: "Dados inválidos." }, { status: 400 });
  await getDb().update(checkIns).set({ adminStatus: body.reviewed ? "reviewed" : "new", reviewedAt: body.reviewed ? new Date().toISOString() : null, updatedAt: new Date().toISOString() }).where(eq(checkIns.id, body.id!));
  return Response.json({ ok: true });
}
