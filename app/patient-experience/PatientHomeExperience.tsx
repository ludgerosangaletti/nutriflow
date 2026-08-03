import Link from "next/link";

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
  nextAppointment?: Date | null;
  appointmentLocation?: string | null;
  currentProtocol?: boolean;
  photosCount?: number;
};

function firstName(name: string) { return name.trim().split(/\s+/)[0] || "Paciente"; }

export function PatientHomeExperience({
  name, modality, planLabel, active, action, structuredPlanEnabled, documentsCount,
  checkInsCount, checkInDone, nextAppointment, appointmentLocation, currentProtocol, photosCount = 0,
}: Props) {
  const today = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const appointment = nextAppointment
    ? new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(nextAppointment)
    : null;

  return (
    <main className="nf-home-screen">
      <p className="nf-eyebrow">{today}</p>
      <h2 className="nf-home-title">Olá, {firstName(name)} <span aria-hidden="true">👋</span></h2>
      <p className="nf-home-intro">
        {modality === "in_person" ? "Seu acompanhamento presencial, organizado também no ambiente digital." : "Seu acompanhamento nutricional, organizado para o seu dia."}
      </p>

      {appointment ? (
        <section className="nf-card nf-card-dark nf-appointment-card">
          <p className="nf-eyebrow">Próxima consulta</p>
          <strong>{appointment}</strong>
          <span>{appointmentLocation || "Guarapuava — PR"}</span>
          <b>Presencial</b>
        </section>
      ) : null}

      <section className="nf-card nf-card-lime nf-action-card">
        <p className="nf-eyebrow">{action.eyebrow}</p>
        <h3>{action.title}</h3>
        <p>{action.description}</p>
        {action.href && action.button ? <Link className="nf-btn nf-btn-dark" href={action.href}>{action.button}</Link> : null}
      </section>

      <section className="nf-card nf-card-dark nf-constancy-card">
        <p className="nf-eyebrow">Seu acompanhamento</p>
        <div><strong>{checkInsCount}</strong><span> check-in(s) registrado(s)</span></div>
        <p>{active ? "Você tem mantido seu acompanhamento ativo." : "Aguarde a liberação do seu acompanhamento."}</p>
        <div className="nf-progress"><i style={{ width: `${Math.min(100, checkInsCount * 20)}%` }} /></div>
        <small>{planLabel} · {active ? "acesso ativo" : "aguardando liberação"}</small>
      </section>

      <section className="nf-card nf-card-paper nf-resource-card">
        <p className="nf-eyebrow">Ação desta semana</p>
        <h3>{checkInDone ? "Check-in enviado" : "Seu check-in está disponível"}</h3>
        <p>{checkInDone ? "Seu registro foi recebido e ficará disponível para acompanhamento." : "Leva cerca de 3 minutos e ajuda a orientar os próximos ajustes."}</p>
        <Link className="nf-btn nf-btn-plain" href="/check-in">{checkInDone ? "Ver check-in" : "Responder agora"}</Link>
      </section>

      <section className="nf-home-links" aria-label="Recursos principais">
        {structuredPlanEnabled ? <Link href="/plano-alimentar"><span>Plano alimentar</span><b>Abrir plano →</b></Link> : null}
        <Link href="/documentos"><span>Documentos e protocolos</span><b>{documentsCount ? `${documentsCount} arquivo(s)` : "Acessar →"}</b></Link>
        <Link href="/evolucao"><span>Evolução fotográfica</span><b>{photosCount ? `${photosCount} foto(s)` : "Opcional →"}</b></Link>
        {currentProtocol ? <Link href="/ajustes"><span>Solicitações de ajustes</span><b>Falar com Ludgero →</b></Link> : null}
      </section>
    </main>
  );
}
