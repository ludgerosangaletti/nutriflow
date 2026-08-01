import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePatient } from "../supabase/server";
import {
  canUseNutriFlowPatientPortal,
  createNutriFlowPatientRuntime,
  resolveNutriFlowPatientContext,
} from "../nutriflow/server";
import PatientPlanViewer from "./patient-plan-viewer";

export const dynamic = "force-dynamic";

export default async function StructuredFoodPlanPage() {
  const user = await requirePatient("/plano-alimentar");
  const context = await resolveNutriFlowPatientContext(user.id);
  if (!context || !(await canUseNutriFlowPatientPortal(context))) notFound();
  const portal = await createNutriFlowPatientRuntime().getPortal.execute({
    actor: context.actor,
    organizationId: context.organizationId,
    organizationPublicId: context.organizationPublicId,
    patientName: context.patientName,
    modality: context.modality,
  });

  return (
    <main className="portal-shell nutriflow-patient-page">
      <header className="portal-header">
        <Link className="portal-brand" href="/area-cliente">← Área do Paciente</Link>
        <form action="/auth/sair" method="post"><button className="auth-signout" type="submit">Sair</button></form>
      </header>
      <PatientPlanViewer portal={portal} />
    </main>
  );
}

