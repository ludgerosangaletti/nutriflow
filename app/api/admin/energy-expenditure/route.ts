import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { clients, nfEnergyExpenditureCalculations } from "../../../../db/schema";
import { requireAdmin } from "../../../supabase/server";
import { resolveNutriFlowAdminContext, sha256Json } from "../../../nutriflow/server";
import { calculateEnergyExpenditure, type EnergyInput } from "../../../../modules/nutriflow/domain/energy/calculate-energy-expenditure";

const publicId = (kind: string) => `${kind}_${crypto.randomUUID()}`;
export async function POST(request: Request) {
  const admin = await requireAdmin("/admin/clientes"); const context = await resolveNutriFlowAdminContext(admin.id);
  if (!context) return Response.json({ error: "Sem permissão." }, { status: 403 });
  const body = await request.json() as { email?: string; input?: EnergyInput };
  if (!body.email || !body.input) return Response.json({ error: "Dados incompletos." }, { status: 400 });
  const db = getDb(); const [client] = await db.select().from(clients).where(eq(clients.email, body.email)).limit(1);
  if (!client) return Response.json({ error: "Paciente não encontrado." }, { status: 404 });
  let result; try { result = calculateEnergyExpenditure(body.input); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Dados inválidos." }, { status: 400 }); }
  const occurredAt = new Date().toISOString(); const snapshot = { protocol: body.input.protocol, calculationVersion: result.calculationVersion, input: body.input, result, occurredAt };
  const hash = await sha256Json(snapshot); const calculationId = publicId("energy"); const correlationId = publicId("corr");
  await env.DB.batch([
    env.DB.prepare("INSERT INTO nf_energy_expenditure_calculations (public_id, organization_id, client_id, protocol_code, calculation_version, total_kcal, snapshot_json, content_hash, created_by_auth_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(calculationId, context.organizationId, client.id, body.input.protocol, result.calculationVersion, result.totalKcal, JSON.stringify(snapshot), hash, admin.id, occurredAt),
    env.DB.prepare("INSERT INTO nf_audit_entries (public_id, organization_id, actor_auth_user_id, actor_role, action, entity_type, entity_public_id, correlation_id, before_json, after_json, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)").bind(publicId("audit"), context.organizationId, admin.id, context.actor.role, "energy-expenditure.calculated", "energy-expenditure-calculation", calculationId, correlationId, JSON.stringify({ clientId: client.id, protocol: body.input.protocol, totalKcal: result.totalKcal }), occurredAt),
    env.DB.prepare("INSERT INTO nf_outbox_events (event_id, organization_id, event_type, event_version, aggregate_type, aggregate_public_id, aggregate_version, actor_auth_user_id, correlation_id, causation_id, occurred_at, payload_json, metadata_json, status, attempts, available_at) VALUES (?, ?, ?, 1, ?, ?, 1, ?, ?, NULL, ?, ?, ?, 'pending', 0, ?)").bind(publicId("event"), context.organizationId, "energy-expenditure.calculated", "energy-expenditure-calculation", calculationId, admin.id, correlationId, occurredAt, JSON.stringify({ publicId: calculationId, clientId: client.id, totalKcal: result.totalKcal }), JSON.stringify({ organizationPublicId: context.organizationPublicId, environment: process.env.NODE_ENV === "production" ? "production" : "development", source: "admin-clinical-calculator", actorRole: context.actor.role }), occurredAt),
  ]);
  return Response.json({ ok: true, calculation: { publicId: calculationId, snapshot } });
}
