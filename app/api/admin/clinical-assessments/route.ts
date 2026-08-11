import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { clients, nfClinicalAssessments } from "../../../../db/schema";
import { requireAdmin } from "../../../supabase/server";
import { resolveNutriFlowAdminContext, sha256Json } from "../../../nutriflow/server";
import { calculatePollock7 } from "../../../../modules/nutriflow/domain/assessments/pollock-7";

const id = () => `assess_${crypto.randomUUID().replaceAll("-", "")}`;
export async function GET(request: Request) {
  const admin = await requireAdmin("/admin/clientes");
  const context = await resolveNutriFlowAdminContext(admin.id);
  if (!context) return Response.json({ error: "Sem permissão." }, { status: 403 });
  const email = new URL(request.url).searchParams.get("email");
  if (!email) return Response.json({ error: "Paciente obrigatório." }, { status: 400 });
  const db = getDb();
  const [client] = await db.select({ id: clients.id, email: clients.email, modality: clients.modality }).from(clients).where(and(eq(clients.email, email), eq(clients.organizationId, context.organizationId))).limit(1);
  if (!client) return Response.json({ error: "Paciente não encontrado." }, { status: 404 });
  const rows = await db.select().from(nfClinicalAssessments).where(and(eq(nfClinicalAssessments.clientId, client.id), eq(nfClinicalAssessments.organizationId, context.organizationId)));
  return Response.json({ assessments: rows.map((row) => ({ ...row, snapshot: JSON.parse(row.snapshotJson) })) });
}

export async function POST(request: Request) {
  const admin = await requireAdmin("/admin/clientes");
  const context = await resolveNutriFlowAdminContext(admin.id);
  if (!context) return Response.json({ error: "Sem permissão." }, { status: 403 });
  const body = await request.json() as { email?: string; capturedAt?: string; mode?: "preview" | "save"; input?: Parameters<typeof calculatePollock7>[0] };
  if (!body.email || !body.input) return Response.json({ error: "Dados incompletos." }, { status: 400 });
  const db = getDb();
  const [client] = await db.select({ id: clients.id, email: clients.email, modality: clients.modality }).from(clients).where(and(eq(clients.email, body.email), eq(clients.organizationId, context.organizationId))).limit(1);
  if (!client || client.modality !== "in_person") return Response.json({ error: "Avaliações estruturadas estão disponíveis para pacientes presenciais." }, { status: 400 });
  let result;
  try {
    result = calculatePollock7(body.input);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível calcular a avaliação." }, { status: 400 });
  }
  const capturedAt = body.capturedAt || new Date().toISOString();
  if (body.mode === "preview") return Response.json({ ok: true, calculation: result, capturedAt });
  const snapshot = { protocol: "pollock_7", version: "1.0.0", capturedAt, input: body.input, result };
  const contentHash = await sha256Json(snapshot);
  const publicId = id();
  const inserted = await db.insert(nfClinicalAssessments).values({ publicId, organizationId: context.organizationId, clientId: client.id, protocolCode: "pollock_7", protocolVersion: "1.0.0", capturedAt, weightKg: String(body.input.weightKg), heightCm: String(body.input.heightCm), bmi: String(result.bmi), bodyFatPct: String(result.bodyFatPct), fatMassKg: String(result.fatMassKg), leanMassKg: String(result.leanMassKg), snapshotJson: JSON.stringify(snapshot), contentHash, createdByAuthUserId: admin.id }).onConflictDoNothing({ target: [nfClinicalAssessments.clientId, nfClinicalAssessments.contentHash] }).returning({ publicId: nfClinicalAssessments.publicId });
  if (inserted[0]) return Response.json({ ok: true, publicId: inserted[0].publicId, snapshot, duplicate: false });
  const [existing] = await db.select({ publicId: nfClinicalAssessments.publicId }).from(nfClinicalAssessments).where(and(eq(nfClinicalAssessments.clientId, client.id), eq(nfClinicalAssessments.contentHash, contentHash))).limit(1);
  return Response.json({ ok: true, publicId: existing?.publicId, snapshot, duplicate: true });
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin("/admin/clientes");
  const context = await resolveNutriFlowAdminContext(admin.id);
  if (!context) return Response.json({ error: "Sem permissão." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { email?: string; publicId?: string };
  if (!body.email || !body.publicId) return Response.json({ error: "Avaliação obrigatória." }, { status: 400 });
  const db = getDb();
  const [client] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.email, body.email), eq(clients.organizationId, context.organizationId))).limit(1);
  if (!client) return Response.json({ error: "Paciente não encontrado." }, { status: 404 });
  const [assessment] = await db.select({ publicId: nfClinicalAssessments.publicId, capturedAt: nfClinicalAssessments.capturedAt, contentHash: nfClinicalAssessments.contentHash }).from(nfClinicalAssessments).where(and(eq(nfClinicalAssessments.publicId, body.publicId), eq(nfClinicalAssessments.clientId, client.id), eq(nfClinicalAssessments.organizationId, context.organizationId))).limit(1);
  if (!assessment) return Response.json({ error: "Avaliação não encontrada." }, { status: 404 });
  const occurredAt = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM nf_clinical_assessments WHERE public_id = ? AND client_id = ? AND organization_id = ?").bind(assessment.publicId, client.id, context.organizationId),
    env.DB.prepare("INSERT INTO nf_audit_entries (public_id, organization_id, actor_auth_user_id, actor_role, action, entity_type, entity_public_id, correlation_id, before_json, after_json, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`audit_${crypto.randomUUID().replaceAll("-", "")}`, context.organizationId, admin.id, "admin", "clinical-assessment.deleted", "clinical_assessment", assessment.publicId, `corr_${crypto.randomUUID()}`, JSON.stringify({ clientId: client.id, capturedAt: assessment.capturedAt, contentHash: assessment.contentHash }), null, occurredAt),
  ]);
  return Response.json({ ok: true, deletedPublicId: assessment.publicId });
}
