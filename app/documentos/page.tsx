import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "../../db";
import { clients, patientDocuments } from "../../db/schema";
import { hasActiveAccess } from "../access";
import { requirePatient } from "../supabase/server";
import { NotificationOptIn } from "../notification-opt-in";
import { InstallPrompt } from "../install-prompt";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export default async function DocumentsPage() {
  const user = await requirePatient("/documentos");
  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.authUserId, user.id))
    .limit(1);

  if (!client || !hasActiveAccess(client)) {
    return (
      <main className="portal-shell">
        <section className="empty-state">
          <p className="section-kicker">Documentos</p>
          <h1>Materiais indisponíveis.</h1>
          <p>Aguarde a confirmação do pagamento ou renove seu plano.</p>
          <Link className="button button-dark" href="/area-cliente">Voltar</Link>
        </section>
      </main>
    );
  }

  const documents = await db
    .select()
    .from(patientDocuments)
    .where(eq(patientDocuments.clientEmail, client.email))
    .orderBy(desc(patientDocuments.publishedAt));
  const current = documents.filter((document) => document.isCurrent);
  const archived = documents.filter((document) => !document.isCurrent);

  return (
    <main className="portal-shell documents-page">
      <header className="portal-header">
        <Link className="portal-brand" href="/area-cliente">← Área do paciente</Link>
        <form action="/auth/sair" method="post">
          <button className="auth-signout" type="submit">Sair</button>
        </form>
      </header>
      <section className="documents-heading">
        <p className="section-kicker">Seus documentos</p>
        <h1>
          {client.modality === "in_person"
            ? "Protocolo e avaliação física."
            : "Protocolo e materiais."}
        </h1>
        <p>
          {client.modality === "in_person"
            ? "Acesse os arquivos disponibilizados após seus atendimentos presenciais. Sempre use a versão marcada como atual."
            : "Este é o canal oficial dos documentos da sua consultoria. Sempre use a versão marcada como atual."}
        </p>
      </section>
      <section className="patient-document-card" aria-label="Notificações e acesso rápido"><InstallPrompt /><NotificationOptIn /></section>

      <section className="current-documents">
        <h2>Disponíveis agora</h2>
        <div className="patient-document-grid">
          {current.map((document) => (
            <article className="patient-document-card" key={document.id}>
              <span>
                {document.documentType === "protocol"
                  ? "Protocolo alimentar"
                  : document.documentType === "physical_assessment"
                    ? "Avaliação física"
                  : "Material auxiliar"}
              </span>
              <strong>{document.title}</strong>
              <p>Versão {document.version} · Publicado em {formatDate(document.publishedAt)}</p>
              <a className="button button-dark" href={`/api/documentos/${document.id}`}>
                Baixar PDF
              </a>
            </article>
          ))}
          {!current.length ? (
            <article className="patient-document-empty">
              <strong>Seus materiais estão em elaboração.</strong>
              <p>Você será avisado assim que um documento for publicado.</p>
            </article>
          ) : null}
        </div>
      </section>

      {archived.length ? (
        <section className="archived-documents">
          <h2>Versões anteriores</h2>
          {archived.map((document) => (
            <article key={document.id}>
              <div>
                <strong>{document.title}</strong>
                <span>Versão {document.version} · {formatDate(document.publishedAt)}</span>
              </div>
              <a href={`/api/documentos/${document.id}`}>Baixar versão arquivada</a>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}
