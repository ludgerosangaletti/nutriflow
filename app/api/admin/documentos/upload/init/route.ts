import { eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { clients } from "../../../../../../db/schema";
import { getAdminSession } from "../../../../../supabase/server";
import { maxDocumentSize } from "../shared";

export async function POST(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    fileName?: string;
    fileSize?: number;
    fileType?: string;
  };
  const email = String(body.email || "").trim().toLowerCase();
  const fileName = String(body.fileName || "").trim();
  const fileSize = Number(body.fileSize || 0);

  if (
    !email ||
    !fileName.toLowerCase().endsWith(".pdf") ||
    body.fileType !== "application/pdf" ||
    !Number.isInteger(fileSize) ||
    fileSize <= 0 ||
    fileSize > maxDocumentSize
  ) {
    return Response.json({ error: "Envie um PDF válido com até 20 MB." }, { status: 400 });
  }

  const [client] = await getDb()
    .select({ email: clients.email })
    .from(clients)
    .where(eq(clients.email, email))
    .limit(1);
  if (!client) return Response.json({ error: "Paciente não encontrado." }, { status: 404 });

  return Response.json({ uploadId: crypto.randomUUID() });
}
