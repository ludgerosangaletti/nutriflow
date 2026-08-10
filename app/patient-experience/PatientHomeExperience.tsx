import Link from "next/link";
import type { TrainingPatientAccessStateV1 } from "../../modules/nutriflow/contracts/v1/training.ts";
import { QuickAccess } from "./QuickAccess";

type Action = { eyebrow: string; title: string; description: string; href: string | null; button: string | null };

type Props = {
  name: string;
  modality: "online" | "in_person" | string;
  planLabel: string;
  active: boolean;
  action: Action;
  structuredPlanEnabled?: boolean;
  documentsCount: number;
  checkInsCount: number;
  checkInDone: boolean;
  checkInAvailable?: boolean;
  nextAppointment?: Date | null;
  appointmentLocation?: string | null;
  currentProtocol?: boolean;
  photosCount?: number;
  training: TrainingPatientAccessStateV1;
};

function firstName(name: string) { return name.trim().split(/\s+/)[0] || "Paciente"; }

export function PatientHomeExperience({
  name, modality, planLabel, active, action, structuredPlanEnabled, documentsCount,
  checkInsCount, checkInDone, checkInAvailable = false, nextAppointment, appointmentLocation, currentProtocol, photosCount = 0, training,
}: Props) {
  const today = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const appointment = nextAppointment
    ? new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(nextAppointment)
    : null;

  return (
    <main className="nf-home-screen nf-home-v2">
      <header className="nf-home-greeting"><div><p className="nf-eyebrow">{today}</p><h2 className="nf-home-title">Olá, {firstName(name)}.</h2></div><span className={active ? "is-active" : ""}>{active ? "Ativo" : "Pendente"}</span></header>

      <section className="nf-home-overview">
        <div><small>{modality === "in_person" ? "Acompanhamento presencial" : "Consultoria online"}</small><strong>{planLabel}</strong></div>
        {appointment ? <div><small>Próxima consulta</small><strong>{appointment}</strong><span>{appointmentLocation || "Guarapuava — PR"}</span></div> : <div><small>Seu acompanhamento</small><strong>{checkInsCount} {checkInsCount === 1 ? "check-in registrado" : "check-ins registrados"}</strong></div>}
      </section>

      <section className="nf-card nf-card-lime nf-action-card">
        <p className="nf-eyebrow">{action.eyebrow}</p>
        <h3>{action.title}</h3>
        <p>{action.description}</p>
        {action.href && action.button ? <Link className="nf-btn nf-btn-dark" href={action.href}>{action.button}</Link> : null}
      </section>

      <QuickAccess training={training} structuredPlanEnabled={Boolean(structuredPlanEnabled)} documentsCount={documentsCount} checkInDone={checkInDone} checkInAvailable={checkInAvailable} photosCount={photosCount} />
      {currentProtocol ? <Link className="nf-home-adjustments" href="/ajustes">Solicitar ajuste ou falar com Ludgero <span>→</span></Link> : null}
    </main>
  );
}
