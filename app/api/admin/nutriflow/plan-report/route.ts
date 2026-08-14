import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { clients } from "../../../../../db/schema";
import { D1PatientPortalRepository } from "../../../../../modules/nutriflow/infrastructure/d1/d1-patient-portal-repository.ts";
import { buildPlanReportPdf, type PdfRenderTiming } from "../../../../../modules/nutriflow/reports/professional-pdf.ts";
import { attachPdfTimings, loadRecipeSnapshots, loadReportLogo, NUTRITIONIST, pdfResponse } from "../../../../nutriflow/reporting";
import { resolveNutriFlowAdminContext } from "../../../../nutriflow/server";
import { requireAdmin } from "../../../../supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const pipelineStartedAt = performance.now();
  const admin = await requireAdmin("/admin/clientes");
  const context = await resolveNutriFlowAdminContext(admin.id);
  if (!context) return new Response("Sem permissão", { status: 403 });
  const email = new URL(request.url).searchParams.get("email")?.trim();
  if (!email) return new Response("Paciente obrigatório", { status: 400 });
  const [client] = await getDb().select().from(clients).where(eq(clients.email, email)).limit(1);
  if (!client) return new Response("Paciente não encontrado", { status: 404 });
  const record = await new D1PatientPortalRepository(env.DB).findForPatient({
    organizationId: context.organizationId,
    organizationPublicId: context.organizationPublicId,
    clientId: client.id,
    patientName: client.name,
    modality: client.modality === "in_person" ? "in_person" : "online",
    now: new Date(),
  });
  if (!record.portal.plan) return new Response("Nenhum plano publicado", { status: 404 });
  const dataFinishedAt = performance.now();
  const assetsStartedAt = performance.now();
  const [recipes, logoBytes] = await Promise.all([loadRecipeSnapshots(record.portal.plan, context.organizationId), loadReportLogo(request)]);
  const assetLoadMs = performance.now() - assetsStartedAt;
  let documentTimings: PdfRenderTiming = Object.freeze({ assetsMs: 0, renderMs: 0, pdfMs: 0 });
  const bytes = await buildPlanReportPdf({
    patientName: client.name,
    nutritionistName: NUTRITIONIST.name,
    nutritionistRegistration: NUTRITIONIST.registration,
    validFrom: client.accessStartedAt,
    validUntil: client.accessExpiresAt,
    plan: record.portal.plan,
    recipes,
    logoBytes,
    onTiming: (timings) => { documentTimings = timings; },
  });
  const responseStartedAt = performance.now();
  const response = pdfResponse(bytes, `plano-alimentar-${client.id}-v${record.portal.plan.versionNumber}.pdf`);
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
