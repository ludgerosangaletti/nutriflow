import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { clients, patientDocuments } from "../../../../db/schema";
import { hasActiveAccess } from "../../../access";
import { getPatientUser, isAdminEmail } from "../../../supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getPatientUser();
  if (!user?.email) return new Response("Não autorizado.", { status: 401 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Documento inválido.", { status: 400 });

  const db = getDb();
  const [document] = await db
    .select()
    .from(patientDocuments)
    .where(eq(patientDocuments.id, id))
    .limit(1);
  if (!document) return new Response("Documento não encontrado.", { status: 404 });

  if (!isAdminEmail(user.email)) {
    if (user.email.toLowerCase() !== document.clientEmail.toLowerCase()) {
      return new Response("Não autorizado.", { status: 403 });
    }
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.email, document.clientEmail))
      .limit(1);
    if (!client || !hasActiveAccess(client)) {
      return new Response("A vigência do plano terminou.", { status: 403 });
    }
  }

  const object = await env.BUCKET.get(document.objectKey);
  if (!object) return new Response("Arquivo não encontrado.", { status: 404 });
  const fallbackName = document.originalName.replace(/[^\w.-]+/g, "_");
  return new Response(object.body, {
    headers: {
      "cache-control": "private, no-store",
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(document.originalName)}`,
      "x-content-type-options": "nosniff",
    },
  });
}
