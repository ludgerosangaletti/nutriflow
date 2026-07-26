import { env } from "cloudflare:workers";
import { getAdminSession } from "../../../../../supabase/server";
import { chunkKey, maxChunkSize, uploadIdPattern } from "../shared";

export async function PUT(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 403 });

  const url = new URL(request.url);
  const uploadId = url.searchParams.get("uploadId") || "";
  const partNumber = Number(url.searchParams.get("partNumber") || 0);
  const contentLength = Number(request.headers.get("content-length") || 0);

  if (
    !uploadIdPattern.test(uploadId) ||
    !Number.isInteger(partNumber) ||
    partNumber < 1 ||
    partNumber > 30 ||
    contentLength > maxChunkSize
  ) {
    return Response.json({ error: "Parte do arquivo inválida." }, { status: 400 });
  }

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength < 1 || bytes.byteLength > maxChunkSize) {
    return Response.json({ error: "Parte do arquivo inválida." }, { status: 400 });
  }

  await env.BUCKET.put(chunkKey(uploadId, partNumber), bytes, {
    httpMetadata: { contentType: "application/octet-stream" },
  });
  return Response.json({ ok: true, size: bytes.byteLength });
}
