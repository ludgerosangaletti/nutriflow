import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "../../../../db";
import { anamneses, clients, progressPhotos } from "../../../../db/schema";
import { requireAdmin } from "../../../supabase/server";
import { fieldLabels, sections, type Answers } from "../../../anamnese/questions";

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
  const angleLabels: Record<string, string> = {
    front: "Frente",
    side: "Lado",
    back: "Costas",
  };

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
      </section>
      <div className="response-sections">
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
