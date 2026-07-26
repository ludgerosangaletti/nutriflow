import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { adjustmentRequests, clients } from "../../../db/schema";
import { hasActiveAccess } from "../../access";
import { getPatientUser } from "../../supabase/server";

const reasons = new Set(["hunger", "meal", "substitution", "gastrointestinal", "routine", "training", "event", "adherence", "other"]);
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const maxSize = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getPatientUser();
  if (!user) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const db = getDb();
  const [client] = await db.select().from(clients).where(eq(clients.authUserId, user.id)).limit(1);
  if (!client || !hasActiveAccess(client)) return Response.json({ error: "Acompanhamento indisponível." }, { status: 403 });
  const prior = await db.select({ status: adjustmentRequests.status }).from(adjustmentRequests).where(eq(adjustmentRequests.clientEmail, client.email));
  if (prior.some((item) => !["adjusted", "closed"].includes(item.status))) return Response.json({ error: "Você já possui uma solicitação em andamento." }, { status: 409 });
  const form = await request.formData();
  const reason = String(form.get("reason") || ""), protocolArea = String(form.get("protocolArea") || "").trim(), description = String(form.get("description") || "").trim(), duration = String(form.get("duration") || "").trim(), attempts = String(form.get("attempts") || "").trim(), requestedChange = String(form.get("requestedChange") || "").trim();
  if (!reasons.has(reason) || !protocolArea || !description || !duration || !attempts || !requestedChange) return Response.json({ error: "Preencha todos os campos obrigatórios." }, { status: 400 });
  const attachment = form.get("attachment");
  let attachmentKey: string | null = null, attachmentName: string | null = null, attachmentType: string | null = null;
  if (attachment instanceof File && attachment.size > 0) {
    if (!allowedTypes.has(attachment.type) || attachment.size > maxSize) return Response.json({ error: "Use imagem ou PDF com até 8 MB." }, { status: 400 });
    const extension = attachment.type === "application/pdf" ? "pdf" : attachment.type === "image/png" ? "png" : attachment.type === "image/webp" ? "webp" : "jpg";
    attachmentKey = `adjustments/${user.id}/${crypto.randomUUID()}.${extension}`;
    attachmentName = attachment.name.slice(0, 180);
    attachmentType = attachment.type;
    await env.BUCKET.put(attachmentKey, await attachment.arrayBuffer(), { httpMetadata: { contentType: attachment.type }, customMetadata: { owner: client.email } });
  }
  const now = new Date().toISOString();
  const [created] = await db.insert(adjustmentRequests).values({ clientEmail: client.email, reason, protocolArea: protocolArea.slice(0, 120), description: description.slice(0, 1200), duration: duration.slice(0, 200), attempts: attempts.slice(0, 500), requestedChange: requestedChange.slice(0, 800), attachmentKey, attachmentName, attachmentType, createdAt: now, updatedAt: now }).returning();
  return Response.json({ ok: true, request: created });
}
