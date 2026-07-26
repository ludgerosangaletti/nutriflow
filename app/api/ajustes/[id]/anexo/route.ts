import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../../db";
import { adjustmentRequests } from "../../../../../db/schema";
import { getPatientUser, isAdminEmail } from "../../../../supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getPatientUser();
  if (!user?.email) return new Response("Não autorizado.", { status: 401 });
  const id = Number((await params).id);
  const [item] = await getDb().select().from(adjustmentRequests).where(eq(adjustmentRequests.id, id)).limit(1);
  if (!item?.attachmentKey || (!isAdminEmail(user.email) && user.email.toLowerCase() !== item.clientEmail.toLowerCase())) return new Response("Arquivo não encontrado.", { status: 404 });
  const object = await env.BUCKET.get(item.attachmentKey);
  if (!object) return new Response("Arquivo não encontrado.", { status: 404 });
  return new Response(object.body, { headers: { "content-type": item.attachmentType || "application/octet-stream", "content-disposition": `inline; filename="${(item.attachmentName || "anexo").replace(/["\r\n]/g, "")}"`, "cache-control": "private, no-store" } });
}
