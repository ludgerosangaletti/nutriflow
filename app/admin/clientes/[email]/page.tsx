import { and, asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "../../../../db";
import { adjustmentRequests, anamneses, appointmentChangeRequests, checkIns, clients, goalProgress, goals, patientDocuments, progressPhotos, nfClinicalAssessments, nfEnergyExpenditureCalculations, nfPublications } from "../../../../db/schema";
import { requireAdmin } from "../../../supabase/server";
import { fieldLabels, sections, type Answers } from "../../../anamnese/questions";
import CheckInReviewButton from "./check-in-review-button";
import GoalManager from "./goal-manager";
import AdjustmentManager from "./adjustment-manager";
import TimelineList from "../../../timeline-list";
import { buildTimeline } from "../../../timeline";
import ProgressCharts from "../../../progress-charts";
import RenewalEmailTest from "./renewal-email-test";
import { daysRemaining, hasActiveAccess } from "../../../access";
import InPersonCareManager from "./in-person-care-manager";
import AppointmentRequests from "./appointment-requests";
import { canUseNutriFlowEditor, canUseNutriFlowFeature, ensureNutriFlowAdminContext, getControlledHomologationSnapshot } from "../../../nutriflow/server";
import { NUTRIFLOW_FEATURE_FLAGS } from "../../../../modules/nutriflow/config/feature-flags";
import NutriFlowHomologationPanel from "./nutriflow-homologation-panel";
import ClinicalAssessmentForm from "./clinical-assessment-form";
import ClinicalAssessmentHistory from "./clinical-assessment-history";
import EnergyExpenditureForm from "./energy-expenditure-form";

export const dynamic = "force-dynamic";

export default async function ClientAnswers({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const adminUser = await requireAdmin("/admin/clientes");

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
  const clinicalAssessments = await db.select().from(nfClinicalAssessments).where(eq(nfClinicalAssessments.clientId, row.client.id)).orderBy(asc(nfClinicalAssessments.capturedAt));
  const energyCalculations = await db.select().from(nfEnergyExpenditureCalculations).where(eq(nfEnergyExpenditureCalculations.clientId, row.client.id)).orderBy(desc(nfEnergyExpenditureCalculations.createdAt));
  const [activePublication] = await db.select({ id: nfPublications.id }).from(nfPublications).where(and(eq(nfPublications.clientId, row.client.id), eq(nfPublications.status, "active"))).limit(1);
  const appointmentRequests = row.client.modality === "in_person"
    ? await db
        .select()
        .from(appointmentChangeRequests)
        .where(eq(appointmentChangeRequests.clientEmail, email))
    : [];
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
  const activeAccess = hasActiveAccess(row.client);
  const isInPerson = row.client.modality === "in_person";
  const remainingDays = row.client.accessExpiresAt
    ? daysRemaining(row.client.accessExpiresAt)
    : null;
  const newCheckInCount = patientCheckIns.filter(
    (item) => item.adminStatus === "new",
  ).length;
  const openAdjustmentCount = patientAdjustments.filter(
    (item) => !["adjusted", "closed"].includes(item.status),
  ).length;
  const activeGoalCount = patientGoals.filter(
    (goal) => goal.status === "active",
  ).length;
  const nutriFlowContext = await ensureNutriFlowAdminContext({
    authUserId: adminUser.id,
    email: adminUser.email ?? "",
  });
  const nutriFlowEnabled = nutriFlowContext
    ? await canUseNutriFlowEditor(nutriFlowContext, row.client.id)
    : false;
  const trainingEnabled = nutriFlowContext
    ? await canUseNutriFlowFeature(nutriFlowContext, row.client.id, NUTRIFLOW_FEATURE_FLAGS.TRAINING)
    : false;
  const homologation = nutriFlowContext
    ? await getControlledHomologationSnapshot(nutriFlowContext, row.client)
    : null;

  return (
    <main className="portal-shell response-page">
      <header className="portal-header">
        <Link className="portal-brand" href="/admin/clientes">← Gestão de clientes</Link>
        <span>{row.client.plan}</span>
      </header>
      <section className="response-heading">
        <div className="admin-patient-identity">
          <div>
            <p className="section-kicker">Prontuário do paciente</p>
            <h1>{row.client.name}</h1>
            <p>{row.client.email} · {row.client.whatsapp}</p>
          </div>
          <aside>
            <span className={activeAccess ? "is-active" : "is-inactive"}>
              {activeAccess ? "Acesso ativo" : "Acesso inativo"}
            </span>
            <strong>{row.client.plan}</strong>
            <small>
              {remainingDays === null
                ? "Vigência não iniciada"
                : remainingDays >= 0
                  ? `${remainingDays} dia(s) restante(s)`
                  : "Plano vencido"}
            </small>
          </aside>
        </div>
        <div className="admin-patient-stats">
          {isInPerson ? (
            <Link href={`/admin/clientes/${encodeURIComponent(row.client.email)}/anamnese`}>
              <span>Anamnese clínica</span>
              <strong>{row.anamnesis?.status === "submitted" ? "Concluída" : row.anamnesis?.status === "draft" ? "Rascunho" : "Iniciar"}</strong>
            </Link>
          ) : (
            <a href="#anamnese">
              <span>Anamnese</span>
              <strong>{row.anamnesis?.status === "submitted" ? "Enviada" : "Pendente"}</strong>
            </a>
          )}
          <a href="#documentos">
            <span>Documentos</span>
            <strong>{documents.length}</strong>
          </a>
          <a href="#check-ins">
            <span>Check-ins</span>
            <strong>{patientCheckIns.length}</strong>
          </a>
          <a href="#ajustes">
            <span>Ajustes abertos</span>
            <strong>{openAdjustmentCount}</strong>
          </a>
        </div>
        <nav className="admin-patient-nav" aria-label="Seções do paciente">
          {nutriFlowEnabled ? (
            <Link className="is-nutriflow" href={`/admin/clientes/${encodeURIComponent(row.client.email)}/nutriflow`}>
              Editor NutriFlow
            </Link>
          ) : null}
          {trainingEnabled ? <Link className="is-nutriflow" href={`/admin/clientes/${encodeURIComponent(row.client.email)}/training`}>Treino</Link> : null}
          {isInPerson ? <><a href="#dados-presenciais">Atendimento</a><Link href={`/admin/clientes/${encodeURIComponent(row.client.email)}/anamnese`}>{row.anamnesis ? "Editar anamnese" : "Preencher anamnese"}</Link></> : null}
          <a href="#documentos">{isInPerson ? "Protocolo e avaliação" : "Documentos"}</a>
          <a href="#check-ins">Check-ins</a>
          <a href="#energia">Energia</a>
          <a href="#ajustes">Ajustes</a>
          <a href="#evolucao">{isInPerson ? "Fotos" : "Evolução"}</a>
          {!isInPerson ? <a href="#metas">Metas</a> : null}
          {!isInPerson ? <a href="#anamnese">Anamnese</a> : null}
        </nav>
        {homologation && nutriFlowContext ? (
          <NutriFlowHomologationPanel
            canConfigure={nutriFlowContext.actor.role === "owner" || nutriFlowContext.actor.role === "admin"}
            clientId={row.client.id}
            patientName={row.client.name}
            snapshot={homologation}
          />
        ) : null}
        <details className="admin-tools">
          <summary>Ferramentas administrativas <span>Teste de e-mail de renovação</span></summary>
          <RenewalEmailTest email={row.client.email} />
        </details>
      </section>
      <div className="response-sections">
        {isInPerson ? (
          <div id="dados-presenciais">
            <InPersonCareManager
              accessStartedAt={row.client.accessStartedAt}
              appointmentLocation={row.client.appointmentLocation}
              email={row.client.email}
              inviteStatus={row.client.inviteStatus}
              nextAppointmentAt={row.client.nextAppointmentAt}
              plan={row.client.plan}
            />
            <AppointmentRequests
              appointmentStatus={row.client.appointmentStatus}
              email={row.client.email}
              requests={appointmentRequests}
            />
          </div>
        ) : null}
        {isInPerson ? <details className="response-section clinical-assessments-section" id="avaliacoes" open>
          <summary className="admin-section-summary"><div><p className="section-kicker">Linha do tempo clínica</p><h2>Avaliações físicas</h2></div><strong>{clinicalAssessments.length} registro(s)</strong><i aria-hidden="true">⌄</i></summary>
          <ClinicalAssessmentForm email={row.client.email} />
          <ClinicalAssessmentHistory assessments={clinicalAssessments} email={row.client.email} />
        </details> : null}
        <details className="response-section energy-expenditure-section" id="energia" open>
          <summary className="admin-section-summary"><div><p className="section-kicker">Planejamento energético</p><h2>Valor energético total</h2></div><strong>{energyCalculations.length} cálculo(s)</strong><i aria-hidden="true">⌄</i></summary>
          <EnergyExpenditureForm
            email={row.client.email}
            defaults={{
              weightKg: isInPerson ? clinicalAssessments.at(-1)?.weightKg : patientCheckIns.toSorted((a, b) => a.weekStart.localeCompare(b.weekStart)).at(-1)?.weightKg,
              heightCm: isInPerson ? clinicalAssessments.at(-1)?.heightCm : undefined,
              leanMassKg: isInPerson && clinicalAssessments.at(-1) ? String((JSON.parse(clinicalAssessments.at(-1)!.snapshotJson) as { result: { leanMassKg: number } }).result.leanMassKg) : undefined,
            }}
          />
          {energyCalculations.length ? <div className="energy-expenditure-history">{energyCalculations.map((calculation) => { const snapshot = JSON.parse(calculation.snapshotJson) as { result: { totalKcal: number }; protocol: string }; return <article key={calculation.id}><div><strong>{Math.round(snapshot.result.totalKcal)} kcal/dia</strong><span>{({ mifflin_st_jeor: "Mifflin–St Jeor", harris_benedict_revised: "Harris–Benedict revisada", schofield_who: "Schofield (OMS/FAO)", iom_eer: "IOM – EER", katch_mcardle: "Katch–McArdle" } as Record<string, string>)[snapshot.protocol] || snapshot.protocol}</span></div><small>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(calculation.createdAt))}</small></article>; })}</div> : <p className="energy-empty">Nenhum cálculo registrado. Escolha o protocolo mais adequado e registre a referência clínica.</p>}
        </details>
        {!isInPerson ? <details className="response-section admin-charts-section">
          <summary className="admin-section-summary">
            <div><p className="section-kicker">Evolução em gráficos</p><h2>Visão clínica do período</h2></div>
            <strong>{patientCheckIns.length} check-in(s)</strong>
            <i aria-hidden="true">⌄</i>
          </summary>
          <ProgressCharts
            checkIns={patientCheckIns}
            compact
            goalProgress={patientGoalProgress}
            goals={patientGoals}
          />
        </details> : null}
        <details className="response-section admin-timeline-section">
          <summary className="admin-section-summary">
            <div><p className="section-kicker">Histórico da consultoria</p><h2>Linha do tempo</h2></div>
            <strong>{timelineEvents.filter((event) => !event.future).length} evento(s)</strong>
            <i aria-hidden="true">⌄</i>
          </summary>
          <TimelineList events={timelineEvents} admin />
        </details>
        <details className="response-section admin-adjustments-section" id="ajustes" open={openAdjustmentCount > 0}>
          <summary className="admin-section-summary"><div><p className="section-kicker">Solicitações de ajustes</p><h2>Pedidos do paciente</h2></div><strong>{openAdjustmentCount} aberta(s)</strong><i aria-hidden="true">⌄</i></summary>
          <AdjustmentManager
            documents={documents.map((document) => ({ id: document.id, title: document.title, version: document.version }))}
            requests={patientAdjustments}
          />
        </details>
        {!isInPerson ? <details className="response-section admin-goals-section" id="metas">
          <summary className="admin-section-summary">
            <div><p className="section-kicker">Metas em conjunto</p><h2>Objetivos do paciente</h2></div>
            <strong>{activeGoalCount}/3 ativas</strong>
            <i aria-hidden="true">⌄</i>
          </summary>
          <p>Defina até três prioridades simultâneas. O paciente poderá registrar o progresso, mas somente você altera o objetivo, prazo ou status.</p>
          <GoalManager
            email={row.client.email}
            goals={patientGoals.map((goal) => ({
              ...goal,
              progressCount: patientGoalProgress.filter((item) => item.goalId === goal.id).length,
            }))}
          />
        </details> : null}
        {/* Histórico clínico e resultados exibidos com rótulos em português. */}
        <details className="response-section admin-checkin-section" id="check-ins" open={newCheckInCount > 0}>
          <summary className="admin-section-summary"><div><p className="section-kicker">Acompanhamento periódico</p><h2>Check-ins semanais</h2></div><strong>{newCheckInCount} novo(s)</strong><i aria-hidden="true">⌄</i></summary>
          {!patientCheckIns.length ? <p>Nenhum check-in enviado até o momento.</p> : (
            <div className="admin-checkin-list">
              {patientCheckIns.toSorted((a, b) => b.weekStart.localeCompare(a.weekStart)).map((item) => (
                <article className={item.adminStatus === "new" ? "is-new" : ""} key={item.id}>
                  <header><div><span>Semana de {new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${item.weekStart}T00:00:00Z`))}</span><strong>{item.weightKg ? `${item.weightKg.replace(".", ",")} kg` : "Peso não informado"}</strong></div><CheckInReviewButton id={item.id} reviewed={item.adminStatus === "reviewed"} feedback={item.feedback} /></header>
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
        </details>
        <details className="response-section admin-documents-section" id="documentos">
          <summary className="admin-section-summary">
            <div><p className="section-kicker">{isInPerson ? "Atendimento presencial" : "Materiais"}</p><h2>{isInPerson ? "Protocolo e avaliação física" : "Documentos do paciente"}</h2></div>
            <strong>{documents.length} arquivo(s)</strong>
            <i aria-hidden="true">⌄</i>
          </summary>
          <p>
            {isInPerson
              ? "Publique o protocolo alimentar e a avaliação física em PDF. A versão mais recente de cada categoria será destacada para o paciente."
              : "Publique o protocolo e os materiais auxiliares. Uma nova versão do protocolo substitui a anterior como versão atual."}
          </p>
          <div className="admin-document-source-note"><strong>Novos protocolos são criados no NutriFlow.</strong><p>O PDF profissional é gerado a partir da versão estruturada publicada. Os arquivos abaixo permanecem disponíveis apenas como histórico e contingência.</p><div className="admin-document-source-actions"><Link className="admin-response-link" href={`/admin/clientes/${encodeURIComponent(row.client.email)}/nutriflow`}>Abrir Editor NutriFlow</Link>{activePublication ? <a className="admin-response-link" href={`/api/admin/nutriflow/plan-report?email=${encodeURIComponent(row.client.email)}`} rel="noreferrer" target="_blank">Gerar PDF profissional</a> : null}</div></div>
          <div className="admin-document-list">
            {documents
              .toSorted((a, b) => b.publishedAt.localeCompare(a.publishedAt))
              .map((document) => {
                const whatsapp = row.client.whatsapp.replace(/\D/g, "");
                const phone = whatsapp.startsWith("55") ? whatsapp : `55${whatsapp}`;
                const message = encodeURIComponent(
                  `Olá, ${row.client.name.split(" ")[0]}! Seu ${document.documentType === "protocol" ? "protocolo alimentar" : document.documentType === "physical_assessment" ? "arquivo de avaliação física" : "material auxiliar"} já está disponível na Área do Paciente: https://ludgerosangaletti.com.br/area-cliente`,
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
        </details>
        {!isInPerson ? <details className="response-section admin-anamnesis-section" id="anamnese">
          <summary className="admin-section-summary">
            <div><p className="section-kicker">Dados clínicos</p><h2>Anamnese completa</h2></div>
            <strong>{sections.length} seção(ões)</strong>
            <i aria-hidden="true">⌄</i>
          </summary>
          <div className="admin-anamnesis-groups">
            {sections.map((section) => (
              <details key={section.id}>
                <summary>{section.title}<span>{section.fields.length} respostas</span></summary>
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
              </details>
            ))}
          </div>
        </details> : null}
        <details className="response-section admin-photo-section" id="evolucao">
          <summary className="admin-section-summary">
            <div><p className="section-kicker">Registro fotográfico</p><h2>{isInPerson ? "Fotos de acompanhamento" : "Evolução corporal"}</h2></div>
            <strong>{photos.length} foto(s)</strong>
            <i aria-hidden="true">⌄</i>
          </summary>
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
        </details>
      </div>
    </main>
  );
}
