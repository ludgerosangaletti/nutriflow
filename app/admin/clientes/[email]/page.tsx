import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "../../../../db";
import { adjustmentRequests, anamneses, checkIns, clients, goalProgress, goals, patientDocuments, progressPhotos } from "../../../../db/schema";
import { requireAdmin } from "../../../supabase/server";
import { fieldLabels, sections, type Answers } from "../../../anamnese/questions";
import DocumentUploadForm from "./document-upload-form";
import CheckInReviewButton from "./check-in-review-button";
import GoalManager from "./goal-manager";
import AdjustmentManager from "./adjustment-manager";
import TimelineList from "../../../timeline-list";
import { buildTimeline } from "../../../timeline";
import ProgressCharts from "../../../progress-charts";
import RenewalEmailTest from "./renewal-email-test";

export const dynamic = "force-dynamic";

export default async function ClientAnswers({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  await requireAdmin("/admin/clientes");

  const email = decodeURIComponent((await params).email);
  const db = getDb();
  const [row] = await db
    .select({ client: clients, anamnesis: anamneses })
    .from(clients)
    .leftJoin(anamneses, eq(anamneses.clientEmail, clients.email))
    .where(and(eq(clients.email, email)))
    .limit(1);

  if (!row) {
    return <main className="portal-shell"><section className="empty-state"><h1>Cliente não encontrado.</h1></section></main>;
  }

  let answers: Answers = {};
  try {
    answers = row.anamnesis ? JSON.parse(row.anamnesis.answersJson) : {};
  } catch {
    answers = {};
  }
  const photos = await db
    .select()
    .from(progressPhotos)
    .where(eq(progressPhotos.clientEmail, email));
  const photoGroups = Map.groupBy(photos, (photo) => photo.period);
  const documents = await db
    .select()
    .from(patientDocuments)
    .where(eq(patientDocuments.clientEmail, email));
  const patientCheckIns = await db.select().from(checkIns).where(eq(checkIns.clientEmail, email));
  const patientGoals = await db.select().from(goals).where(eq(goals.clientEmail, email));
  const patientGoalProgress = await db.select().from(goalProgress).where(eq(goalProgress.clientEmail, email));
  const patientAdjustments = await db.select().from(adjustmentRequests).where(eq(adjustmentRequests.clientEmail, email));
  const angleLabels: Record<string, string> = {
    front: "Frente",
    side: "Lado",
    back: "Costas",
  };
  const timelineEvents = buildTimeline({
    client: row.client,
    anamnesis: row.anamnesis,
    documents,
    checkIns: patientCheckIns,
    photos,
    goals: patientGoals,
    adjustments: patientAdjustments,
  });

  return (
    <main className="portal-shell response-page">
      <header className="portal-header">
        <Link className="portal-brand" href="/admin/clientes">← Gestão de clientes</Link>
        <span>{row.client.plan}</span>
      </header>
      <section className="response-heading">
        <p className="section-kicker">Anamnese nutricional</p>
        <h1>{row.client.name}</h1>
        <p>{row.client.email} · {row.client.whatsapp}</p>
        <span className="response-status">
          {row.anamnesis?.status === "submitted" ? "Enviada" : "Rascunho"}
        </span>
        <RenewalEmailTest email={row.client.email} />
      </section>
      <div className="response-sections">
        <section className="response-section admin-charts-section">
          <div className="admin-checkin-heading">
            <div><p className="section-kicker">Evolução em gráficos</p><h2>Visão clínica do período</h2></div>
            <strong>{patientCheckIns.length} check-in(s)</strong>
          </div>
          <ProgressCharts
            checkIns={patientCheckIns}
            compact
            goalProgress={patientGoalProgress}
            goals={patientGoals}
          />
        </section>
        <section className="response-section admin-timeline-section">
          <div className="admin-checkin-heading">
            <div><p className="section-kicker">Histórico da consultoria</p><h2>Linha do tempo</h2></div>
            <strong>{timelineEvents.filter((event) => !event.future).length} evento(s)</strong>
          </div>
          <TimelineList events={timelineEvents} admin />
        </section>
        <section className="response-section admin-adjustments-section" id="ajustes">
          <div className="admin-checkin-heading"><div><p className="section-kicker">Solicitações de ajustes</p><h2>Pedidos do paciente</h2></div><strong>{patientAdjustments.filter((item) => !["adjusted", "closed"].includes(item.status)).length} aberta(s)</strong></div>
          <AdjustmentManager
            documents={documents.map((document) => ({ id: document.id, title: document.title, version: document.version }))}
            requests={patientAdjustments}
          />
        </section>
        <section className="response-section admin-goals-section">
          <div className="admin-checkin-heading">
            <div><p className="section-kicker">Metas em conjunto</p><h2>Objetivos do paciente</h2></div>
            <strong>{patientGoals.filter((goal) => goal.status === "active").length}/3 ativas</strong>
          </div>
          <p>Defina até três prioridades simultâneas. O paciente poderá registrar o progresso, mas somente você altera o objetivo, prazo ou status.</p>
          <GoalManager
            email={row.client.email}
            goals={patientGoals.map((goal) => ({
              ...goal,
              progressCount: patientGoalProgress.filter((item) => item.goalId === goal.id).length,
            }))}
          />
        </section>
        <section className="response-section admin-checkin-section" id="check-ins">
          <div className="admin-checkin-heading"><div><p className="section-kicker">Acompanhamento periódico</p><h2>Check-ins semanais</h2></div><strong>{patientCheckIns.filter((item) => item.adminStatus === "new").length} novo(s)</strong></div>
          {!patientCheckIns.length ? <p>Nenhum check-in enviado até o momento.</p> : (
            <div className="admin-checkin-list">
              {patientCheckIns.toSorted((a, b) => b.weekStart.localeCompare(a.weekStart)).map((item) => (
                <article className={item.adminStatus === "new" ? "is-new" : ""} key={item.id}>
                  <header><div><span>Semana de {new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${item.weekStart}T00:00:00Z`))}</span><strong>{item.weightKg ? `${item.weightKg.replace(".", ",")} kg` : "Peso não informado"}</strong></div><CheckInReviewButton id={item.id} reviewed={item.adminStatus === "reviewed"} /></header>
                  <div className="admin-checkin-metrics"><span>Aderência <b>{item.adherence}/5</b></span><span>Fome <b>{item.hunger}/5</b></span><span>Saciedade <b>{item.satiety}/5</b></span><span>Sono <b>{item.sleep}/5</b></span><span>Energia <b>{item.energy}/5</b></span><span>Treinos <b>{item.trainingSessions}</b></span></div>
                  <dl>
                    <div><dt>Intestino</dt><dd>{({ regular: "Regular, sem desconforto", constipation: "Mais preso que o habitual", diarrhea: "Mais solto que o habitual", alternating: "Alternando entre preso e solto", discomfort: "Com dor, gases ou desconforto" } as Record<string, string>)[item.bowelFunction] || item.bowelFunction}</dd></div>
                    <div><dt>Principal dificuldade</dt><dd>{item.mainDifficulty}</dd></div>
                    <div><dt>Evolução da semana</dt><dd>{item.weeklyWin}</dd></div>
                    {item.notes ? <div><dt>Observações</dt><dd>{item.notes}</dd></div> : null}
                  </dl>
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="response-section admin-documents-section" id="documentos">
          <h2>Documentos do paciente</h2>
          <p>
            Publique o protocolo e os materiais auxiliares. Uma nova versão do
            protocolo substitui a anterior como versão atual.
          </p>
          <DocumentUploadForm email={row.client.email} />
          <div className="admin-document-list">
            {documents
              .toSorted((a, b) => b.publishedAt.localeCompare(a.publishedAt))
              .map((document) => {
                const whatsapp = row.client.whatsapp.replace(/\D/g, "");
                const phone = whatsapp.startsWith("55") ? whatsapp : `55${whatsapp}`;
                const message = encodeURIComponent(
                  `Olá, ${row.client.name.split(" ")[0]}! Seu ${document.documentType === "protocol" ? "protocolo alimentar" : "material auxiliar"} já está disponível na Área do Paciente: https://ludgerosangaletti.com.br/area-cliente`,
                );
                return (
                  <article key={document.id}>
                    <div>
                      <strong>{document.title}</strong>
                      <span>
                        Versão {document.version} · {document.isCurrent ? "Atual" : "Arquivada"}
                      </span>
                    </div>
                    <a
                      className="admin-response-link"
                      href={`/api/documentos/${document.id}`}
                    >
                      Baixar
                    </a>
                    <a
                      className="admin-whatsapp-link"
                      href={`https://wa.me/${phone}?text=${message}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Avisar no WhatsApp
                    </a>
                  </article>
                );
              })}
            {!documents.length ? <p>Nenhum documento publicado.</p> : null}
          </div>
        </section>
        {sections.map((section) => (
          <section key={section.id} className="response-section">
            <h2>{section.title}</h2>
            <div>
              {section.fields.map((field) => (
                <article key={field.id}>
                  <span>{fieldLabels[field.id]}</span>
                  <p>
                    {typeof answers[field.id] === "boolean"
                      ? answers[field.id] ? "Sim" : "Não"
                      : String(answers[field.id] || "Não informado")}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ))}
        <section className="response-section admin-photo-section">
          <h2>Evolução corporal</h2>
          {!photos.length ? (
            <p>Nenhum registro fotográfico enviado.</p>
          ) : (
            [...photoGroups.entries()]
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([period, periodPhotos]) => (
                <article className="photo-month" key={period}>
                  <h3>{period.split("-").reverse().join("/")}</h3>
                  <div className="photo-month-grid">
                    {periodPhotos.map((photo) => (
                      <figure key={photo.id}>
                        <img
                          alt={`${angleLabels[photo.angle]} — ${period}`}
                          src={`/api/evolucao/foto?id=${photo.id}`}
                        />
                        <figcaption>{angleLabels[photo.angle]}</figcaption>
                      </figure>
                    ))}
                  </div>
                </article>
              ))
          )}
        </section>
      </div>
    </main>
  );
}
