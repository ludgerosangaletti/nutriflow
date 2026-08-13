import Link from "next/link";
import { requirePatient } from "../supabase/server";
import {
  canUseNutriFlowPatientPortal,
  createNutriFlowPatientRuntime,
  resolveNutriFlowPatientContext,
} from "../nutriflow/server";
import { loadRecipeSnapshots } from "../nutriflow/reporting";
import PatientPlanViewer from "./patient-plan-viewer";
import { PatientShell } from "../patient-experience/shell/PatientShell";

export const dynamic = "force-dynamic";

export default async function StructuredFoodPlanPage() {
  const user = await requirePatient("/plano-alimentar");
  const context = await resolveNutriFlowPatientContext(user.id);
  if (!context || !(await canUseNutriFlowPatientPortal(context))) {
    return <PatientShell><main className="portal-shell nutriflow-patient-page nf-experience-page"><section className="nf-plan-pending"><p className="section-kicker">Plano alimentar</p><h1>Seu plano está em desenvolvimento.</h1><p>Seu nutricionista está organizando sua estratégia alimentar com cuidado. Assim que a versão for publicada, ela aparecerá aqui automaticamente.</p><Link className="button button-dark" href="/area-cliente">Voltar ao início</Link></section></main></PatientShell>;
  }
  const portal = await createNutriFlowPatientRuntime().getPortal.execute({
    actor: context.actor,
    organizationId: context.organizationId,
    organizationPublicId: context.organizationPublicId,
    patientName: context.patientName,
    modality: context.modality,
  });
  const recipes = portal.plan ? await loadRecipeSnapshots(portal.plan, context.organizationId) : {};

  return (
    <PatientShell><main className="portal-shell nutriflow-patient-page nf-experience-page">
      <header className="portal-header">
        <Link className="portal-brand" href="/area-cliente">← Área do Paciente</Link>
        <form action="/auth/sair" method="post"><button className="auth-signout" type="submit">Sair</button></form>
      </header>
      <PatientPlanViewer portal={portal} recipes={recipes} validUntil={context.actor.entitlementEndsAt} />
    </main></PatientShell>
  );
}
