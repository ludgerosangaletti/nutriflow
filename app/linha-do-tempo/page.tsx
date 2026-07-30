import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "../../db";
import {
  adjustmentRequests,
  anamneses,
  checkIns,
  clients,
  goals,
  patientDocuments,
  progressPhotos,
} from "../../db/schema";
import { hasActiveAccess } from "../access";
import { requirePatient } from "../supabase/server";
import TimelineList from "../timeline-list";
import { buildTimeline } from "../timeline";

export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  const user = await requirePatient("/linha-do-tempo");
  const db = getDb();
  const [client] = await db.select().from(clients).where(eq(clients.authUserId, user.id)).limit(1);
  if (client?.modality === "in_person") redirect("/area-cliente");

  if (!client) {
    return <main className="portal-shell"><section className="empty-state"><h1>Cadastro não encontrado.</h1></section></main>;
  }

  const [anamnesis, documents, patientCheckIns, photos, patientGoals, patientAdjustments] =
    await Promise.all([
      db.select().from(anamneses).where(eq(anamneses.clientEmail, client.email)).limit(1).then((rows) => rows[0] ?? null),
      db.select().from(patientDocuments).where(eq(patientDocuments.clientEmail, client.email)),
      db.select().from(checkIns).where(eq(checkIns.clientEmail, client.email)),
      db.select().from(progressPhotos).where(eq(progressPhotos.clientEmail, client.email)),
      db.select().from(goals).where(eq(goals.clientEmail, client.email)),
      db.select().from(adjustmentRequests).where(eq(adjustmentRequests.clientEmail, client.email)),
    ]);

  const events = buildTimeline({
    client,
    anamnesis,
    documents,
    checkIns: patientCheckIns,
    photos,
    goals: patientGoals,
    adjustments: patientAdjustments,
  });
  const active = hasActiveAccess(client);

  return (
    <main className="portal-shell timeline-page">
      <header className="portal-header">
        <Link className="portal-brand" href="/area-cliente">← Área do Paciente</Link>
        <form action="/auth/sair" method="post"><button className="auth-signout" type="submit">Sair</button></form>
      </header>
      <section className="timeline-hero">
        <div>
          <p className="section-kicker">Sua jornada</p>
          <h1>Linha do tempo da consultoria</h1>
          <p>Relembre cada etapa do acompanhamento e saiba o que já foi construído até aqui.</p>
        </div>
        <div className="timeline-summary">
          <span>{active ? "Acompanhamento ativo" : "Ciclo encerrado"}</span>
          <strong>{events.filter((event) => !event.future).length}</strong>
          <p>acontecimentos registrados</p>
        </div>
      </section>
      <section className="timeline-panel">
        <TimelineList events={events} />
      </section>
    </main>
  );
}
