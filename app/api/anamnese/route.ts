import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { anamneses, clients, nfOrganizations } from "../../../db/schema";
import { hasActiveAccess } from "../../access";
import { getPatientUser } from "../../supabase/server";
import { cleanAnamnesisAnswers, missingRequiredAnamnesisFields } from "../../anamnese/answers";
import { CLINICAL_ANAMNESIS_SUBMITTED } from "../../../modules/nutriflow/domain/notifications/workflow-events";

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
  const firstSubmission = payload.submit === true && existing?.status !== "submitted";
  const organizationId = client.organizationId;
  const [organization] = organizationId ? await db.select({ publicId: nfOrganizations.publicId }).from(nfOrganizations).where(eq(nfOrganizations.id, organizationId)).limit(1) : [];
  const statements = [
    env.DB.prepare(`INSERT INTO anamneses (client_email, answers_json, status, submitted_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(client_email) DO UPDATE SET answers_json = excluded.answers_json, status = excluded.status,
      submitted_at = CASE WHEN excluded.status = 'submitted' THEN excluded.submitted_at ELSE anamneses.submitted_at END,
      updated_at = excluded.updated_at`).bind(client.email, JSON.stringify(answers), status, payload.submit ? now : existing?.submittedAt ?? null, now, now),
    env.DB.prepare("UPDATE clients SET form_status = ?, updated_at = ? WHERE auth_user_id = ?").bind(status, now, user.id),
  ];
  if (firstSubmission && organizationId && organization) {
    const eventId = `event_${crypto.randomUUID()}`;
    const anamnesisPublicId = `clinical_anamnesis_client_${client.id}`;
    statements.push(env.DB.prepare(`INSERT INTO nf_outbox_events
      (event_id, organization_id, event_type, event_version, aggregate_type, aggregate_public_id, aggregate_version, actor_auth_user_id, correlation_id, causation_id, occurred_at, payload_json, metadata_json, status, attempts, available_at)
      VALUES (?, ?, ?, 1, 'clinical-anamnesis', ?, 1, ?, ?, NULL, ?, ?, ?, 'pending', 0, ?)`)
      .bind(eventId, organizationId, CLINICAL_ANAMNESIS_SUBMITTED, anamnesisPublicId, user.id, `corr_${crypto.randomUUID()}`, now, JSON.stringify({ clientId: client.id, anamnesisPublicId }), JSON.stringify({ organizationPublicId: organization.publicId, environment: process.env.NODE_ENV === "production" ? "production" : "development", source: "patient-clinical-anamnesis", actorRole: "patient" }), now));
  }
  await env.DB.batch(statements);

  return Response.json({ ok: true, status, savedAt: now });
}
