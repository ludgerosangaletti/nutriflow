import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { clients } from "../../../../../db/schema";
import { buildPlanReportPdf, type PdfRenderTiming } from "../../../../../modules/nutriflow/reports/professional-pdf.ts";
import { attachPdfTimings, loadRecipeSnapshots, loadReportLogo, NUTRITIONIST, pdfResponse } from "../../../../nutriflow/reporting";
import { canUseNutriFlowPatientPortal, createNutriFlowPatientRuntime, resolveNutriFlowPatientContext } from "../../../../nutriflow/server";
import { getPatientUser } from "../../../../supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const pipelineStartedAt = performance.now();
  const user = await getPatientUser();
  if (!user) return new Response("Não autenticado", { status: 401 });
  const context = await resolveNutriFlowPatientContext(user.id);
  if (!context || !(await canUseNutriFlowPatientPortal(context))) return new Response("Plano indisponível", { status: 404 });
  const portal = await createNutriFlowPatientRuntime().getPortal.execute({ actor: context.actor, organizationId: context.organizationId, organizationPublicId: context.organizationPublicId, patientName: context.patientName, modality: context.modality });
  if (!portal.plan) return new Response("Nenhum plano publicado", { status: 404 });
  const strategyPublicId = new URL(request.url).searchParams.get("strategy");
  const selectedDays = strategyPublicId ? portal.plan.days.filter((day) => day.publicId === strategyPublicId) : portal.plan.days;
  if (!selectedDays.length) return new Response("Estratégia indisponível", { status: 404 });
  const plan = strategyPublicId ? Object.freeze({ ...portal.plan, days: Object.freeze(selectedDays) }) : portal.plan;
  const [client] = await getDb().select().from(clients).where(eq(clients.id, context.actor.clientId)).limit(1);
  if (!client) return new Response("Paciente não encontrado", { status: 404 });
  const dataFinishedAt = performance.now();
  const assetsStartedAt = performance.now();
  const [recipes, logoBytes] = await Promise.all([
    loadRecipeSnapshots(plan, context.organizationId),
    loadReportLogo(request),
  ]);
  const assetLoadMs = performance.now() - assetsStartedAt;
  let documentTimings: PdfRenderTiming = Object.freeze({ assetsMs: 0, renderMs: 0, pdfMs: 0 });
  const bytes = await buildPlanReportPdf({
    patientName: client.name,
    nutritionistName: NUTRITIONIST.name,
    nutritionistRegistration: NUTRITIONIST.registration,
    validFrom: client.accessStartedAt,
    validUntil: client.accessExpiresAt,
    plan,
    recipes,
    logoBytes,
    onTiming: (timings) => { documentTimings = timings; },
  });
  const responseStartedAt = performance.now();
  const response = pdfResponse(bytes, `plano-alimentar-v${portal.plan.versionNumber}.pdf`);
  const responseMs = performance.now() - responseStartedAt;
  return attachPdfTimings(response, {
    dataMs: dataFinishedAt - pipelineStartedAt,
    assetsMs: assetLoadMs + documentTimings.assetsMs,
    renderMs: documentTimings.renderMs,
    pdfMs: documentTimings.pdfMs,
    responseMs,
    totalMs: performance.now() - pipelineStartedAt,
  });
}
