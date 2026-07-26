import { getAdminSession } from "../../../../../supabase/server";
import { removeUploadChunks, uploadIdPattern } from "../shared";

export async function DELETE(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as {
    uploadId?: string;
    totalParts?: number;
  };
  const uploadId = String(body.uploadId || "");
  const totalParts = Number(body.totalParts || 0);
  if (
    !uploadIdPattern.test(uploadId) ||
    !Number.isInteger(totalParts) ||
    totalParts < 1 ||
    totalParts > 30
  ) {
    return Response.json({ error: "Envio inválido." }, { status: 400 });
  }

  await removeUploadChunks(uploadId, totalParts);
  return Response.json({ ok: true });
}
