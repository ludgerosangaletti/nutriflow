import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "../../db";
import { clients, progressPhotos } from "../../db/schema";
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
  const grouped = Map.groupBy(photos, (photo) => photo.period);
  const periods = [...grouped.keys()];
  const firstPeriod = periods[0];
  const latestPeriod = periods.at(-1);
  const currentPeriod = new Date().toISOString().slice(0, 7);

  return (
    <PatientShell><main className="portal-shell progress-page nf-experience-page">
      <header className="portal-header">
        <Link className="portal-brand" href="/area-cliente">← Área do paciente</Link>
        <form action="/auth/sair" method="post">
          <button className="auth-signout" type="submit">Sair</button>
        </form>
      </header>

      <section className="progress-hero">
        <div>
          <p className="section-kicker">Registro fotográfico</p>
          <h1>
            {client.modality === "in_person"
              ? "Suas fotos de acompanhamento."
              : "Seu registro de evolução."}
          </h1>
          <p>
            Este espaço é totalmente opcional. Envie as imagens somente se
            você se sentir confortável. Elas serão utilizadas para acompanhar
            sua evolução ao longo da consultoria.
          </p>
        </div>
        <aside className="photo-guidance">
          <strong>Para um comparativo mais fiel</strong>
          <ul>
            <li>Use o mínimo de roupa com que se sentir confortável.</li>
            <li>Escolha um ambiente bem iluminado e fundo neutro.</li>
            <li>Mantenha distância, posição e iluminação semelhantes.</li>
            <li>Faça as fotos de frente, lado e costas, com postura natural.</li>
          </ul>
        </aside>
      </section>

      <section className="photo-upload-section">
        <p className="section-kicker">Novo registro mensal</p>
        <h2>Adicionar três ângulos</h2>
        <PhotoUploadForm defaultPeriod={currentPeriod} />
      </section>

      {firstPeriod && latestPeriod && firstPeriod !== latestPeriod ? (
        <section className="comparison-section">
          <p className="section-kicker">Comparativo de evolução</p>
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
