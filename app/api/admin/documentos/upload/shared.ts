import { env } from "cloudflare:workers";

export const maxDocumentSize = 20 * 1024 * 1024;
export const maxChunkSize = 700 * 1024;
export const uploadIdPattern = /^[a-f0-9-]{36}$/;

export function chunkKey(uploadId: string, partNumber: number) {
  return `document-uploads/${uploadId}/${String(partNumber).padStart(4, "0")}`;
}

export async function removeUploadChunks(uploadId: string, totalParts: number) {
  const keys = Array.from(
    { length: totalParts },
    (_, index) => chunkKey(uploadId, index + 1),
  );
  if (keys.length) await env.BUCKET.delete(keys);
}
