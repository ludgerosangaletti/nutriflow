import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { clients, progressPhotos } from "../../../db/schema";
import { hasActiveAccess } from "../../access";
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
  if (!hasActiveAccess(client)) {
    return Response.json({ error: "O acompanhamento não está liberado ou a vigência terminou." }, { status: 403 });
  }

  const form = await request.formData();
  const period = String(form.get("period") || "");
  const photoConsent = String(form.get("photoConsent") || "");
  if (photoConsent !== "accepted") {
    return Response.json(
      { error: "Confirme o consentimento para enviar as fotos." },
      { status: 400 },
    );
  }
  const currentPeriod = new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period) || period > currentPeriod) {
    return Response.json({ error: "Selecione um mês válido." }, { status: 400 });
  }

  const files = angles
    .map((angle) => ({ angle, file: form.get(angle) }))
    .filter((entry): entry is { angle: typeof angles[number]; file: File } => entry.file instanceof File && entry.file.size > 0);
  if (!files.length) {
    return Response.json({ error: "Escolha ao menos uma foto para enviar ou atualizar." }, { status: 400 });
  }
  for (const { file } of files) {
    if (!allowedTypes.has(file.type) || file.size > maxFileSize) {
      return Response.json({ error: "Use imagens JPG, PNG ou WEBP com até 8 MB cada." }, { status: 400 });
    }
  }

  const now = new Date().toISOString();
  for (const { angle, file } of files) {
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const objectKey = `progress/${user.id}/${period}/${angle}.${extension}`;
    await env.BUCKET.put(objectKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
      customMetadata: {
        owner: client.email,
        period,
        angle,
        consentVersion: "2026-07-28",
        consentRecordedAt: now,
      },
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
