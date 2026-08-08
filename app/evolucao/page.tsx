import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "../../db";
import { clients, nfClinicalAssessments, progressPhotos } from "../../db/schema";
import { hasActiveAccess } from "../access";
import { requirePatient } from "../supabase/server";
import { canUseNutriFlowPatientPortal, createNutriFlowPatientRuntime, resolveNutriFlowPatientContext } from "../nutriflow/server";
import PhotoUploadForm from "./photo-upload-form";
import EvolutionHistoryChart from "./evolution-history-chart";
import { PatientShell } from "../patient-experience/shell/PatientShell";
import { bmiClassification } from "../../modules/nutriflow/domain/assessments/pollock-7";

export const dynamic = "force-dynamic";
const angleLabels: Record<string, string> = { front: "Frente", side: "Lado", back: "Costas" };
const circumferenceLabels: Record<string, string> = { arm: "Braço", waist: "Cintura", abdomen: "Abdômen", hip: "Quadril", thigh: "Coxa" };
type ProgressPhoto = typeof progressPhotos.$inferSelect;
const number = (value: number, digits = 1) => value.toFixed(digits).replace(".", ",");
const date = (value: string) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));

function periodLabel(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function delta(value: number, unit: string) {
  return `${value > 0 ? "↑ +" : value < 0 ? "↓ -" : "→ "}${number(Math.abs(value))} ${unit}`;
}

function explicitObjective(notes: readonly string[]) {
  const all = notes.join(" ").toLowerCase();
  if (all.includes("redução de gordura corporal")) return "Redução de gordura corporal";
  if (all.includes("hipertrofia muscular")) return "Hipertrofia muscular";
  if (all.includes("manutenção do peso")) return "Manutenção do peso";
  return null;
}

function careMessage({ objective, latest, previous }: { objective: string | null; latest: any; previous: any }) {
  const days = Math.floor((Date.now() - new Date(latest.capturedAt).getTime()) / 86400000);
  if (days > 60) return "Já faz um tempo desde sua última avaliação. Que tal alinhar uma reavaliação com seu nutricionista?";
  if (!previous) return "Este é o seu ponto de partida. A partir da próxima avaliação, você vai acompanhar aqui sua evolução.";
  const weight = Number(latest.weightKg) - Number(previous.weightKg);
  const current = JSON.parse(latest.snapshotJson).result;
  const before = JSON.parse(previous.snapshotJson).result;
  const fat = current.bodyFatPct - before.bodyFatPct;
  const lean = current.leanMassKg - before.leanMassKg;
  const positive = objective === "Redução de gordura corporal" ? weight < -0.4 || fat < -0.5 : objective === "Hipertrofia muscular" ? lean > 0.3 : objective === "Manutenção do peso" ? Math.abs(weight) <= Math.max(0.5, Number(previous.weightKg) * .005) : null;
  if (positive === true) return "Você está evoluindo conforme o planejado. Continue seguindo seu plano alimentar.";
  if (positive === false) return "Seus dados desde a última avaliação pedem atenção. Continue seguindo seu plano e converse com seu nutricionista na próxima consulta.";
  return "Seus dados seguem estáveis desde a última avaliação. Constância também é progresso — continue seguindo as orientações do seu plano.";
}

function PhotoExperience({ currentPeriod, currentPhotos, firstPeriod, latestPeriod, firstPhotos, latestPhotos }: { currentPeriod: string; currentPhotos: ProgressPhoto[]; firstPeriod?: string; latestPeriod?: string; firstPhotos: ProgressPhoto[]; latestPhotos: ProgressPhoto[] }) {
  const hasComparison = Boolean(firstPeriod && latestPeriod && firstPeriod !== latestPeriod);
  return <section className="evolution-photo-flow" aria-label="Registro e comparação fotográfica">
    <div className="evolution-photo-register">
      <PhotoUploadForm defaultPeriod={currentPeriod} existingAngles={currentPhotos.map((photo) => photo.angle)} />
    </div>
    {firstPhotos.length ? <section className="evolution-photo-comparison">
      <header><strong>Comparativo</strong><p>{hasComparison ? "Primeiro registro comparado ao mais recente." : "Seu primeiro registro já está salvo. O comparativo aparecerá após um novo período."}</p></header>
      <div className="evolution-photo-comparison-list">
        {["front", "side", "back"].map((angle) => {
          const first = firstPhotos.find((photo) => photo.angle === angle);
          const last = latestPhotos.find((photo) => photo.angle === angle);
          if (!first) return null;
          return <article key={angle}><h3>{angleLabels[angle]}</h3><div className="evolution-photo-comparison-pair">
            <figure><img alt={`${angleLabels[angle]} — ${periodLabel(firstPeriod!)}`} src={`/api/evolucao/foto?id=${first.id}`} /><figcaption>{periodLabel(firstPeriod!)}</figcaption></figure>
            <span aria-hidden="true">→</span>
            {hasComparison && last ? <figure><img alt={`${angleLabels[angle]} — ${periodLabel(latestPeriod!)}`} src={`/api/evolucao/foto?id=${last.id}`} /><figcaption>{periodLabel(latestPeriod!)}</figcaption></figure> : <figure className="is-placeholder"><div aria-hidden="true">+</div><figcaption>Próximo registro</figcaption></figure>}
          </div></article>;
        })}
      </div>
    </section> : null}
  </section>;
}

export default async function ProgressPage() {
  const user = await requirePatient("/evolucao");
  const db = getDb();
  const [client] = await db.select().from(clients).where(eq(clients.authUserId, user.id)).limit(1);
  if (!client || !hasActiveAccess(client)) return <main className="portal-shell"><section className="empty-state"><h1>Acompanhamento indisponível.</h1><p>Aguarde a confirmação do pagamento ou renove seu plano.</p><Link className="button button-dark" href="/area-cliente">Voltar</Link></section></main>;

  const [photos, assessments] = await Promise.all([
    db.select().from(progressPhotos).where(eq(progressPhotos.clientEmail, client.email)).orderBy(asc(progressPhotos.period)),
    db.select().from(nfClinicalAssessments).where(eq(nfClinicalAssessments.clientId, client.id)).orderBy(asc(nfClinicalAssessments.capturedAt)),
  ]);
  let objective: string | null = null;
  const context = await resolveNutriFlowPatientContext(user.id);
  if (context && await canUseNutriFlowPatientPortal(context)) {
    const portal = await createNutriFlowPatientRuntime().getPortal.execute({ actor: context.actor, organizationId: context.organizationId, organizationPublicId: context.organizationPublicId, patientName: context.patientName, modality: context.modality });
    objective = explicitObjective(portal.plan?.patientNotes ?? []);
  }

  const latest = assessments.at(-1);
  const previous = assessments.at(-2);
  const snapshot = latest ? JSON.parse(latest.snapshotJson) as any : null;
  const previousSnapshot = previous ? JSON.parse(previous.snapshotJson) as any : null;
  const grouped = Map.groupBy(photos, (photo) => photo.period);
  const periods = [...grouped.keys()];
  const firstPeriod = periods[0];
  const latestPeriod = periods.at(-1);
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const circumference = snapshot ? Object.entries(snapshot.input.circumferencesCm ?? {}).filter(([, value]) => Number(value) > 0) : [];
  const chartPoints = assessments.map((item) => {
    const itemSnapshot = JSON.parse(item.snapshotJson) as any;
    const values = Object.values(itemSnapshot.input.circumferencesCm ?? {}).filter((value) => Number(value) > 0).map(Number);
    return { label: date(item.capturedAt), weight: Number(item.weightKg), bodyFat: Number(itemSnapshot.result.bodyFatPct), leanMass: Number(itemSnapshot.result.leanMassKg), circumference: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null };
  });
  const firstPhotos = firstPeriod ? grouped.get(firstPeriod) ?? [] : [];
  const latestPhotos = latestPeriod ? grouped.get(latestPeriod) ?? [] : [];
  const currentPhotos = grouped.get(currentPeriod) ?? [];
  const photoExperience = <PhotoExperience currentPeriod={currentPeriod} currentPhotos={currentPhotos} firstPeriod={firstPeriod} latestPeriod={latestPeriod} firstPhotos={firstPhotos} latestPhotos={latestPhotos} />;

  return <PatientShell><main className="portal-shell progress-page nf-experience-page nf-evolution-redesign">
    <header className="portal-header"><Link className="portal-brand" href="/area-cliente">← Área do paciente</Link><form action="/auth/sair" method="post"><button className="auth-signout" type="submit">Sair</button></form></header>
    {!latest || !snapshot ? <><section className="evolution-empty"><p className="section-kicker">Evolução</p><h1>Seu acompanhamento começa aqui.</h1><p>Você ainda não tem avaliações registradas. Assim que seu nutricionista fizer sua primeira avaliação, ela aparecerá aqui.</p></section>{photoExperience}</> : <>
      <section className="evolution-overview"><div className="evolution-meta"><span>Última avaliação: {date(latest.capturedAt)}</span><span>{client.accessStartedAt ? `${Math.max(1, Math.ceil((Date.now() - new Date(client.accessStartedAt).getTime()) / 86400000))} dias de acompanhamento` : "Acompanhamento ativo"}</span></div><p className="section-kicker">Meu momento atual</p><h1>Seu progresso, acompanhado de perto.</h1><div className={`evolution-current-grid ${objective ? "has-objective" : ""}`}><article><small>Peso atual</small><strong>{number(Number(latest.weightKg))} <i>kg</i></strong></article><article><small>IMC</small><strong>{number(snapshot.result.bmi)}</strong><span>{bmiClassification(snapshot.result.bmi)}</span></article>{objective ? <article><small>Objetivo atual</small><strong className="evolution-objective">{objective}</strong></article> : null}</div></section>
      <section className="evolution-care-message"><p className="section-kicker">Seu acompanhamento</p><p>{careMessage({ objective, latest, previous })}</p></section>
      {previous && previousSnapshot ? <section className="evolution-delta"><div><p className="section-kicker">Desde sua última consulta</p><h2>Pequenas mudanças contam.</h2></div><div className="evolution-delta-grid"><article><small>Peso</small><strong>{delta(Number(latest.weightKg) - Number(previous.weightKg), "kg")}</strong></article><article><small>Gordura</small><strong>{delta(snapshot.result.bodyFatPct - previousSnapshot.result.bodyFatPct, "p.p.")}</strong></article><article><small>Massa muscular</small><strong>{delta(snapshot.result.leanMassKg - previousSnapshot.result.leanMassKg, "kg")}</strong></article></div></section> : null}
      <details className="evolution-disclosure" open><summary>Composição corporal <span>⌄</span></summary><div className="evolution-detail-grid"><article><small>Percentual de gordura</small><strong>{number(snapshot.result.bodyFatPct)}%</strong></article><article><small>Massa gorda</small><strong>{number(snapshot.result.fatMassKg)} kg</strong></article><article><small>Massa muscular estimada</small><strong>{number(snapshot.result.leanMassKg)} kg</strong><span>massa livre de gordura</span></article></div></details>
      {circumference.length ? <details className="evolution-disclosure"><summary>Circunferências <span>⌄</span></summary><div className="evolution-detail-grid">{circumference.map(([key, value]) => { const prior = previousSnapshot?.input.circumferencesCm?.[key]; return <article key={key}><small>{circumferenceLabels[key] ?? key}</small><strong>{number(Number(value))} cm</strong>{typeof prior === "number" ? <span>{delta(Number(value) - prior, "cm")}</span> : null}</article>; })}</div></details> : null}
      {photoExperience}
      <EvolutionHistoryChart points={chartPoints} />
    </>}
  </main></PatientShell>;
}
