import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { anamneses, clients } from "../../../db/schema";
import { hasActiveAccess } from "../../access";
import { getPatientUser } from "../../supabase/server";
import { sections, type Answers } from "../../anamnese/questions";

const allowedFields = new Set(
  sections.flatMap((section) => section.fields.map((field) => field.id)),
);

function cleanAnswers(input: unknown): Answers {
  if (!input || typeof input !== "object") return {};
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>)
      .filter(([key, value]) => allowedFields.has(key) && ["string", "boolean"].includes(typeof value))
      .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 5000) : value]),
  );
}

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

  const payload = (await request.json()) as { answers?: unknown; submit?: boolean };
  const answers = cleanAnswers(payload.answers);

  if (payload.submit) {
    const missing = sections
      .flatMap((section) => section.fields)
      .filter((field) => field.required && !answers[field.id])
      .map((field) => field.label);
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
