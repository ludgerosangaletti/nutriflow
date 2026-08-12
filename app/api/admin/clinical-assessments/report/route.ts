import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { clients, nfClinicalAssessments } from "../../../../../db/schema";
import { buildClinicalAssessmentReportPdf } from "../../../../../modules/nutriflow/reports/professional-pdf.ts";
import { assessmentPoint, loadReportLogo, NUTRITIONIST, pdfResponse } from "../../../../nutriflow/reporting";
import { resolveNutriFlowAdminContext } from "../../../../nutriflow/server";
import { requireAdmin } from "../../../../supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await requireAdmin("/admin/clientes");
  const context = await resolveNutriFlowAdminContext(admin.id);
  if (!context) return new Response("Sem permissão", { status: 403 });
  const params = new URL(request.url).searchParams;
  const email = params.get("email")?.trim();
  const assessmentPublicId = params.get("assessment")?.trim();
  if (!email || !assessmentPublicId) return new Response("Paciente e avaliação são obrigatórios", { status: 400 });
  const db = getDb();
  const [client] = await db.select().from(clients).where(and(eq(clients.email, email), eq(clients.organizationId, context.organizationId))).limit(1);
  if (!client) return new Response("Paciente não encontrado", { status: 404 });
  const rows = await db.select().from(nfClinicalAssessments).where(and(eq(nfClinicalAssessments.clientId, client.id), eq(nfClinicalAssessments.organizationId, context.organizationId))).orderBy(asc(nfClinicalAssessments.capturedAt), asc(nfClinicalAssessments.id));
  const target = rows.find((row) => row.publicId === assessmentPublicId);
  if (!target) return new Response("Avaliação não encontrada", { status: 404 });
  const bytes = await buildClinicalAssessmentReportPdf({ patientName: client.name, nutritionistName: NUTRITIONIST.name, nutritionistRegistration: NUTRITIONIST.registration, assessments: rows.map(assessmentPoint), targetAssessmentPublicId: target.publicId, logoBytes: await loadReportLogo(request) });
  return pdfResponse(bytes, `avaliacao-fisica-${client.id}-${target.capturedAt.slice(0, 10)}.pdf`);
}
