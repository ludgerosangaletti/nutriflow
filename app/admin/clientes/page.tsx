import { desc } from "drizzle-orm";
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
  const expiringPlans = rows.filter((client) => {
    if (!hasActiveAccess(client) || !client.accessExpiresAt) return false;
    const remaining = daysRemaining(client.accessExpiresAt);
    return remaining >= 0 && remaining <= 7;
  }).length;

  return (
    <main className="portal-shell">
      <header className="portal-header">
        <Link className="portal-brand" href="/">Gestão da consultoria</Link>
        <form action="/auth/sair" method="post">
          <button className="auth-signout" type="submit">Sair</button>
        </form>
      </header>
      <section className="admin-panel">
        <p className="section-kicker">Gestão de clientes</p>
        <h1>Pagamentos e acessos</h1>
        <p>
          Confirme somente após localizar o pagamento correspondente na TON.
        </p>
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
            <strong>{expiringPlans}</strong>
            <small>Nos próximos 7 dias</small>
          </a>
        </div>
        <section className="admin-pending-section" id="pendencias-pagamento">
          <header>
            <div>
              <span>Fila de trabalho</span>
              <h2>Pagamentos para conferir</h2>
            </div>
            <strong>{pendingPaymentClients.length} pendente(s)</strong>
          </header>
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
        </section>
        <section className="admin-pending-section" id="pendencias-anamnese">
          <header>
            <div>
              <span>Fila de trabalho</span>
              <h2>Anamneses aguardando protocolo</h2>
            </div>
            <strong>{anamnesesAwaitingProtocol.length} pendente(s)</strong>
          </header>
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
        </section>
        <section className="admin-pending-section" id="pendencias-check-in">
          <header>
            <div>
              <span>Fila de trabalho</span>
              <h2>Check-ins aguardando análise</h2>
            </div>
            <strong>{checkInsAwaitingReview.length} novo(s)</strong>
          </header>
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
        </section>
        <section className="admin-pending-section" id="pendencias-ajustes">
          <header>
            <div>
              <span>Fila de trabalho</span>
              <h2>Solicitações de ajustes abertas</h2>
            </div>
            <strong>{adjustmentsAwaitingAction.length} aberta(s)</strong>
          </header>
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
        </section>
        <div className="admin-table-wrap" id="pacientes">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>WhatsApp</th>
                <th>Plano</th>
                <th>Status</th>
                <th>Vigência</th>
                <th>Aviso</th>
                <th>Anamnese</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((client) => (
                <tr id={`paciente-${client.id}`} key={client.id}>
                  <td><strong>{client.name}</strong><small>{client.email}</small></td>
                  <td>{client.whatsapp}</td>
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
                    {client.approvalEmailStatus === "sent"
                      ? `Enviado em ${formatApprovalDate(client.approvalEmailSentAt)}`
                      : client.approvalEmailStatus === "failed"
                        ? "Falha no envio"
                        : "Não enviado"}
                  </td>
                  <td>
                    {client.formStatus === "submitted" ? (
                      <Link
                        className="admin-response-link"
                        href={`/admin/clientes/${encodeURIComponent(client.email)}`}
                      >
                        Ver respostas
                      </Link>
                    ) : client.formStatus === "draft" ? "Em preenchimento" : "Não iniciada"}
                  </td>
                  <td>
                    <ApprovalButton
                      email={client.email}
                      approved={client.paymentStatus === "approved"}
                      expired={
                        client.paymentStatus === "approved" &&
                        !hasActiveAccess(client)
                      }
                    />
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr><td colSpan={8}>Nenhum cadastro recebido até o momento.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
