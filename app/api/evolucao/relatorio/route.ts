import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { clients, nfClinicalAssessments } from "../../../../db/schema";
import { buildClinicalAssessmentReportPdf } from "../../../../modules/nutriflow/reports/professional-pdf.ts";
import { hasActiveAccess } from "../../../access";
import { assessmentPoint, loadReportLogo, NUTRITIONIST, pdfResponse } from "../../../nutriflow/reporting";
import { getPatientUser } from "../../../supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getPatientUser();
  if (!user) return new Response("Não autenticado", { status: 401 });
  const db = getDb();
  const [client] = await db.select().from(clients).where(eq(clients.authUserId, user.id)).limit(1);
  if (!client || !hasActiveAccess(client)) return new Response("Acompanhamento indisponível", { status: 403 });
  const rows = await db.select().from(nfClinicalAssessments).where(and(eq(nfClinicalAssessments.clientId, client.id), eq(nfClinicalAssessments.organizationId, client.organizationId))).orderBy(asc(nfClinicalAssessments.capturedAt), asc(nfClinicalAssessments.id));
  if (!rows.length) return new Response("Nenhuma avaliação disponível", { status: 404 });
  const requested = new URL(request.url).searchParams.get("assessment")?.trim();
  const target = requested ? rows.find((row) => row.publicId === requested) : rows.at(-1);
  if (!target) return new Response("Avaliação não encontrada", { status: 404 });
  const bytes = await buildClinicalAssessmentReportPdf({ patientName: client.name, nutritionistName: NUTRITIONIST.name, nutritionistRegistration: NUTRITIONIST.registration, assessments: rows.map(assessmentPoint), targetAssessmentPublicId: target.publicId, logoBytes: await loadReportLogo(request) });
  return pdfResponse(bytes, `avaliacao-fisica-${target.capturedAt.slice(0, 10)}.pdf`);
}
