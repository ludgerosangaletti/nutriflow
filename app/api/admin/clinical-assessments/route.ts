import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { clients, nfClinicalAssessments, nfPlans } from "../../../../db/schema";
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
  const [client] = await db.select({ id: clients.id, email: clients.email, modality: clients.modality }).from(clients).innerJoin(nfPlans, and(eq(nfPlans.clientId, clients.id), eq(nfPlans.organizationId, context.organizationId))).where(eq(clients.email, email)).limit(1);
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
  const [client] = await db.select({ id: clients.id, email: clients.email, modality: clients.modality }).from(clients).innerJoin(nfPlans, and(eq(nfPlans.clientId, clients.id), eq(nfPlans.organizationId, context.organizationId))).where(eq(clients.email, body.email)).limit(1);
  if (!client || client.modality !== "in_person") return Response.json({ error: "Avaliações estruturadas estão disponíveis para pacientes presenciais." }, { status: 400 });
  let result;
  try {
    result = calculatePollock7(body.input);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível calcular a avaliação." }, { status: 400 });
  }
  if (body.mode === "preview") return Response.json({ ok: true, calculation: result });
  const capturedAt = body.capturedAt || new Date().toISOString();
  const snapshot = { protocol: "pollock_7", version: "1.0.0", capturedAt, input: body.input, result };
  const contentHash = await sha256Json(snapshot);
  const publicId = id();
  await db.insert(nfClinicalAssessments).values({ publicId, organizationId: context.organizationId, clientId: client.id, protocolCode: "pollock_7", protocolVersion: "1.0.0", capturedAt, weightKg: String(body.input.weightKg), heightCm: String(body.input.heightCm), bmi: String(result.bmi), bodyFatPct: String(result.bodyFatPct), fatMassKg: String(result.fatMassKg), leanMassKg: String(result.leanMassKg), snapshotJson: JSON.stringify(snapshot), contentHash, createdByAuthUserId: admin.id });
  return Response.json({ ok: true, publicId, snapshot });
}
