import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { adjustmentRequests, patientDocuments } from "../../../../db/schema";
import { getAdminSession } from "../../../supabase/server";

const statuses = new Set(["submitted", "analyzing", "answered", "adjusted", "closed"]);

export async function PATCH(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 403 });
  const body = await request.json() as { id?: number; status?: string; adminResponse?: string; linkedDocumentId?: string | number | null };
  if (!Number.isInteger(body.id) || !body.status || !statuses.has(body.status)) return Response.json({ error: "Dados inválidos." }, { status: 400 });
  const db = getDb();
  const [item] = await db.select().from(adjustmentRequests).where(eq(adjustmentRequests.id, body.id!)).limit(1);
  if (!item) return Response.json({ error: "Solicitação não encontrada." }, { status: 404 });
  let linkedDocumentId: number | null = null;
  if (body.linkedDocumentId) {
    linkedDocumentId = Number(body.linkedDocumentId);
    const [document] = await db.select().from(patientDocuments).where(eq(patientDocuments.id, linkedDocumentId)).limit(1);
    if (!document || document.clientEmail !== item.clientEmail) return Response.json({ error: "Documento inválido." }, { status: 400 });
  }
  const now = new Date().toISOString();
  const responseText = String(body.adminResponse || "").trim().slice(0, 1600);
  await db.update(adjustmentRequests).set({ status: body.status, adminResponse: responseText || null, linkedDocumentId, answeredAt: ["answered", "adjusted"].includes(body.status) ? now : item.answeredAt, closedAt: ["adjusted", "closed"].includes(body.status) ? now : null, updatedAt: now }).where(eq(adjustmentRequests.id, body.id!));
  return Response.json({ ok: true });
}
