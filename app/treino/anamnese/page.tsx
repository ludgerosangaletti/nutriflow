import Link from "next/link";
import { redirect } from "next/navigation";
import { NUTRIFLOW_FEATURE_FLAGS } from "../../../modules/nutriflow/config/feature-flags.ts";
import { canUseNutriFlowFeature, createNutriFlowPatientRuntime, createTrainingAnamnesisRepository, resolveNutriFlowPatientContext } from "../../nutriflow/server.ts";
import { PatientShell } from "../../patient-experience/shell/PatientShell";
import { requirePatient } from "../../supabase/server.ts";
import TrainingAnamnesisForm from "./training-anamnesis-form";

export const dynamic = "force-dynamic";

export default async function TrainingAnamnesisPage() {
  const user = await requirePatient("/treino/anamnese");
  const context = await resolveNutriFlowPatientContext(user.id);
  if (!context || !(await canUseNutriFlowFeature(context, context.actor.clientId, NUTRIFLOW_FEATURE_FLAGS.TRAINING))) return <PatientShell><main className="training-patient-screen"><section className="training-patient-rest"><h1>Anamnese indisponível</h1><p>Este recurso ainda não está disponível para a sua conta.</p><Link href="/area-cliente">Voltar ao início</Link></section></main></PatientShell>;
  const portal = await createNutriFlowPatientRuntime().getTraining.execute({ actor: context.actor, organizationId: context.organizationId, organizationPublicId: context.organizationPublicId });
  if (portal.card.state === "commercial") redirect("/treino-info");
  const anamnesis = await createTrainingAnamnesisRepository().getEditableForPatient({ organizationId: context.organizationId, clientId: context.actor.clientId });
  return <PatientShell hideTabBar><TrainingAnamnesisForm initial={anamnesis} /></PatientShell>;
}
