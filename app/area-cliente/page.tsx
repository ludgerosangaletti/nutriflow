import { eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "../../db";
import { checkIns, clients, goals, patientDocuments } from "../../db/schema";
import { hasActiveAccess } from "../access";
import { isPlanId, plans } from "../plans";
import { requirePatient } from "../supabase/server";
import AccessCountdown from "./access-countdown";

export const dynamic = "force-dynamic";

export default async function ClientArea() {
  const user = await requirePatient("/area-cliente");
  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.authUserId, user.id))
    .limit(1);
  const active = client ? hasActiveAccess(client) : false;
  const documents = client
    ? await db
        .select()
        .from(patientDocuments)
        .where(eq(patientDocuments.clientEmail, client.email))
    : [];
  const patientCheckIns = client
    ? await db.select().from(checkIns).where(eq(checkIns.clientEmail, client.email))
    : [];
  const patientGoals = client
    ? await db.select().from(goals).where(eq(goals.clientEmail, client.email))
    : [];

  return (
    <main className="portal-shell">
      <header className="portal-header">
        <Link className="portal-brand" href="/">Ludgero Sangaletti</Link>
        <form action="/auth/sair" method="post">
          <button className="auth-signout" type="submit">Sair</button>
        </form>
      </header>
      {!client ? (
        <section className="empty-state">
          <p className="section-kicker">Área do paciente</p>
          <h1>Seu cadastro ainda não foi iniciado.</h1>
          <p>Escolha um plano para começar a consultoria.</p>
          <Link className="button button-dark" href="/#comprar">Conhecer os planos</Link>
        </section>
      ) : (
        <section className="dashboard">
          <div className="dashboard-heading">
            <div>
              <p className="section-kicker">Área do paciente</p>
              <h1>Olá, {client.name.split(" ")[0]}.</h1>
              <p>Acompanhe aqui as próximas etapas da sua consultoria.</p>
            </div>
            <div className={`status-card ${client.paymentStatus === "approved" && !active ? "status-expired" : `status-${client.paymentStatus}`}`}>
              <span>Status do pagamento</span>
              <strong>
                {client.paymentStatus === "approved"
                  ? active
                    ? "Pagamento confirmado"
                    : "Vigência encerrada"
                  : "Aguardando confirmação"}
              </strong>
            </div>
          </div>
          {active && client.accessStartedAt && client.accessExpiresAt ? (
            <AccessCountdown
              expiresAt={client.accessExpiresAt}
              startedAt={client.accessStartedAt}
            />
          ) : null}
          {client.paymentStatus === "approved" && !active ? (
            <section className="access-expired">
              <span>Vigência encerrada</span>
              <strong>Seu plano chegou ao fim.</strong>
              <p>
                O acesso à assessoria e aos materiais foi pausado. Escolha um
                novo plano para continuar o acompanhamento.
              </p>
              <Link className="button button-dark" href="/#comprar">
                Renovar meu plano
              </Link>
            </section>
          ) : null}
          <div className="dashboard-grid">
            <article className="dashboard-card">
              <span>Plano contratado</span>
              <strong>
                {isPlanId(client.plan) ? plans[client.plan].name : client.plan}
              </strong>
              <p>
                {active
                  ? "Sua assessoria e o acesso aos recursos permanecem disponíveis durante a vigência deste plano."
                  : "Após pagar, a confirmação poderá levar algum tempo. A vigência começa assim que o pagamento for confirmado."}
              </p>
            </article>
            <article className="dashboard-card dashboard-card-accent">
              <span>Próxima etapa</span>
              {active ? (
                <>
                  <strong>Preencher a anamnese</strong>
                  <p>
                    Responda com atenção. Suas informações serão usadas para a
                    elaboração da estratégia alimentar.
                  </p>
                  <Link className="button button-dark" href="/anamnese">
                    {client.formStatus === "draft"
                      ? "Continuar anamnese"
                      : client.formStatus === "submitted"
                        ? "Ver confirmação"
                        : "Começar anamnese"}
                  </Link>
                </>
              ) : (
                <>
                  <strong>
                    {client.paymentStatus === "approved"
                      ? "Renovar acompanhamento"
                      : "Confirmação do pagamento"}
                  </strong>
                  <p>
                    {client.paymentStatus === "approved"
                      ? "Escolha um novo plano para retomar a assessoria e o acesso aos recursos."
                      : "Se você já concluiu a compra na TON, aguarde a validação para acessar o questionário da consultoria."}
                  </p>
                </>
              )}
            </article>
            {active ? <article className="dashboard-card progress-dashboard-card">
              <span>Acompanhamento corporal</span>
              <strong>Registro fotográfico opcional</strong>
              <p>
                Se você se sentir confortável, envie fotos mensais de frente,
                lado e costas para comparar sua evolução.
              </p>
              <Link className="button button-dark" href="/evolucao">
                Acessar registros
              </Link>
            </article> : null}
            {active ? (
              <article className="dashboard-card checkin-dashboard-card">
                <span>Check-in periódico</span>
                <strong>Acompanhamento semanal</strong>
                <p>Conte como foram seus últimos sete dias. O preenchimento leva cerca de 3 minutos e ajuda a orientar os próximos ajustes.</p>
                <Link className="button button-dark" href="/check-in">{patientCheckIns.length ? "Ver e preencher check-in" : "Fazer primeiro check-in"}</Link>
              </article>
            ) : null}
            {active ? (
              <article className="dashboard-card documents-dashboard-card">
                <span>Protocolo e materiais</span>
                <strong>
                  {documents.length
                    ? `${documents.filter((document) => document.isCurrent).length} arquivo(s) disponível(is)`
                    : "Em elaboração"}
                </strong>
                <p>
                  Consulte e baixe seu protocolo alimentar e os materiais
                  auxiliares publicados durante a assessoria.
                </p>
                <Link className="button button-dark" href="/documentos">
                  Ver meus documentos
                </Link>
              </article>
            ) : null}
            {active ? (
              <article className="dashboard-card goals-dashboard-card">
                <span>Metas em conjunto</span>
                <strong>
                  {patientGoals.filter((goal) => goal.status === "active").length
                    ? `${patientGoals.filter((goal) => goal.status === "active").length} meta(s) em andamento`
                    : "Objetivos do acompanhamento"}
                </strong>
                <p>Acompanhe seus objetivos prioritários e registre cada evolução durante a consultoria.</p>
                <Link className="button button-dark" href="/metas">Ver minhas metas</Link>
              </article>
            ) : null}
          </div>
        </section>
      )}
    </main>
  );
}
