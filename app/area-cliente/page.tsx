import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { getDb } from "../../db";
import {
  adjustmentRequests,
  anamneses,
  checkIns,
  clients,
  goals,
  nfPublications,
  patientDocuments,
  progressPhotos,
} from "../../db/schema";
import { hasActiveAccess } from "../access";
import { isPlanId, plans } from "../plans";
import { requirePatient } from "../supabase/server";
import {
  canUseNutriFlowPatientPortal,
  createNutriFlowPatientRuntime,
  resolveNutriFlowPatientContext,
} from "../nutriflow/server";
import AccessCountdown from "./access-countdown";
import { PatientShell } from "../patient-experience/shell/PatientShell";
import { PatientHomeExperience } from "../patient-experience/PatientHomeExperience";
import { isWeeklyCheckInAvailable } from "../check-in/availability";

export const dynamic = "force-dynamic";

function currentWeekStart(date = new Date()) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() - day + 1);
  return utc.toISOString().slice(0, 10);
}

type AnamnesisAnswers = Record<string, string | boolean>;

function numberFromAnswer(value: unknown) {
  if (typeof value !== "string") return Number.NaN;
  return Number(value.trim().replace(",", "."));
}

function ageFromBirthDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const birthDate = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const birthdayOccurred =
    today.getUTCMonth() > birthDate.getUTCMonth() ||
    (today.getUTCMonth() === birthDate.getUTCMonth() &&
      today.getUTCDate() >= birthDate.getUTCDate());
  if (!birthdayOccurred) age -= 1;
  return age;
}

function bmiClassification(bmi: number) {
  if (bmi < 18.5) return "Baixo peso";
  if (bmi < 25) return "Peso adequado";
  if (bmi < 30) return "Sobrepeso";
  if (bmi < 35) return "Obesidade grau I";
  if (bmi < 40) return "Obesidade grau II";
  return "Obesidade grau III";
}

