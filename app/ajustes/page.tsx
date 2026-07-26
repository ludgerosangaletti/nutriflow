import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "../../db";
import { adjustmentRequests, clients, patientDocuments } from "../../db/schema";
import { hasActiveAccess } from "../access";
import { requirePatient } from "../supabase/server";
import AdjustmentForm from "./adjustment-form";

export const dynamic = "force-dynamic";

const reasonLabels: Record<string, string> = { hunger: "Fome ou baixa saciedade", meal: "Dificuldade com uma refeição", substitution: "Substituição de alimento", gastrointestinal: "Sintomas gastrointestinais", routine: "Alteração de horários ou rotina", training: "Mudança nos treinos", event: "Viagem ou evento", adherence: "Dificuldade de aderência", other: "Outro motivo" };
const statusLabels: Record<string, string> = { submitted: "Enviada", analyzing: "Em análise", answered: "Respondida", adjusted: "Ajuste realizado", closed: "Encerrada" };

export default async function AdjustmentsPage() {
  const user = await requirePatient("/ajustes");
  const db = getDb();
  const [client] = await db.select().from(clients).where(eq(clients.authUserId, user.id)).limit(1);
  if (!client || !hasActiveAccess(client)) return <main className="portal-shell"><section className="empty-state"><h1>Solicitações indisponíveis.</h1><p>Aguarde a confirmação do pagamento ou renove seu plano.</p><Link className="button button-dark" href="/area-cliente">Voltar</Link></section></main>;
  const requests = await db.select().from(adjustmentRequests).where(eq(adjustmentRequests.clientEmail, client.email)).orderBy(desc(adjustmentRequests.createdAt));
  const documents = await db.select().from(patientDocuments).where(eq(patientDocuments.clientEmail, client.email));
  const hasOpen = requests.some((item) => !["adjusted", "closed"].includes(item.status));
  return (
    <main className="portal-shell adjustments-page">
      <header className="portal-header"><Link className="portal-brand" href="/area-cliente">← Área do paciente</Link><form action="/auth/sair" method="post"><button className="auth-signout" type="submit">Sair</button></form></header>
      <section className="adjustments-hero"><div><p className="section-kicker">Solicitação de ajustes</p><h1>Algo precisa mudar?</h1><p>Explique sua dificuldade de forma estruturada para que a análise seja mais rápida e precisa.</p></div><aside><span>Status</span><strong>{hasOpen ? "1 aberta" : "Disponível"}</strong><p>Uma solicitação por vez</p></aside></section>
      {!hasOpen ? <section className="adjustment-form-section"><AdjustmentForm /></section> : <section className="adjustment-open-notice"><strong>Sua solicitação atual está sendo acompanhada.</strong><p>Uma nova solicitação poderá ser enviada quando esta for concluída ou encerrada.</p></section>}
      <section className="adjustment-history"><p className="section-kicker">Histórico</p><h2>{requests.length ? "Suas solicitações" : "Nenhuma solicitação enviada"}</h2>
        <div className="adjustment-list">{requests.map((item) => {
          const document = item.linkedDocumentId ? documents.find((entry) => entry.id === item.linkedDocumentId) : null;
          return <article key={item.id}><header><div><span>{reasonLabels[item.reason] || item.reason}</span><strong>{item.protocolArea}</strong></div><b className={`adjustment-status status-${item.status}`}>{statusLabels[item.status] || item.status}</b></header><p>{item.description}</p><dl><div><dt>Solicitação</dt><dd>{item.requestedChange}</dd></div>{item.adminResponse ? <div className="admin-answer"><dt>Resposta de Ludgero</dt><dd>{item.adminResponse}</dd></div> : null}</dl>{document ? <Link className="button button-dark" href={`/api/documentos/${document.id}`}>Baixar documento relacionado</Link> : null}<footer>Enviada em {new Intl.DateTimeFormat("pt-BR").format(new Date(item.createdAt))}</footer></article>;
        })}</div>
      </section>
    </main>
  );
}
