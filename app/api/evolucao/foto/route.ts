import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { clients, progressPhotos } from "../../../../db/schema";
import { hasActiveAccess } from "../../../access";
import { getPatientUser, isAdminEmail } from "../../../supabase/server";

export async function GET(request: Request) {
  const user = await getPatientUser();
  if (!user?.email) return new Response("Não autorizado.", { status: 401 });

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return new Response("Arquivo inválido.", { status: 400 });

  const [photo] = await getDb()
    .select()
    .from(progressPhotos)
    .where(eq(progressPhotos.id, id))
    .limit(1);
  if (!photo) return new Response("Foto não encontrada.", { status: 404 });
  if (!isAdminEmail(user.email) && user.email.toLowerCase() !== photo.clientEmail.toLowerCase()) {
    return new Response("Não autorizado.", { status: 403 });
  }
  if (!isAdminEmail(user.email)) {
    const [client] = await getDb()
      .select()
      .from(clients)
      .where(eq(clients.email, photo.clientEmail))
      .limit(1);
    if (!client || !hasActiveAccess(client)) {
      return new Response("Vigência encerrada.", { status: 403 });
    }
  }

  const object = await env.BUCKET.get(photo.objectKey);
  if (!object) return new Response("Foto não encontrada.", { status: 404 });

  return new Response(object.body, {
    headers: {
      "cache-control": "private, max-age=300",
      "content-type": photo.contentType,
      "content-disposition": "inline",
      "x-content-type-options": "nosniff",
    },
  });
}
