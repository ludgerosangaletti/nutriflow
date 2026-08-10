import { redirect } from "next/navigation";
import { PatientShell } from "../patient-experience/shell/PatientShell";
import { TrainingOfferPage } from "../patient-experience/TrainingOffer";
import { buildTrainingWhatsAppUrl } from "../patient-experience/training-offer";
import { createNutriFlowPatientRuntime, resolveNutriFlowPatientContext } from "../nutriflow/server";
import { requirePatient } from "../supabase/server";

export const dynamic = "force-dynamic";

export default async function TrainingInfoPage() {
  const user = await requirePatient("/treino-info");
  const context = await resolveNutriFlowPatientContext(user.id);
  if (!context) redirect("/area-cliente");

  const portal = await createNutriFlowPatientRuntime().getTraining.execute({
    actor: context.actor,
    organizationId: context.organizationId,
    organizationPublicId: context.organizationPublicId,
  });
  if (portal.card.state !== "commercial") redirect("/treino");

  const whatsappUrl = buildTrainingWhatsAppUrl({
    phone: process.env.NEXT_PUBLIC_WHATSAPP_ATENDIMENTO || "",
    patientFirstName: context.patientName.trim().split(/\s+/)[0],
    nutritionistName: "Ludgero",
  });

  return <PatientShell><TrainingOfferPage whatsappUrl={whatsappUrl} /></PatientShell>;
}
