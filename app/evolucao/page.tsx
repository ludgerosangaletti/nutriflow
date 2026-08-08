import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "../../db";
import { clients, progressPhotos, nfClinicalAssessments } from "../../db/schema";
import { hasActiveAccess } from "../access";
import { requirePatient } from "../supabase/server";
import PhotoUploadForm from "./photo-upload-form";
import { PatientShell } from "../patient-experience/shell/PatientShell";

export const dynamic = "force-dynamic";

const angleLabels: Record<string, string> = {
  front: "Frente",
  side: "Lado",
  back: "Costas",
};

function periodLabel(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export default async function ProgressPage() {
  const user = await requirePatient("/evolucao");
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
          <h1>Acompanhamento indisponível.</h1>
          <p>Aguarde a confirmação do pagamento ou renove seu plano.</p>
          <Link className="button button-dark" href="/area-cliente">Voltar</Link>
        </section>
      </main>
    );
  }

  const photos = await db
    .select()
    .from(progressPhotos)
    .where(eq(progressPhotos.clientEmail, client.email))
    .orderBy(asc(progressPhotos.period));
  const assessments = await db.select().from(nfClinicalAssessments).where(eq(nfClinicalAssessments.clientId, client.id)).orderBy(asc(nfClinicalAssessments.capturedAt));
  const latestAssessment = assessments.at(-1);
  const previousAssessment = assessments.at(-2);
  const assessmentSnapshot = latestAssessment ? JSON.parse(latestAssessment.snapshotJson) as { result: { bmi:number; bodyFatPct:number; leanMassKg:number; fatMassKg:number }; input: { circumferencesCm: Record<string,number> } } : null;
  const previousSnapshot = previousAssessment ? JSON.parse(previousAssessment.snapshotJson) as { result: { bmi:number; bodyFatPct:number; leanMassKg:number; fatMassKg:number } } : null;
  const grouped = Map.groupBy(photos, (photo) => photo.period);
  const periods = [...grouped.keys()];
  const firstPeriod = periods[0];
  const latestPeriod = periods.at(-1);
  const currentPeriod = new Date().toISOString().slice(0, 7);

  return (
    <PatientShell><main className="portal-shell progress-page nf-experience-page nf-progress-v2">
      <header className="portal-header">
        <Link className="portal-brand" href="/area-cliente">← Área do paciente</Link>
        <form action="/auth/sair" method="post">
          <button className="auth-signout" type="submit">Sair</button>
        </form>
      </header>

      <section className="nf-progress-intro">
        <div><p className="section-kicker">Sua evolução</p><h1>Acompanhe mudanças reais, no seu ritmo.</h1><p>As fotos são opcionais e ficam protegidas no seu acompanhamento.</p></div>
        <div className="nf-progress-count"><strong>{periods.length}</strong><span>{periods.length === 1 ? "registro mensal" : "registros mensais"}</span></div>
      </section>

      <section className="clinical-current-moment">
        <p className="section-kicker">Meu momento atual</p>
        <h2>{latestAssessment ? "Você está sendo acompanhado de perto." : "Sua evolução começa aqui."}</h2>
        {assessmentSnapshot ? <><p>Última avaliação em {new Intl.DateTimeFormat("pt-BR").format(new Date(latestAssessment!.capturedAt))}. O mais importante é observar o conjunto das mudanças ao longo do tempo.</p><div className="clinical-metric-grid"><div><small>Peso</small><strong>{latestAssessment!.weightKg.replace(".", ",")} kg</strong></div><div><small>IMC</small><strong>{Number(assessmentSnapshot.result.bmi).toFixed(1).replace(".", ",")}</strong></div><div><small>Gordura corporal</small><strong>{Number(assessmentSnapshot.result.bodyFatPct).toFixed(1).replace(".", ",")}%</strong></div><div><small>Massa livre de gordura</small><strong>{Number(assessmentSnapshot.result.leanMassKg).toFixed(1).replace(".", ",")} kg</strong></div></div>{previousSnapshot ? <div className="clinical-comparison"><b>Comparação com a avaliação anterior</b><span>Peso: {((Number(latestAssessment!.weightKg)-Number(previousAssessment!.weightKg))>=0?"+":"")}{(Number(latestAssessment!.weightKg)-Number(previousAssessment!.weightKg)).toFixed(1)} kg · Gordura: {((assessmentSnapshot.result.bodyFatPct-previousSnapshot.result.bodyFatPct)>=0?"+":"")}{(assessmentSnapshot.result.bodyFatPct-previousSnapshot.result.bodyFatPct).toFixed(1)} p.p. · Massa livre: {((assessmentSnapshot.result.leanMassKg-previousSnapshot.result.leanMassKg)>=0?"+":"")}{(assessmentSnapshot.result.leanMassKg-previousSnapshot.result.leanMassKg).toFixed(1)} kg</span></div> : null}</> : <p>A primeira avaliação física será adicionada pelo nutricionista. Enquanto isso, suas fotos continuam disponíveis nesta área.</p>}
      </section>

      {assessmentSnapshot ? <details className="clinical-composition" open><summary>Composição corporal e circunferências <span>⌄</span></summary><div>{Object.entries(assessmentSnapshot.input.circumferencesCm).map(([name,value])=><span key={name}><small>{name}</small><b>{value} cm</b></span>)}</div></details> : null}

      <details className="nf-photo-guide">
        <summary><span>Como tirar fotos comparáveis</span><small>4 orientações rápidas</small></summary>
        <ul><li>Use o mínimo de roupa com que se sentir confortável.</li><li>Escolha um ambiente bem iluminado e fundo neutro.</li><li>Mantenha distância, posição e iluminação semelhantes.</li><li>Faça frente, lado e costas com postura natural.</li></ul>
      </details>

      <section className="photo-upload-section">
        <div className="nf-section-heading"><div><p className="section-kicker">Novo registro</p><h2>Adicionar fotos do mês</h2></div><span>Opcional</span></div>
        <PhotoUploadForm defaultPeriod={currentPeriod} />
      </section>

      {firstPeriod && latestPeriod && firstPeriod !== latestPeriod ? (
        <section className="comparison-section">
          <p className="section-kicker">Antes e agora</p>
          <h2>{periodLabel(firstPeriod)} × {periodLabel(latestPeriod)}</h2>
          <p className="comparison-note">
            Observe principalmente contorno corporal, postura e proporções. A
            padronização das fotos ajuda a evitar diferenças causadas por luz,
            distância ou ângulo.
          </p>
          <div className="comparison-angles">
            {["front", "side", "back"].map((angle) => {
              const first = grouped.get(firstPeriod)?.find((photo) => photo.angle === angle);
              const latest = grouped.get(latestPeriod)?.find((photo) => photo.angle === angle);
              if (!first || !latest) return null;
              return (
                <article className="comparison-angle" key={angle}>
                  <h3>{angleLabels[angle]}</h3>
                  <div>
                    <figure>
                      <img alt={`${angleLabels[angle]} — registro inicial`} src={`/api/evolucao/foto?id=${first.id}`} />
                      <figcaption>Início · {periodLabel(firstPeriod)}</figcaption>
                    </figure>
                    <figure>
                      <img alt={`${angleLabels[angle]} — registro atual`} src={`/api/evolucao/foto?id=${latest.id}`} />
                      <figcaption>Atual · {periodLabel(latestPeriod)}</figcaption>
                    </figure>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="photo-history">
        <p className="section-kicker">Histórico</p>
        <h2>{periods.length ? "Seus registros mensais" : "Nenhum registro enviado"}</h2>
        {!periods.length ? (
          <p>Quando desejar, faça o primeiro registro usando o formulário acima.</p>
        ) : (
          periods.toReversed().map((period) => (
            <article className="photo-month" key={period}>
              <h3>{periodLabel(period)}</h3>
              <div className="photo-month-grid">
                {grouped.get(period)?.map((photo) => (
                  <figure key={photo.id}>
                    <img alt={`${angleLabels[photo.angle]} — ${periodLabel(period)}`} src={`/api/evolucao/foto?id=${photo.id}`} />
                    <figcaption>{angleLabels[photo.angle]}</figcaption>
                  </figure>
                ))}
              </div>
            </article>
          ))
        )}
      </section>
    </main></PatientShell>
  );
}
