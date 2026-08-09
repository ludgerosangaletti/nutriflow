import Link from "next/link";
import { requirePatient } from "../supabase/server";
import { canUseNutriFlowFeature, createNutriFlowPatientRuntime, resolveNutriFlowPatientContext } from "../nutriflow/server";
import { NUTRIFLOW_FEATURE_FLAGS } from "../../modules/nutriflow/config/feature-flags";
import { PatientShell } from "../patient-experience/shell/PatientShell";
import TrainingPatientViewer from "./training-patient-viewer";

export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  const user = await requirePatient("/treino");
  const context = await resolveNutriFlowPatientContext(user.id);
  if (!context || !(await canUseNutriFlowFeature(context, context.actor.clientId, NUTRIFLOW_FEATURE_FLAGS.TRAINING))) return <PatientShell><main className="training-patient-screen"><section className="training-patient-rest"><h1>Treino indisponível</h1><p>Este recurso ainda não está disponível para a sua conta.</p><Link href="/area-cliente">Voltar ao início</Link></section></main></PatientShell>;
  const portal = await createNutriFlowPatientRuntime().getTraining.execute({ actor: context.actor, organizationId: context.organizationId, organizationPublicId: context.organizationPublicId });
  if (portal.card.state === "commercial") return <PatientShell><main className="training-patient-screen"><section className="training-patient-rest"><h1>Treino personalizado</h1><p>Converse com a equipe para contratar seu treino.</p><a href={`https://wa.me/5542999846280?text=${encodeURIComponent("Olá! Tenho interesse em contratar meu treino personalizado.")}`}>Falar no WhatsApp</a></section></main></PatientShell>;
  if (!portal.publication) return <PatientShell><main className="training-patient-screen"><section className="training-patient-rest"><p>NutriFlow Training</p><h1>Seu treino está sendo preparado</h1><p>Assim que a rotina for publicada, ela aparecerá aqui.</p><Link href="/area-cliente">Voltar ao início</Link></section></main></PatientShell>;
  return <PatientShell><TrainingPatientViewer portal={portal} /></PatientShell>;
}
