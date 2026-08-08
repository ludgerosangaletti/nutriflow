import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { clients, nfClinicalAssessments } from "../../../../db/schema";
import { buildClinicalEvolutionReportPdf } from "../../../../modules/nutriflow/reports/professional-pdf.ts";
import { hasActiveAccess } from "../../../access";
import { assessmentPoint, loadAssessmentPhotos, loadReportLogo, NUTRITIONIST, pdfResponse } from "../../../nutriflow/reporting";
import { getPatientUser } from "../../../supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getPatientUser();
  if (!user) return new Response("Não autenticado", { status: 401 });
  const db = getDb();
  const [client] = await db.select().from(clients).where(eq(clients.authUserId, user.id)).limit(1);
  if (!client || !hasActiveAccess(client)) return new Response("Acompanhamento indisponível", { status: 403 });
  const rows = await db.select().from(nfClinicalAssessments).where(eq(nfClinicalAssessments.clientId, client.id)).orderBy(asc(nfClinicalAssessments.capturedAt));
  if (rows.length < 2) return new Response("O comparativo requer pelo menos duas avaliações", { status: 404 });
  const initial = assessmentPoint(rows[0]);
  const current = assessmentPoint(rows.at(-1)!);
  const [initialPhotos, currentPhotos, logoBytes] = await Promise.all([
    loadAssessmentPhotos(client.email, initial.capturedAt),
    loadAssessmentPhotos(client.email, current.capturedAt),
    loadReportLogo(request),
  ]);
  const bytes = await buildClinicalEvolutionReportPdf({ patientName: client.name, nutritionistName: NUTRITIONIST.name, nutritionistRegistration: NUTRITIONIST.registration, initial, current, trajectory: rows.map(assessmentPoint), initialPhotos, currentPhotos, logoBytes });
  return pdfResponse(bytes, `evolucao-clinica-${initial.capturedAt.slice(0, 10)}-${current.capturedAt.slice(0, 10)}.pdf`);
}
