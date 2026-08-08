import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { clients, nfClinicalAssessments } from "../../../../../db/schema";
import { buildClinicalEvolutionReportPdf } from "../../../../../modules/nutriflow/reports/professional-pdf.ts";
import { assessmentPoint, loadAssessmentPhotos, loadReportLogo, NUTRITIONIST, pdfResponse } from "../../../../nutriflow/reporting";
import { resolveNutriFlowAdminContext } from "../../../../nutriflow/server";
import { requireAdmin } from "../../../../supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await requireAdmin("/admin/clientes");
  const context = await resolveNutriFlowAdminContext(admin.id);
  if (!context) return new Response("Sem permissão", { status: 403 });
  const params = new URL(request.url).searchParams;
  const email = params.get("email")?.trim();
  const from = params.get("from")?.trim();
  const to = params.get("to")?.trim();
  if (!email || !from || !to || from === to) return new Response("Selecione duas avaliações diferentes", { status: 400 });
  const db = getDb();
  const [client] = await db.select().from(clients).where(eq(clients.email, email)).limit(1);
  if (!client) return new Response("Paciente não encontrado", { status: 404 });
  const rows = await db.select().from(nfClinicalAssessments).where(and(eq(nfClinicalAssessments.clientId, client.id), eq(nfClinicalAssessments.organizationId, context.organizationId))).orderBy(asc(nfClinicalAssessments.capturedAt));
  const selected = [rows.find((row) => row.publicId === from), rows.find((row) => row.publicId === to)].filter((row): row is NonNullable<typeof row> => Boolean(row)).toSorted((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  if (selected.length !== 2) return new Response("Avaliação não encontrada", { status: 404 });
  const initial = assessmentPoint(selected[0]);
  const current = assessmentPoint(selected[1]);
  const trajectory = rows.filter((row) => row.capturedAt >= selected[0].capturedAt && row.capturedAt <= selected[1].capturedAt).map(assessmentPoint);
  const [initialPhotos, currentPhotos, logoBytes] = await Promise.all([
    loadAssessmentPhotos(client.email, initial.capturedAt),
    loadAssessmentPhotos(client.email, current.capturedAt),
    loadReportLogo(request),
  ]);
  const bytes = await buildClinicalEvolutionReportPdf({ patientName: client.name, nutritionistName: NUTRITIONIST.name, nutritionistRegistration: NUTRITIONIST.registration, initial, current, trajectory, initialPhotos, currentPhotos, logoBytes });
  return pdfResponse(bytes, `evolucao-clinica-${client.id}-${initial.capturedAt.slice(0, 10)}-${current.capturedAt.slice(0, 10)}.pdf`);
}