export default async function ClientArea() {
  const user = await requirePatient("/area-cliente");
  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.authUserId, user.id))
    .limit(1);

  if (!client) {
    return (
      <main className="portal-shell">
        <header className="portal-header">
          <Link className="portal-brand" href="/">Ludgero Sangaletti</Link>
          <form action="/auth/sair" method="post"><button className="auth-signout" type="submit">Sair</button></form>
        </header>
        <section className="empty-state">
          <p className="section-kicker">Área do Paciente</p>
          <h1>Seu cadastro ainda não foi iniciado.</h1>
          <p>Escolha um plano para começar a consultoria.</p>
          <Link className="button button-dark" href="/#comprar">Conhecer os planos</Link>
        </section>
      </main>
    );
  }

  const [documents, patientCheckIns, patientGoals, patientAdjustments, photos, patientAnamneses] =
    await Promise.all([
      db.select().from(patientDocuments).where(eq(patientDocuments.clientEmail, client.email)),
      db.select().from(checkIns).where(eq(checkIns.clientEmail, client.email)),
      db.select().from(goals).where(eq(goals.clientEmail, client.email)),
      db.select().from(adjustmentRequests).where(eq(adjustmentRequests.clientEmail, client.email)),
      db.select().from(progressPhotos).where(eq(progressPhotos.clientEmail, client.email)),
      db.select().from(anamneses).where(eq(anamneses.clientEmail, client.email)),
    ]);

  const active = hasActiveAccess(client);
  const checkInAvailableToday = isWeeklyCheckInAvailable();
  const currentDocuments = documents.filter((document) => document.isCurrent);
  const nutriFlowContext = await resolveNutriFlowPatientContext(user.id);
  const structuredPlanPublished = Boolean((await db
    .select({ id: nfPublications.id })
    .from(nfPublications)
    .where(and(eq(nfPublications.clientId, client.id), eq(nfPublications.status, "active")))
    .limit(1))[0]);
  const protocolAvailable = currentDocuments.length > 0 || structuredPlanPublished;
  const structuredPlanEnabled = Boolean(
    nutriFlowContext && (await canUseNutriFlowPatientPortal(nutriFlowContext)),
  );
  const training = nutriFlowContext && active
    ? (await createNutriFlowPatientRuntime().getTraining.execute({ actor: nutriFlowContext.actor, organizationId: nutriFlowContext.organizationId, organizationPublicId: nutriFlowContext.organizationPublicId })).card
    : { state: "commercial" as const, title: "Treino" as const, subtitle: "Contrate seu treino personalizado" as const };
  if (client.modality === "in_person" && !client.profileCompletedAt) {
    redirect("/primeiro-acesso");
  }

  if (client.modality === "in_person") {
    const currentProtocol = currentDocuments.find(
      (document) => document.documentType === "protocol",
    );
    const currentAssessment = currentDocuments.find(
      (document) => document.documentType === "physical_assessment",
    );
    const openAdjustment = patientAdjustments.find(
      (item) => !["adjusted", "closed"].includes(item.status),
    );
    const answeredAdjustment = patientAdjustments.find(
      (item) => item.status === "answered",
    );
    const checkInDoneThisWeek = patientCheckIns.some(
      (item) => item.weekStart === currentWeekStart(),
    );
    const nextAppointment =
      client.nextAppointmentAt &&
      // Server-rendered request time; it is not reused as client state.
      // eslint-disable-next-line react-hooks/purity
      new Date(client.nextAppointmentAt).getTime() > Date.now()
        ? new Date(client.nextAppointmentAt)
        : null;
    const nextAction = (() => {
      if (!active) {
        return {
          eyebrow: "Acesso encerrado",
          title: "Fale com o nutricionista",
          description:
            "A vigência do seu acompanhamento terminou. Entre em contato para organizar a continuidade.",
          href: "https://wa.me/5542999889176",
          button: "Conversar pelo WhatsApp",
        };
      }
      if (answeredAdjustment) {
        return {
          eyebrow: "Nova orientação disponível",
          title: "Confira a resposta à sua solicitação",
          description:
            "Sua solicitação foi analisada e já possui uma orientação disponível.",
          href: "/ajustes",
          button: "Ver resposta",
        };
      }
      if (!currentProtocol && !structuredPlanPublished) {
        return {
          eyebrow: "Após o atendimento",
          title: "Seu protocolo está sendo preparado",
          description:
            "Assim que o documento for publicado, ele aparecerá aqui e você será avisado.",
          href: "/documentos",
          button: "Ver documentos",
        };
      }
      if (!checkInDoneThisWeek && checkInAvailableToday) {
        return {
          eyebrow: patientCheckIns.length ? "Ação desta semana" : "Acompanhamento",
          title: patientCheckIns.length
            ? "Envie seu check-in"
            : "Faça seu primeiro check-in",
          description:
            "O registro ajuda a organizar dificuldades e necessidades entre as consultas.",
          href: "/check-in",
          button: "Responder check-in",
        };
      }
      return {
        eyebrow: "Tudo em dia",
        title: nextAppointment ? "Sua próxima consulta está agendada" : "Acompanhamento atualizado",
        description: nextAppointment
          ? `O próximo encontro será em ${new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "long",
              timeStyle: "short",
              timeZone: "America/Sao_Paulo",
            }).format(nextAppointment)}.`
          : "Seus registros estão atualizados. Consulte seus documentos quando precisar.",
        href: "/documentos",
        button: "Abrir documentos",
      };
    })();

    return (
      <PatientShell>
        <PatientHomeExperience
          name={client.name}
          modality="in_person"
          planLabel={client.plan}
          active={active}
          action={nextAction}
          structuredPlanEnabled={structuredPlanEnabled}
          documentsCount={currentDocuments.length}
          checkInsCount={patientCheckIns.length}
          checkInDone={checkInDoneThisWeek}
          checkInAvailable={checkInAvailableToday}
          nextAppointment={nextAppointment}
          appointmentLocation={client.appointmentLocation}
          currentProtocol={Boolean(currentProtocol || structuredPlanPublished)}
          photosCount={photos.length}
          training={training}
        />
      </PatientShell>
    );

    /* legacy dashboard retained below for rollback during homologation */
    return (
      <PatientShell><main className="portal-shell patient-home in-person-home nf-experience-page">
        <header className="portal-header">
          <Link className="portal-brand" href="/">Ludgero Sangaletti</Link>
          <form action="/auth/sair" method="post">
            <button className="auth-signout" type="submit">Sair</button>
          </form>
        </header>
        <section className="dashboard patient-dashboard">
          <header className="patient-welcome">
            <div>
              <p className="section-kicker">Área do Paciente · Presencial</p>
              <h1>Olá, {client.name.split(" ")[0]}.</h1>
              <p>Seu acompanhamento presencial, organizado também no ambiente digital.</p>
            </div>
            <div className={`patient-plan-status ${!active ? "is-expired" : ""}`}>
              <span>Atendimento presencial · {client.plan}</span>
              <strong>{active ? "Acompanhamento ativo" : "Vigência encerrada"}</strong>
            </div>
          </header>

          {nextAppointment ? (
            <section className="in-person-appointment">
              <div>
                <span>Próxima consulta</span>
                <strong>
                  {new Intl.DateTimeFormat("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "America/Sao_Paulo",
                  }).format(nextAppointment)}
                </strong>
                <p>{client.appointmentLocation || "Guarapuava — PR"}</p>
              </div>
              <b>Presencial</b>
            </section>
          ) : null}

          <section className="patient-next-action">
            <div className="next-action-number" aria-hidden="true">→</div>
            <div>
              <span>{nextAction.eyebrow}</span>
              <h2>{nextAction.title}</h2>
              <p>{nextAction.description}</p>
            </div>
            <Link className="button patient-action-button" href={nextAction.href}>
              {nextAction.button}
            </Link>
          </section>

          {active && client.accessStartedAt && client.accessExpiresAt ? (
            <AccessCountdown
              expiresAt={client.accessExpiresAt}
              startedAt={client.accessStartedAt}
            />
          ) : null}

          <section className="patient-section-heading">
            <div>
              <span>Seu acompanhamento</span>
              <h2>Informações e recursos principais</h2>
            </div>
            <p>Use este espaço entre as consultas sempre que precisar.</p>
          </section>

          <div className="patient-primary-grid in-person-resource-grid">
            {structuredPlanEnabled ? (
              <Link className="patient-feature-card is-priority" href="/plano-alimentar">
                <span>NutriFlow · Plano interativo</span>
                <strong>Seu plano alimentar no dia a dia</strong>
                <p>Navegue por dias, refeições, receitas e orientações.</p>
                <b>Abrir plano →</b>
              </Link>
            ) : null}
            <Link className="patient-feature-card" href="/documentos">
              <span>01 · Protocolo alimentar</span>
              <strong>{currentProtocol ? "Disponível para download" : "Em elaboração"}</strong>
              <p>Acesse a versão mais recente da sua estratégia alimentar.</p>
              <b>Abrir protocolo →</b>
            </Link>
            <Link className="patient-feature-card" href="/documentos">
              <span>02 · Avaliação física</span>
              <strong>{currentAssessment ? "Arquivo disponível" : "Aguardando publicação"}</strong>
              <p>Consulte o PDF disponibilizado após sua avaliação presencial.</p>
              <b>Ver avaliação →</b>
            </Link>
            <Link
              className={`patient-feature-card ${!checkInDoneThisWeek && checkInAvailableToday ? "is-priority" : ""}`}
              href="/check-in"
            >
              <span>03 · Check-in periódico</span>
              <strong>{checkInDoneThisWeek ? "Enviado nesta semana" : checkInAvailableToday ? "Disponível hoje" : "Abre na segunda-feira"}</strong>
              <p>{patientCheckIns.length} check-in(s) registrado(s).</p>
              <b>Acessar check-in →</b>
            </Link>
            <Link className="patient-feature-card" href="/ajustes">
              <span>04 · Solicitação de ajustes</span>
              <strong>{openAdjustment ? "Solicitação em andamento" : "Nenhuma solicitação aberta"}</strong>
              <p>Organize dúvidas e dificuldades entre os atendimentos.</p>
              <b>Acessar ajustes →</b>
            </Link>
          </div>

          <section className="patient-section-heading patient-resources-heading">
            <div>
              <span>Registro opcional</span>
              <h2>Fotos de acompanhamento</h2>
            </div>
          </section>
          <nav className="patient-resource-list" aria-label="Recursos presenciais">
            <Link href="/evolucao">
              <div>
                <span>Registro fotográfico opcional</span>
                <strong>
                  {photos.length
                    ? `${Map.groupBy(photos, (photo) => photo.period).size} período(s) registrado(s)`
                    : "Nenhuma foto enviada"}
                </strong>
              </div>
              <b>Acessar fotos →</b>
            </Link>
          </nav>
        </section>
      </main></PatientShell>
    );
  }

  const activeGoals = patientGoals.filter((goal) => goal.status === "active");
  const openAdjustment = patientAdjustments.find((item) => !["adjusted", "closed"].includes(item.status));
  const answeredAdjustment = patientAdjustments.find((item) => item.status === "answered");
  const checkInDoneThisWeek = patientCheckIns.some((item) => item.weekStart === currentWeekStart());

  const milestones = [
    { label: "Pagamento", done: client.paymentStatus === "approved" },
    { label: "Anamnese", done: client.formStatus === "submitted" },
    { label: "Protocolo", done: protocolAvailable },
    { label: "Acompanhamento", done: patientCheckIns.length > 0 },
  ];
  const milestonesDone = milestones.filter((item) => item.done).length;
  const progressPercent = milestonesDone * 25;
  const submittedAnamnesis = patientAnamneses.find((item) => item.status === "submitted");
  let initialIndicators:
    | {
        bmi: number;
        classification: string | null;
        heightCm: number;
        weightKg: number;
        referenceDate: string;
        reason: string | null;
      }
    | null = null;
  if (submittedAnamnesis) {
    try {
      const answers = JSON.parse(submittedAnamnesis.answersJson) as AnamnesisAnswers;
      const heightCm = numberFromAnswer(answers.height);
      const weightKg = numberFromAnswer(answers.weight);
      const age = ageFromBirthDate(answers.birthDate);
      const pregnancyContext = [answers.diagnoses, answers.additionalNotes]
        .filter((value): value is string => typeof value === "string")
        .join(" ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const pregnancyReported = /\b(gestante|gravida|gravidez|gestacao)\b/.test(
        pregnancyContext,
      );
      if (
        Number.isFinite(heightCm) &&
        Number.isFinite(weightKg) &&
        heightCm >= 120 &&
        heightCm <= 230 &&
        weightKg >= 30 &&
        weightKg <= 350
      ) {
        const bmi = weightKg / ((heightCm / 100) ** 2);
        const reason =
          age !== null && age < 18
            ? "A classificação adulta do IMC não é aplicada a menores de 18 anos."
            : pregnancyReported
              ? "Durante a gestação, o IMC precisa ser interpretado por critérios específicos."
              : null;
        initialIndicators = {
          bmi,
          classification: reason ? null : bmiClassification(bmi),
          heightCm,
          weightKg,
          referenceDate:
            submittedAnamnesis.submittedAt || submittedAnamnesis.updatedAt,
          reason,
        };
      }
    } catch {
      initialIndicators = null;
    }
  }

  const nextAction = (() => {
    if (client.paymentStatus !== "approved") {
      return {
        eyebrow: "Aguardando liberação",
        title: "Confirmação do pagamento",
        description: "Assim que a compra for conferida, sua anamnese e os recursos da consultoria serão liberados.",
        href: null,
        button: null,
      };
    }
    if (!active) {
      return {
        eyebrow: "Seu ciclo foi concluído",
        title: "Renovar o acompanhamento",
        description: "Escolha um novo plano para retomar a assessoria e manter o acesso aos seus recursos.",
        href: "/#comprar",
        button: "Ver planos",
      };
    }
    if (client.formStatus !== "submitted") {
      return {
        eyebrow: "Primeira prioridade",
        title: client.formStatus === "draft" ? "Concluir sua anamnese" : "Preencher sua anamnese",
        description: "Essas respostas são essenciais para a elaboração de uma estratégia alimentar individualizada.",
        href: "/anamnese",
        button: client.formStatus === "draft" ? "Continuar preenchimento" : "Começar agora",
      };
    }
    if (!protocolAvailable) {
      return {
        eyebrow: "Em análise profissional",
        title: "Seu protocolo está sendo elaborado",
        description: "Sua anamnese foi recebida. Você será avisado por e-mail quando o material estiver disponível.",
        href: "/linha-do-tempo",
        button: "Acompanhar minha jornada",
      };
    }
    if (answeredAdjustment) {
      return {
        eyebrow: "Nova orientação disponível",
        title: "Confira a resposta ao seu ajuste",
        description: "Sua solicitação foi analisada e já possui uma orientação do nutricionista.",
        href: "/ajustes",
        button: "Ver resposta",
      };
    }
    if (!checkInDoneThisWeek && checkInAvailableToday) {
      return {
        eyebrow: patientCheckIns.length ? "Ação desta semana" : "Comece o acompanhamento",
        title: patientCheckIns.length ? "Envie seu check-in semanal" : "Faça seu primeiro check-in",
        description: "Leva cerca de 3 minutos e permite ajustar a estratégia com base na sua rotina real.",
        href: "/check-in",
        button: patientCheckIns.length ? "Responder check-in" : "Fazer primeiro check-in",
      };
    }
    if (activeGoals.length) {
      return {
        eyebrow: "Check-in da semana concluído",
        title: "Acompanhe suas metas",
        description: "Registre uma nova medida ou evolução quando houver atualização em um dos seus objetivos.",
        href: "/metas",
        button: "Ver minhas metas",
      };
    }
    return {
      eyebrow: "Tudo em dia",
      title: "Acompanhe sua evolução",
      description: "Seus registros estão atualizados. Consulte as tendências construídas ao longo da consultoria.",
      href: "/graficos",
      button: "Ver meus gráficos",
    };
  })();

  return (
    <PatientShell>
      <PatientHomeExperience
        name={client.name}
        modality="online"
        planLabel={isPlanId(client.plan) ? plans[client.plan].name : client.plan}
        active={active}
        action={nextAction}
        structuredPlanEnabled={structuredPlanEnabled}
        documentsCount={currentDocuments.length}
        checkInsCount={patientCheckIns.length}
        checkInDone={checkInDoneThisWeek}
        checkInAvailable={checkInAvailableToday}
        currentProtocol={protocolAvailable}
        photosCount={photos.length}
        training={training}
      />
    </PatientShell>
  );

  /* legacy dashboard retained below for rollback during homologation */
  return (
    <PatientShell><main className="portal-shell patient-home nf-experience-page">
      <header className="portal-header">
        <Link className="portal-brand" href="/">Ludgero Sangaletti</Link>
        <form action="/auth/sair" method="post"><button className="auth-signout" type="submit">Sair</button></form>
      </header>

      <section className="dashboard patient-dashboard">
        <header className="patient-welcome">
          <div>
            <p className="section-kicker">Área do Paciente</p>
            <h1>Olá, {client.name.split(" ")[0]}.</h1>
            <p>Seu acompanhamento, organizado para você saber exatamente o que fazer.</p>
          </div>
          <div className={`patient-plan-status ${client.paymentStatus === "approved" && !active ? "is-expired" : ""}`}>
            <span>{isPlanId(client.plan) ? plans[client.plan].name : client.plan}</span>
            <strong>{active ? "Acompanhamento ativo" : client.paymentStatus === "approved" ? "Vigência encerrada" : "Pagamento em análise"}</strong>
          </div>
        </header>

        <section className="patient-next-action">
          <div className="next-action-number" aria-hidden="true">→</div>
          <div>
            <span>{nextAction.eyebrow}</span>
            <h2>{nextAction.title}</h2>
            <p>{nextAction.description}</p>
          </div>
          {nextAction.href && nextAction.button ? (
            <Link className="button patient-action-button" href={nextAction.href}>{nextAction.button}</Link>
          ) : (
            <span className="patient-waiting-badge">Você será avisado por e-mail</span>
          )}
        </section>

        <section className="patient-progress-overview">
          <div className="progress-ring" style={{ "--patient-progress": `${progressPercent * 3.6}deg` } as CSSProperties}>
            <div><strong>{progressPercent}%</strong><span>início concluído</span></div>
          </div>
          <div className="patient-progress-copy">
            <span>Progresso da jornada inicial</span>
            <h2>{milestonesDone === milestones.length ? "Acompanhamento em andamento" : `${milestonesDone} de ${milestones.length} etapas concluídas`}</h2>
            <p>Após as etapas iniciais, o acompanhamento continua por meio dos check-ins, metas e ajustes.</p>
          </div>
          <ol className="patient-milestones">
            {milestones.map((milestone, index) => (
              <li className={milestone.done ? "is-done" : ""} key={milestone.label}>
                <i>{milestone.done ? "✓" : index + 1}</i>
                <span>{milestone.label}</span>
              </li>
            ))}
          </ol>
        </section>

        {initialIndicators ? (
          <section className="patient-health-indicators" aria-labelledby="initial-indicators-title">
            <div className="patient-indicator-heading">
              <span>Indicadores iniciais</span>
              <h2 id="initial-indicators-title">Seu ponto de partida</h2>
              <p>
                Calculado automaticamente com os dados enviados na anamnese.
              </p>
            </div>
            <div className="patient-bmi-result">
              <span>IMC atual</span>
              <strong>{initialIndicators.bmi.toFixed(1).replace(".", ",")}</strong>
              <small>kg/m²</small>
            </div>
            <div className="patient-bmi-context">
              <span>Classificação</span>
              <strong>
                {initialIndicators.classification || "Avaliação individual necessária"}
              </strong>
              <p>
                {initialIndicators.weightKg.toLocaleString("pt-BR", {
                  maximumFractionDigits: 1,
                })}{" "}
                kg · {initialIndicators.heightCm.toLocaleString("pt-BR", {
                  maximumFractionDigits: 1,
                })}{" "}
                cm
              </p>
              <small>
                Referência:{" "}
                {new Intl.DateTimeFormat("pt-BR").format(
                  new Date(initialIndicators.referenceDate),
                )}
              </small>
            </div>
            <p className="patient-bmi-note">
              {initialIndicators.reason ||
                "O IMC é um indicador de triagem. Sua interpretação considera também composição corporal, rotina, objetivos e nível de treinamento — especialmente em pessoas com maior massa muscular."}
            </p>
          </section>
        ) : null}

        {active && client.accessStartedAt && client.accessExpiresAt ? (
          <AccessCountdown expiresAt={client.accessExpiresAt} startedAt={client.accessStartedAt} />
        ) : null}

        {client.paymentStatus === "approved" && !active ? (
          <section className="access-expired">
            <span>Vigência encerrada</span>
            <strong>Seu plano chegou ao fim.</strong>
            <p>O acesso à assessoria e aos materiais foi pausado. Escolha um novo plano para continuar o acompanhamento.</p>
            <Link className="button button-dark" href="/#comprar">Renovar meu plano</Link>
          </section>
        ) : null}

        {active ? (
          <>
            <section className="patient-section-heading">
              <div><span>Acompanhamento</span><h2>Seu cuidado no dia a dia</h2></div>
              <p>Os recursos mais importantes para manter a estratégia atualizada.</p>
            </section>
            <div className="patient-primary-grid">
              {structuredPlanEnabled ? (
                <Link className="patient-feature-card is-priority" href="/plano-alimentar">
                  <span>NutriFlow · Plano interativo</span>
                  <strong>Seu plano alimentar no dia a dia</strong>
                  <p>Navegue por dias, refeições, receitas e orientações.</p>
                  <b>Abrir plano →</b>
                </Link>
              ) : null}
              <Link className="patient-feature-card" href="/documentos">
                <span>01 · Protocolo e materiais</span>
                <strong>{currentDocuments.length ? `${currentDocuments.length} arquivo(s) atual(is)` : "Em elaboração"}</strong>
                <p>Acesse sua estratégia alimentar e os materiais auxiliares.</p>
                <b>Abrir documentos →</b>
              </Link>
              <Link className={`patient-feature-card ${!checkInDoneThisWeek && checkInAvailableToday ? "is-priority" : ""}`} href="/check-in">
                <span>02 · Check-in semanal</span>
                <strong>{checkInDoneThisWeek ? "Enviado nesta semana" : checkInAvailableToday ? "Disponível hoje" : "Abre na segunda-feira"}</strong>
                <p>{patientCheckIns.length} check-in(s) registrado(s) no acompanhamento.</p>
                <b>Acessar check-in →</b>
              </Link>
              <Link className="patient-feature-card" href="/metas">
                <span>03 · Metas em conjunto</span>
                <strong>{activeGoals.length ? `${activeGoals.length} meta(s) ativa(s)` : "Aguardando definição"}</strong>
                <p>Acompanhe objetivos e registre sua evolução.</p>
                <b>Ver metas →</b>
              </Link>
              <Link className="patient-feature-card" href="/ajustes">
                <span>04 · Solicitação de ajustes</span>
                <strong>{openAdjustment ? "Solicitação em andamento" : "Nenhuma solicitação aberta"}</strong>
                <p>Relate dificuldades de maneira organizada quando necessário.</p>
                <b>Acessar ajustes →</b>
              </Link>
            </div>

            <section className="patient-section-heading patient-resources-heading">
              <div><span>Histórico e evolução</span><h2>Veja o que já foi construído</h2></div>
            </section>
            <nav className="patient-resource-list" aria-label="Recursos de evolução">
              <Link href="/graficos"><div><span>Evolução em gráficos</span><strong>Peso, rotina, sintomas e metas</strong></div><b>Ver gráficos →</b></Link>
              <Link href="/evolucao"><div><span>Registro fotográfico opcional</span><strong>{photos.length ? `${Map.groupBy(photos, (photo) => photo.period).size} período(s) registrado(s)` : "Nenhuma foto enviada"}</strong></div><b>Acessar registros →</b></Link>
              <Link href="/linha-do-tempo"><div><span>Linha do tempo</span><strong>Sua jornada completa em ordem cronológica</strong></div><b>Ver jornada →</b></Link>
            </nav>
          </>
        ) : null}
      </section>
    </main></PatientShell>
  );
}
