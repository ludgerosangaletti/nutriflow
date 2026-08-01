import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { anamneses, clients } from "../../../../db/schema";
import { cleanAnamnesisAnswers, missingRequiredAnamnesisFields } from "../../../anamnese/answers";
import { getAdminSession } from "../../../supabase/server";

export async function PUT(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 403 });
  const payload = (await request.json().catch(() => ({}))) as { email?: string; answers?: unknown; submit?: boolean };
  const email = String(payload.email ?? "").trim().toLowerCase();
  const db = getDb();
  const [client] = await db.select().from(clients).where(eq(clients.email, email)).limit(1);
  if (!client || client.modality !== "in_person") {
    return Response.json({ error: "Paciente presencial não encontrado." }, { status: 404 });
  }
  const answers = cleanAnamnesisAnswers(payload.answers);
  if (payload.submit) {
    const missing = missingRequiredAnamnesisFields(answers);
    if (missing.length) return Response.json({ error: `Preencha os campos obrigatórios: ${missing.join(", ")}` }, { status: 400 });
  }
  const [existing] = await db.select().from(anamneses).where(eq(anamneses.clientEmail, email)).limit(1);
  const now = new Date().toISOString();
  const status = payload.submit ? "submitted" : "draft";
  if (existing) {
    await db.update(anamneses).set({ answersJson: JSON.stringify(answers), status, updatedAt: now, submittedAt: payload.submit ? now : existing.submittedAt }).where(eq(anamneses.clientEmail, email));
  } else {
    await db.insert(anamneses).values({ clientEmail: email, answersJson: JSON.stringify(answers), status, submittedAt: payload.submit ? now : null });
  }
  await db.update(clients).set({ formStatus: status, updatedAt: now }).where(eq(clients.email, email));
  return Response.json({ ok: true, status, savedAt: now });
}
