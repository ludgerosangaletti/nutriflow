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

function formatAdminDate(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", options).format(date);
}

export default async function AdminClients() {
  await requireAdmin("/admin/clientes");

  const db = getDb();
  // Keep D1 reads sequential. Parallel database calls can cross request I/O
  // contexts in the Workers runtime and make the whole Server Component fail.
  const rows = await db.select().from(clients).orderBy(desc(clients.createdAt));
  const allAnamneses = await db.select().from(anamneses);
  const allDocuments = await db.select().from(patientDocuments);
  const allCheckIns = await db.select().from(checkIns);
  const allAdjustments = await db.select().from(adjustmentRequests);

  const clientByEmail = new Map(rows.map((client) => [client.email, client]));
  const currentProtocolEmails = new Set(
    allDocuments
      .filter(
        (document) =>
          document.documentType === "protocol" && document.isCurrent,
      )
      .map((document) => document.clientEmail),
  );
  const pendingPayments = rows.filter(
    (client) =>
      client.paymentStatus !== "approved" && Boolean(client.purchaseStartedAt),
  );
  const protocolsToPrepare = allAnamneses.filter(
    (anamnesis) =>
      anamnesis.status === "submitted" &&
      !currentProtocolEmails.has(anamnesis.clientEmail),
  );
  const newCheckIns = allCheckIns.filter(
    (checkIn) => checkIn.adminStatus === "new",
  );
  const openAdjustments = allAdjustments.filter((adjustment) =>
    ["submitted", "analyzing"].includes(adjustment.status),
  );
  const expiringPlans = rows.filter((client) => {
    if (!hasActiveAccess(client) || !client.accessExpiresAt) return false;
    const remaining = daysRemaining(client.accessExpiresAt);
    return remaining >= 0 && remaining <= 7;
  });

  type PendingItem = {
    id: string;
    priority: number;
    tone: "urgent" | "attention" | "routine";
    category: string;
    title: string;
    detail: string;
    href: string;
    action: string;
  };
  const pendingItems: PendingItem[] = [
    ...pendingPayments.map((client) => ({
      id: `payment-${client.id}`,
      priority: 1,
      tone: "urgent" as const,
      category: "Pagamento",
      title: `Conferir compra de ${client.name}`,
      detail: `${client.plan} · compra informada ${formatAdminDate(client.purchaseStartedAt, { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}`,
      href: "#pacientes",
      action: "Localizar cadastro",
    })),
    ...protocolsToPrepare.flatMap((anamnesis) => {
      const client = clientByEmail.get(anamnesis.clientEmail);
      if (!client) return [];
      return [{
        id: `protocol-${anamnesis.id}`,
        priority: 2,
        tone: "attention" as const,
        category: "Anamnese recebida",
        title: `Preparar protocolo de ${client.name}`,
        detail: `Enviada em ${formatAdminDate(anamnesis.submittedAt || anamnesis.updatedAt, { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}`,
        href: `/admin/clientes/${encodeURIComponent(client.email)}#documentos`,
        action: "Abrir paciente",
      }];
    }),
    ...newCheckIns.flatMap((checkIn) => {
      const client = clientByEmail.get(checkIn.clientEmail);
      if (!client) return [];
      return [{
        id: `checkin-${checkIn.id}`,
        priority: 3,
        tone: "attention" as const,
        category: "Check-in novo",
        title: `Revisar semana de ${client.name}`,
        detail: `Aderência ${checkIn.adherence}/5 · energia ${checkIn.energy}/5`,
        href: `/admin/clientes/${encodeURIComponent(client.email)}#check-ins`,
        action: "Revisar check-in",
      }];
    }),
    ...openAdjustments.flatMap((adjustment) => {
      const client = clientByEmail.get(adjustment.clientEmail);
      if (!client) return [];
      return [{
        id: `adjustment-${adjustment.id}`,
        priority: 2,
        tone: "urgent" as const,
        category: "Solicitação de ajuste",
        title: `${client.name} aguarda análise`,
        detail: `${adjustment.protocolArea} · enviada em ${formatAdminDate(adjustment.createdAt, { dateStyle: "short", timeZone: "America/Sao_Paulo" })}`,
        href: `/admin/clientes/${encodeURIComponent(client.email)}#ajustes`,
        action: "Analisar solicitação",
      }];
    }),
    ...expiringPlans.map((client) => {
      const remaining = daysRemaining(client.accessExpiresAt!);
      return {
        id: `expiry-${client.id}`,
        priority: 4,
        tone: "routine" as const,
        category: "Plano próximo do fim",
        title: `${client.name}: ${remaining === 0 ? "encerra hoje" : `${remaining} dia(s) restante(s)`}`,
        detail: `${client.plan} · vigência até ${formatAdminDate(client.accessExpiresAt, { timeZone: "UTC" })}`,
        href: `/admin/clientes/${encodeURIComponent(client.email)}`,
        action: "Ver paciente",
      };
    }),
  ].sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));

  const activeClients = rows.filter(hasActiveAccess).length;
  const pendingTotal =
    pendingPayments.length +
    protocolsToPrepare.length +
    newCheckIns.length +
    openAdjustments.length;

  return (
    <main className="portal-shell">
      <header className="portal-header">
        <Link className="portal-brand" href="/">Gestão da consultoria</Link>
        <form action="/auth/sair" method="post">
          <button className="auth-signout" type="submit">Sair</button>
        </form>
      </header>
      <section className="admin-panel">
        <p className="section-kicker">Painel administrativo</p>
        <h1>Central de pendências</h1>
        <p>
          Sua visão diária da consultoria: comece pelas ações prioritárias e
          acesse cada paciente diretamente.
        </p>
        <div className="admin-summary-grid" aria-label="Resumo da consultoria">
          <a href="#pendencias">
            <span>Pendências prioritárias</span>
            <strong>{pendingTotal}</strong>
            <small>{pendingTotal ? "Ações que dependem de você" : "Tudo em dia"}</small>
          </a>
          <a href="#pacientes">
            <span>Pacientes ativos</span>
            <strong>{activeClients}</strong>
            <small>{rows.length} cadastro(s) no total</small>
          </a>
          <a href="#pendencias">
            <span>Check-ins novos</span>
            <strong>{newCheckIns.length}</strong>
            <small>Aguardando sua leitura</small>
          </a>
          <a href="#pendencias">
            <span>Planos vencendo</span>
            <strong>{expiringPlans.length}</strong>
            <small>Nos próximos 7 dias</small>
          </a>
        </div>

        <section className="admin-pending-section" id="pendencias">
          <header>
            <div>
              <span>Fila de trabalho</span>
              <h2>O que precisa da sua atenção</h2>
            </div>
            <strong>{pendingItems.length} item(ns)</strong>
          </header>
          {pendingItems.length ? (
            <div className="admin-pending-list">
              {pendingItems.map((item) => (
                <article className={`is-${item.tone}`} key={item.id}>
                  <i aria-hidden="true" />
                  <div>
                    <span>{item.category}</span>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                  <Link href={item.href}>{item.action} →</Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="admin-all-clear">
              <strong>✓ Tudo em dia</strong>
              <p>Não há pagamentos, anamneses, check-ins ou ajustes aguardando sua ação.</p>
            </div>
          )}
        </section>

        <section className="admin-patient-base" id="pacientes">
          <div>
            <span>Base de pacientes</span>
            <h2>Pagamentos e acessos</h2>
          </div>
          <p>Confirme somente após localizar o pagamento correspondente na TON.</p>
        </section>
        <div className="admin-table-wrap admin-patient-table">
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
                <tr key={client.id}>
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
                      ? `Enviado em ${formatAdminDate(client.approvalEmailSentAt, {
                          dateStyle: "short",
                          timeStyle: "short",
                          timeZone: "America/Sao_Paulo",
                        })}`
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
