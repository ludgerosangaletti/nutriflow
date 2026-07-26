import { eq } from "drizzle-orm";
import Link from "next/link";
import type { CSSProperties } from "react";
import { getDb } from "../../db";
import {
  adjustmentRequests,
  checkIns,
  clients,
  goals,
  patientDocuments,
  progressPhotos,
} from "../../db/schema";
import { hasActiveAccess } from "../access";
import { isPlanId, plans } from "../plans";
import { requirePatient } from "../supabase/server";
import AccessCountdown from "./access-countdown";

export const dynamic = "force-dynamic";

function currentWeekStart(date = new Date()) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() - day + 1);
  return utc.toISOString().slice(0, 10);
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

  const [documents, patientCheckIns, patientGoals, patientAdjustments, photos] =
    await Promise.all([
      db.select().from(patientDocuments).where(eq(patientDocuments.clientEmail, client.email)),
      db.select().from(checkIns).where(eq(checkIns.clientEmail, client.email)),
      db.select().from(goals).where(eq(goals.clientEmail, client.email)),
      db.select().from(adjustmentRequests).where(eq(adjustmentRequests.clientEmail, client.email)),
      db.select().from(progressPhotos).where(eq(progressPhotos.clientEmail, client.email)),
    ]);

  const active = hasActiveAccess(client);
  const currentDocuments = documents.filter((document) => document.isCurrent);
  const activeGoals = patientGoals.filter((goal) => goal.status === "active");
  const openAdjustment = patientAdjustments.find((item) => !["adjusted", "closed"].includes(item.status));
  const answeredAdjustment = patientAdjustments.find((item) => item.status === "answered");
  const checkInDoneThisWeek = patientCheckIns.some((item) => item.weekStart === currentWeekStart());

  const milestones = [
    { label: "Pagamento", done: client.paymentStatus === "approved" },
    { label: "Anamnese", done: client.formStatus === "submitted" },
    { label: "Protocolo", done: currentDocuments.length > 0 },
    { label: "Acompanhamento", done: patientCheckIns.length > 0 },
  ];
  const milestonesDone = milestones.filter((item) => item.done).length;
  const progressPercent = milestonesDone * 25;

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
    if (!currentDocuments.length) {
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
    if (!checkInDoneThisWeek) {
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
    <main className="portal-shell patient-home">
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
              <Link className="patient-feature-card" href="/documentos">
                <span>01 · Protocolo e materiais</span>
                <strong>{currentDocuments.length ? `${currentDocuments.length} arquivo(s) atual(is)` : "Em elaboração"}</strong>
                <p>Acesse sua estratégia alimentar e os materiais auxiliares.</p>
                <b>Abrir documentos →</b>
              </Link>
              <Link className={`patient-feature-card ${!checkInDoneThisWeek ? "is-priority" : ""}`} href="/check-in">
                <span>02 · Check-in semanal</span>
                <strong>{checkInDoneThisWeek ? "Enviado nesta semana" : "Preenchimento pendente"}</strong>
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
    </main>
  );
}
