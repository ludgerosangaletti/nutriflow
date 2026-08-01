import { desc, isNull } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "../../../db";
import {
  adjustmentRequests,
  anamneses,
  checkIns,
  clients,
  patientDocuments,
} from "../../../db/schema";
import { daysRemaining, hasActiveAccess } from "../../access";
import { requireAdmin } from "../../supabase/server";
import ApprovalButton from "./approval-button";
import InPersonInviteForm from "./in-person-invite-form";
import PatientResetPanel from "./patient-reset-panel";

export const dynamic = "force-dynamic";

function formatApprovalDate(value: string | null) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function formatWeekDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

export default async function AdminClients() {
  await requireAdmin("/admin/clientes");

  const rows = await getDb()
    .select()
    .from(clients)
    .where(isNull(clients.archivedAt))
    .orderBy(desc(clients.createdAt));
  const submittedAnamneses = (await getDb().select().from(anamneses)).filter(
    (anamnesis) => anamnesis.status === "submitted",
  );
  const currentProtocols = (await getDb().select().from(patientDocuments)).filter(
    (document) => document.documentType === "protocol" && document.isCurrent,
  );
  const newCheckIns = (await getDb().select().from(checkIns)).filter(
    (checkIn) => checkIn.adminStatus === "new",
  );
  const openAdjustments = (
    await getDb().select().from(adjustmentRequests)
  ).filter((adjustment) =>
    ["submitted", "analyzing"].includes(adjustment.status),
  );
  const clientByEmail = new Map(rows.map((client) => [client.email, client]));
  const protocolPatientEmails = new Set(
    currentProtocols.map((document) => document.clientEmail),
  );
  const anamnesesAwaitingProtocol = submittedAnamneses.filter(
    (anamnesis) =>
      clientByEmail.has(anamnesis.clientEmail) &&
      !protocolPatientEmails.has(anamnesis.clientEmail),
  );
  const checkInsAwaitingReview = newCheckIns.filter((checkIn) =>
    clientByEmail.has(checkIn.clientEmail),
  );
  const adjustmentsAwaitingAction = openAdjustments.filter((adjustment) =>
    clientByEmail.has(adjustment.clientEmail),
  );
  const activeClients = rows.filter((client) => hasActiveAccess(client)).length;
  const pendingPaymentClients = rows.filter(
    (client) =>
      client.paymentStatus !== "approved" && Boolean(client.purchaseStartedAt),
  );
  const expiringPlanClients = rows.filter((client) => {
    if (!hasActiveAccess(client) || !client.accessExpiresAt) return false;
    const remaining = daysRemaining(client.accessExpiresAt);
    return remaining >= 0 && remaining <= 7;
  });
  const actionCount =
    pendingPaymentClients.length +
    anamnesesAwaitingProtocol.length +
    checkInsAwaitingReview.length +
    adjustmentsAwaitingAction.length +
    expiringPlanClients.length;

  return (
    <main className="portal-shell">
      <header className="portal-header">
        <Link className="portal-brand" href="/">Gestão da consultoria</Link>
        <nav className="admin-header-actions" aria-label="Navegação administrativa">
          <Link href="/admin/integracoes/google-agenda">Google Agenda</Link>
          <Link href="/admin/leads">Leads do WhatsApp</Link>
          <form action="/auth/sair" method="post">
            <button className="auth-signout" type="submit">Sair</button>
          </form>
        </nav>
      </header>
      <section className="admin-panel">
        <div className="admin-hero">
          <div>
            <p className="section-kicker">Gestão da consultoria</p>
            <h1>Visão geral</h1>
            <p>Acompanhe o que precisa da sua atenção hoje.</p>
          </div>
          <aside className={actionCount ? "has-actions" : "is-clear"}>
            <span>Próxima ação</span>
            <strong>
              {actionCount
                ? `${actionCount} ${actionCount === 1 ? "item pendente" : "itens pendentes"}`
                : "Tudo em dia"}
            </strong>
            <a href="#central-acoes">
              {actionCount ? "Revisar pendências ↓" : "Ver central de ações ↓"}
            </a>
          </aside>
        </div>
        <div className="admin-summary-grid" aria-label="Indicadores da consultoria">
          <a href="#pacientes">
            <span>Cadastros totais</span>
            <strong>{rows.length}</strong>
            <small>Pacientes registrados</small>
          </a>
          <a href="#pacientes">
            <span>Pacientes ativos</span>
            <strong>{activeClients}</strong>
            <small>Com acesso vigente</small>
          </a>
          <a href="#pacientes">
            <span>Pagamentos pendentes</span>
            <strong>{pendingPaymentClients.length}</strong>
            <small>Aguardando conferência</small>
          </a>
          <a href="#pacientes">
            <span>Planos vencendo</span>
            <strong>{expiringPlanClients.length}</strong>
            <small>Nos próximos 7 dias</small>
          </a>
        </div>
        <section className="admin-action-center" id="central-acoes">
          <header className="admin-action-center-heading">
            <div>
              <span>Prioridades</span>
              <h2>Central de ações</h2>
              <p>Abra uma categoria para ver os pacientes que precisam de atenção.</p>
            </div>
            <strong>{actionCount} no total</strong>
          </header>
        <details
          className="admin-pending-section"
          id="pendencias-pagamento"
          open={pendingPaymentClients.length > 0}
        >
          <summary>
            <span className="admin-task-icon is-urgent" aria-hidden="true">!</span>
            <div>
              <span>Financeiro</span>
              <h3>Pagamentos para conferir</h3>
            </div>
            <strong>{pendingPaymentClients.length}</strong>
            <i aria-hidden="true">⌄</i>
          </summary>
          {pendingPaymentClients.length ? (
            <div className="admin-pending-list">
              {pendingPaymentClients.map((client) => (
                <article className="is-urgent" key={client.id}>
                  <i aria-hidden="true" />
                  <div>
                    <span>Pagamento</span>
                    <strong>Conferir compra de {client.name}</strong>
                    <p>
                      {client.plan} · compra informada em{" "}
                      {formatApprovalDate(client.purchaseStartedAt)}
                    </p>
                  </div>
                  <a href={`#paciente-${client.id}`}>Localizar cadastro →</a>
                </article>
              ))}
            </div>
          ) : (
            <div className="admin-all-clear">
              <strong>✓ Nenhum pagamento aguardando conferência</strong>
              <p>Novas compras aparecerão automaticamente nesta fila.</p>
            </div>
          )}
        </details>
        <details
          className="admin-pending-section"
          id="pendencias-anamnese"
          open={anamnesesAwaitingProtocol.length > 0}
        >
          <summary>
            <span className="admin-task-icon is-attention" aria-hidden="true">A</span>
            <div>
              <span>Atendimento</span>
              <h3>Anamneses aguardando protocolo</h3>
            </div>
            <strong>{anamnesesAwaitingProtocol.length}</strong>
            <i aria-hidden="true">⌄</i>
          </summary>
          {anamnesesAwaitingProtocol.length ? (
            <div className="admin-pending-list">
              {anamnesesAwaitingProtocol.map((anamnesis) => {
                const client = clientByEmail.get(anamnesis.clientEmail)!;
                return (
                  <article className="is-attention" key={anamnesis.id}>
                    <i aria-hidden="true" />
                    <div>
                      <span>Anamnese recebida</span>
                      <strong>Preparar protocolo de {client.name}</strong>
                      <p>
                        Enviada em{" "}
                        {formatApprovalDate(
                          anamnesis.submittedAt || anamnesis.updatedAt,
                        )}
                      </p>
                    </div>
                    <Link
                      href={`/admin/clientes/${encodeURIComponent(client.email)}#documentos`}
                    >
                      Abrir paciente →
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="admin-all-clear">
              <strong>✓ Nenhuma anamnese aguardando protocolo</strong>
              <p>Novas anamneses concluídas aparecerão automaticamente nesta fila.</p>
            </div>
          )}
        </details>
        <details
          className="admin-pending-section"
          id="pendencias-check-in"
          open={checkInsAwaitingReview.length > 0}
        >
          <summary>
            <span className="admin-task-icon is-attention" aria-hidden="true">C</span>
            <div>
              <span>Acompanhamento</span>
              <h3>Check-ins aguardando análise</h3>
            </div>
            <strong>{checkInsAwaitingReview.length}</strong>
            <i aria-hidden="true">⌄</i>
          </summary>
          {checkInsAwaitingReview.length ? (
            <div className="admin-pending-list">
              {checkInsAwaitingReview.map((checkIn) => {
                const client = clientByEmail.get(checkIn.clientEmail)!;
                return (
                  <article className="is-attention" key={checkIn.id}>
                    <i aria-hidden="true" />
                    <div>
                      <span>Check-in novo</span>
                      <strong>Revisar semana de {client.name}</strong>
                      <p>
                        Semana de {formatWeekDate(checkIn.weekStart)} ·
                        aderência {checkIn.adherence}/5 · energia{" "}
                        {checkIn.energy}/5
                      </p>
                    </div>
                    <Link
                      href={`/admin/clientes/${encodeURIComponent(client.email)}#check-ins`}
                    >
                      Revisar check-in →
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="admin-all-clear">
              <strong>✓ Nenhum check-in aguardando análise</strong>
              <p>Novos check-ins aparecerão automaticamente nesta fila.</p>
            </div>
          )}
        </details>
        <details
          className="admin-pending-section"
          id="pendencias-ajustes"
          open={adjustmentsAwaitingAction.length > 0}
        >
          <summary>
            <span className="admin-task-icon is-urgent" aria-hidden="true">J</span>
            <div>
              <span>Solicitações</span>
              <h3>Ajustes em aberto</h3>
            </div>
            <strong>{adjustmentsAwaitingAction.length}</strong>
            <i aria-hidden="true">⌄</i>
          </summary>
          {adjustmentsAwaitingAction.length ? (
            <div className="admin-pending-list">
              {adjustmentsAwaitingAction.map((adjustment) => {
                const client = clientByEmail.get(adjustment.clientEmail)!;
                return (
                  <article className="is-urgent" key={adjustment.id}>
                    <i aria-hidden="true" />
                    <div>
                      <span>
                        {adjustment.status === "analyzing"
                          ? "Ajuste em análise"
                          : "Nova solicitação de ajuste"}
                      </span>
                      <strong>{client.name} aguarda análise</strong>
                      <p>
                        {adjustment.protocolArea} · enviada em{" "}
                        {formatApprovalDate(adjustment.createdAt)}
                      </p>
                    </div>
                    <Link
                      href={`/admin/clientes/${encodeURIComponent(client.email)}#ajustes`}
                    >
                      Analisar solicitação →
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="admin-all-clear">
              <strong>✓ Nenhuma solicitação de ajuste aberta</strong>
              <p>Novos pedidos dos pacientes aparecerão automaticamente nesta fila.</p>
            </div>
          )}
        </details>
        <details
          className="admin-pending-section"
          id="pendencias-vencimento"
          open={expiringPlanClients.length > 0}
        >
          <summary>
            <span className="admin-task-icon is-routine" aria-hidden="true">R</span>
            <div>
              <span>Renovação</span>
              <h3>Planos próximos do vencimento</h3>
            </div>
            <strong>{expiringPlanClients.length}</strong>
            <i aria-hidden="true">⌄</i>
          </summary>
          {expiringPlanClients.length ? (
            <div className="admin-pending-list">
              {expiringPlanClients.map((client) => {
                const remaining = daysRemaining(client.accessExpiresAt);
                return (
                  <article className="is-routine" key={client.id}>
                    <i aria-hidden="true" />
                    <div>
                      <span>Renovação próxima</span>
                      <strong>
                        {client.name}: {remaining} dia(s) restante(s)
                      </strong>
                      <p>
                        {client.plan} · vigência até{" "}
                        {formatWeekDate(client.accessExpiresAt!)}
                      </p>
                    </div>
                    <Link
                      href={`/admin/clientes/${encodeURIComponent(client.email)}`}
                    >
                      Ver paciente →
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="admin-all-clear">
              <strong>✓ Nenhum plano vence nos próximos 7 dias</strong>
              <p>Planos próximos do fim aparecerão automaticamente nesta fila.</p>
            </div>
          )}
        </details>
        </section>
        <header className="admin-patient-heading" id="pacientes">
          <div>
            <span>Base de pacientes</span>
            <h2>Todos os cadastros</h2>
          </div>
          <p>Abra um paciente para consultar histórico, documentos e acompanhamento.</p>
        </header>
        <details className="admin-in-person-create">
          <summary>
            <div>
              <span>Novo atendimento presencial</span>
              <strong>Cadastrar paciente e enviar convite</strong>
            </div>
            <i aria-hidden="true">＋</i>
          </summary>
          <p>
            Informe o e-mail e a vigência. O paciente receberá um link para
            completar os dados e cadastrar a própria senha.
          </p>
          <InPersonInviteForm />
        </details>
        <PatientResetPanel
          patients={rows.map((client) => ({
            email: client.email,
            modality: client.modality,
            name: client.name,
          }))}
        />
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Modalidade</th>
                <th>Plano</th>
                <th>Status</th>
                <th>Vigência</th>
                <th>Anamnese</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((client) => (
                <tr id={`paciente-${client.id}`} key={client.id}>
                  <td><strong>{client.name}</strong><small>{client.email}</small></td>
                  <td>
                    <span className={`patient-modality-badge is-${client.modality}`}>
                      {client.modality === "in_person" ? "Presencial" : "Online"}
                    </span>
                  </td>
                  <td>{client.plan}</td>
                  <td>
                    {hasActiveAccess(client)
                      ? "Liberado"
                      : client.paymentStatus === "approved"
                        ? "Vencido"
                        : "Pendente"}
                  </td>
                  <td>
                    {client.accessExpiresAt
                      ? `${daysRemaining(client.accessExpiresAt)} dias`
                      : "Não iniciada"}
                  </td>
                  <td>
                    {client.modality === "in_person" ? (
                      client.profileCompletedAt ? "Conta ativa" : ({
                        sent: "Convite enviado",
                        failed: "Falha no convite",
                        sending: "Enviando convite",
                        accepted: "Cadastro pendente",
                      } as Record<string, string>)[client.inviteStatus] || "Convite pendente"
                    ) : client.formStatus === "submitted" ? (
                      <Link
                        className="admin-response-link"
                        href={`/admin/clientes/${encodeURIComponent(client.email)}`}
                      >
                        Ver respostas
                      </Link>
                    ) : client.formStatus === "draft" ? "Em preenchimento" : "Não iniciada"}
                  </td>
                  <td>
                    {client.modality === "in_person" ? (
                      <Link
                        className="admin-response-link"
                        href={`/admin/clientes/${encodeURIComponent(client.email)}`}
                      >
                        Abrir prontuário
                      </Link>
                    ) : (
                      <ApprovalButton
                        email={client.email}
                        approved={client.paymentStatus === "approved"}
                        expired={
                          client.paymentStatus === "approved" &&
                          !hasActiveAccess(client)
                        }
                      />
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr><td colSpan={7}>Nenhum cadastro recebido até o momento.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
