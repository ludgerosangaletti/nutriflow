import { and, eq, ne } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { clients, patientDocuments } from "../../../../db/schema";
import { getAdminSession } from "../../../supabase/server";

const maxSize = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 403 });

  const form = await request.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const documentType = String(form.get("documentType") || "");
  const title = String(form.get("title") || "").trim().slice(0, 120);
  const version = String(form.get("version") || "").trim().slice(0, 30);
  const file = form.get("file");

  if (
    !email ||
    !["protocol", "auxiliary"].includes(documentType) ||
    !title ||
    !version ||
    !(file instanceof File)
  ) {
    return Response.json({ error: "Preencha todos os campos." }, { status: 400 });
  }
  if (
    file.type !== "application/pdf" ||
    !file.name.toLowerCase().endsWith(".pdf") ||
    file.size === 0 ||
    file.size > maxSize
  ) {
    return Response.json({ error: "Envie um PDF válido com até 20 MB." }, { status: 400 });
  }

  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.email, email))
    .limit(1);
  if (!client) return Response.json({ error: "Paciente não encontrado." }, { status: 404 });

  const now = new Date().toISOString();
  const owner = client.authUserId || client.email.replace(/[^a-z0-9]/gi, "_");
  const objectKey = `documents/${owner}/${Date.now()}-${crypto.randomUUID()}.pdf`;
  await env.BUCKET.put(objectKey, await file.arrayBuffer(), {
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: {
      owner: client.email,
      documentType,
      version,
    },
  });
  const [document] = await db
    .insert(patientDocuments)
    .values({
      clientEmail: client.email,
      documentType,
      title,
      version,
      originalName: file.name.slice(0, 180),
      objectKey,
      contentType: "application/pdf",
      sizeBytes: file.size,
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
