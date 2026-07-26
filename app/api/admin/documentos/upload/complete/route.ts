import { and, eq, ne } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../../../db";
import { clients, patientDocuments } from "../../../../../../db/schema";
import { getAdminSession } from "../../../../../supabase/server";
import {
  chunkKey,
  maxChunkSize,
  maxDocumentSize,
  removeUploadChunks,
  uploadIdPattern,
} from "../shared";

type FixedLengthStreamInstance = {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
};

type FixedLengthStreamConstructor = new (size: number) => FixedLengthStreamInstance;

export async function POST(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as {
    uploadId?: string;
    totalParts?: number;
    fileSize?: number;
    fileName?: string;
    email?: string;
    documentType?: string;
    title?: string;
    version?: string;
  };
  const uploadId = String(body.uploadId || "");
  const totalParts = Number(body.totalParts || 0);
  const fileSize = Number(body.fileSize || 0);
  const fileName = String(body.fileName || "").trim().slice(0, 180);
  const email = String(body.email || "").trim().toLowerCase();
  const documentType = String(body.documentType || "");
  const title = String(body.title || "").trim().slice(0, 120);
  const version = String(body.version || "").trim().slice(0, 30);

  if (
    !uploadIdPattern.test(uploadId) ||
    !Number.isInteger(totalParts) ||
    totalParts < 1 ||
    totalParts > 30 ||
    !Number.isInteger(fileSize) ||
    fileSize < 1 ||
    fileSize > maxDocumentSize ||
    totalParts !== Math.ceil(fileSize / maxChunkSize) ||
    !fileName.toLowerCase().endsWith(".pdf") ||
    !email ||
    !["protocol", "auxiliary"].includes(documentType) ||
    !title ||
    !version
  ) {
    return Response.json({ error: "Dados do documento inválidos." }, { status: 400 });
  }

  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.email, email))
    .limit(1);
  if (!client) return Response.json({ error: "Paciente não encontrado." }, { status: 404 });

  const owner = client.authUserId || client.email.replace(/[^a-z0-9]/gi, "_");
  const objectKey = `documents/${owner}/${Date.now()}-${crypto.randomUUID()}.pdf`;
  const FixedLengthStream = (
    globalThis as typeof globalThis & { FixedLengthStream: FixedLengthStreamConstructor }
  ).FixedLengthStream;
  const stream = new FixedLengthStream(fileSize);
  const putPromise = env.BUCKET.put(objectKey, stream.readable, {
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: {
      owner: client.email,
      documentType,
      version,
    },
  });
  const writer = stream.writable.getWriter();
  try {
    let assembledSize = 0;
    for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
      const chunk = await env.BUCKET.get(chunkKey(uploadId, partNumber));
      if (!chunk) {
        throw new Error(`missing-part-${partNumber}`);
      }
      assembledSize += chunk.size;
      const reader = chunk.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
      }
    }
    if (assembledSize !== fileSize) throw new Error("invalid-size");
    await writer.close();
    await putPromise;
  } catch (error) {
    await writer.abort(error).catch(() => undefined);
    await env.BUCKET.delete(objectKey).catch(() => undefined);
    return Response.json(
      { error: "Não foi possível montar o arquivo completo. Tente novamente." },
      { status: 500 },
    );
  }

  const now = new Date().toISOString();
  let document;
  try {
    [document] = await db
      .insert(patientDocuments)
      .values({
        clientEmail: client.email,
        documentType,
        title,
        version,
        originalName: fileName,
        objectKey,
        contentType: "application/pdf",
        sizeBytes: fileSize,
        isCurrent: true,
        createdAt: now,
        publishedAt: now,
      })
      .returning();
    if (documentType === "protocol") {
      await db
        .update(patientDocuments)
        .set({ isCurrent: false })
        .where(
          and(
            eq(patientDocuments.clientEmail, client.email),
            eq(patientDocuments.documentType, "protocol"),
            ne(patientDocuments.id, document.id),
          ),
        );
    }
  } catch {
    await env.BUCKET.delete(objectKey).catch(() => undefined);
    return Response.json(
      { error: "Não foi possível registrar o documento. Tente novamente." },
      { status: 500 },
    );
  }

  await removeUploadChunks(uploadId, totalParts).catch(() => undefined);

  try {
    const notification = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/material-available-email`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${admin.session.access_token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: client.email,
          name: client.name,
          documentTitle: title,
          version,
        }),
      },
    );
    const result = (await notification.json().catch(() => ({}))) as {
      id?: string;
      error?: string;
    };
    if (!notification.ok) throw new Error(result.error || "Falha no aviso.");
    return Response.json({ ok: true, document, email: { sent: true, id: result.id } });
  } catch (error) {
    return Response.json({
      ok: true,
      document,
      email: {
        sent: false,
        error: error instanceof Error ? error.message : "Falha no aviso.",
      },
    });
  }
}
