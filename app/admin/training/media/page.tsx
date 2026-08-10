import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "../../../../db";
import { nfTrainingExercises } from "../../../../db/schema";
import { resolveNutriFlowAdminContext } from "../../../nutriflow/server";
import { requireAdmin } from "../../../supabase/server";
import GlobalMediaImportForm from "./global-media-import-form";
import { globalTrainingCatalogSlug } from "../../../../modules/nutriflow/domain/training/training-media";

export const dynamic = "force-dynamic";

export default async function GlobalTrainingMediaPage() {
  const user = await requireAdmin("/admin/training/media");
  const context = await resolveNutriFlowAdminContext(user.id);
  if (!context || context.actor.role !== "owner") notFound();
  const rows = await getDb().select({ publicId: nfTrainingExercises.publicId, name: nfTrainingExercises.name })
    .from(nfTrainingExercises)
    .where(and(eq(nfTrainingExercises.scope, "global"), eq(nfTrainingExercises.status, "active")))
    .orderBy(asc(nfTrainingExercises.name));
  const exercises = rows.map((row) => ({ publicId: row.publicId, name: row.name, slug: globalTrainingCatalogSlug(row.publicId) }));

  return (
    <main className="portal-shell training-global-media-page">
      <header className="portal-header">
        <Link className="portal-brand" href="/admin/clientes">← Gestão da consultoria</Link>
        <span>NutriFlow Training</span>
      </header>
      <section className="admin-panel">
        <p className="section-kicker">Biblioteca global</p>
        <h1>Mídias oficiais dos exercícios</h1>
        <p>Conteúdo estático e curado da plataforma. O upload individual continua disponível para exercícios privados da organização.</p>
        <GlobalMediaImportForm exercises={exercises} />
        <section className="training-global-media-catalog" aria-labelledby="global-media-catalog-title">
          <h2 id="global-media-catalog-title">Slugs disponíveis</h2>
          <ul>{exercises.map((exercise) => <li key={exercise.slug}><strong>{exercise.name}</strong><code>{exercise.slug}</code></li>)}</ul>
        </section>
      </section>
    </main>
  );
}
