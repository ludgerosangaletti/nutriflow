import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { anamneses, clients } from "../../../db/schema";
import { hasActiveAccess } from "../../access";
import { getPatientUser } from "../../supabase/server";
import { cleanAnamnesisAnswers, missingRequiredAnamnesisFields } from "../../anamnese/answers";

export async function PUT(request: Request) {
  const user = await getPatientUser();
  if (!user) return Response.json({ error: "Faça login." }, { status: 401 });

  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.authUserId, user.id))
    .limit(1);
  if (!client || !hasActiveAccess(client)) {
    return Response.json({ error: "Acesso não liberado ou vigência encerrada." }, { status: 403 });
  }
  if (client.modality === "in_person") {
    return Response.json({ error: "A anamnese presencial é preenchida pelo nutricionista." }, { status: 403 });
  }

  const payload = (await request.json()) as { answers?: unknown; submit?: boolean };
  const answers = cleanAnamnesisAnswers(payload.answers);

  if (payload.submit) {
    const missing = missingRequiredAnamnesisFields(answers);
    if (missing.length) {
      return Response.json(
        { error: `Preencha os campos obrigatórios: ${missing.join(", ")}` },
        { status: 400 },
      );
    }
  }

  const [existing] = await db
    .select()
    .from(anamneses)
    .where(eq(anamneses.clientEmail, client.email))
    .limit(1);
  const now = new Date().toISOString();
  const status = payload.submit ? "submitted" : "draft";

  if (existing) {
    await db
      .update(anamneses)
      .set({
        answersJson: JSON.stringify(answers),
        status,
        updatedAt: now,
        submittedAt: payload.submit ? now : existing.submittedAt,
      })
      .where(eq(anamneses.clientEmail, client.email));
  } else {
    await db.insert(anamneses).values({
      clientEmail: client.email,
      answersJson: JSON.stringify(answers),
      status,
      submittedAt: payload.submit ? now : null,
    });
  }

  await db
    .update(clients)
    .set({ formStatus: status, updatedAt: now })
    .where(eq(clients.authUserId, user.id));

  return Response.json({ ok: true, status, savedAt: now });
}
