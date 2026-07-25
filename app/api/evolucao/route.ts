import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { clients, progressPhotos } from "../../../db/schema";
import { getPatientUser } from "../../supabase/server";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const angles = ["front", "side", "back"] as const;
const maxFileSize = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getPatientUser();
  if (!user) return Response.json({ error: "Não autorizado." }, { status: 401 });

  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.authUserId, user.id))
    .limit(1);
  if (!client) return Response.json({ error: "Paciente não encontrado." }, { status: 404 });
  if (client.paymentStatus !== "approved") {
    return Response.json({ error: "O acompanhamento será liberado após a confirmação do pagamento." }, { status: 403 });
  }

  const form = await request.formData();
  const period = String(form.get("period") || "");
  const currentPeriod = new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period) || period > currentPeriod) {
    return Response.json({ error: "Selecione um mês válido." }, { status: 400 });
  }

  const files = angles.map((angle) => ({ angle, file: form.get(angle) }));
  for (const { file } of files) {
    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: "Envie as três fotos: frente, lado e costas." }, { status: 400 });
    }
    if (!allowedTypes.has(file.type) || file.size > maxFileSize) {
      return Response.json({ error: "Use imagens JPG, PNG ou WEBP com até 8 MB cada." }, { status: 400 });
    }
  }

  const now = new Date().toISOString();
  for (const { angle, file } of files as { angle: typeof angles[number]; file: File }[]) {
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const objectKey = `progress/${user.id}/${period}/${angle}.${extension}`;
    await env.BUCKET.put(objectKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { owner: client.email, period, angle },
    });
    await db
      .insert(progressPhotos)
      .values({
        clientEmail: client.email,
        period,
        angle,
        objectKey,
        contentType: file.type,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          progressPhotos.clientEmail,
          progressPhotos.period,
          progressPhotos.angle,
        ],
        set: { objectKey, contentType: file.type, updatedAt: now },
      });
  }

  return Response.json({ ok: true });
}
