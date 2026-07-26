import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "../../db";
import { checkIns, clients, goalProgress, goals } from "../../db/schema";
import { hasActiveAccess } from "../access";
import ProgressCharts from "../progress-charts";
import { requirePatient } from "../supabase/server";

export const dynamic = "force-dynamic";

export default async function ChartsPage() {
  const user = await requirePatient("/graficos");
  const db = getDb();
  const [client] = await db.select().from(clients).where(eq(clients.authUserId, user.id)).limit(1);

  if (!client || !hasActiveAccess(client)) {
    return <main className="portal-shell"><section className="empty-state"><h1>Evolução indisponível.</h1><p>Aguarde a confirmação do pagamento ou renove seu plano.</p><Link className="button button-dark" href="/area-cliente">Voltar</Link></section></main>;
  }

  const [patientCheckIns, patientGoals, patientGoalProgress] = await Promise.all([
    db.select().from(checkIns).where(eq(checkIns.clientEmail, client.email)).orderBy(asc(checkIns.weekStart)),
    db.select().from(goals).where(eq(goals.clientEmail, client.email)).orderBy(asc(goals.createdAt)),
    db.select().from(goalProgress).where(eq(goalProgress.clientEmail, client.email)).orderBy(asc(goalProgress.createdAt)),
  ]);

  return (
    <main className="portal-shell charts-page">
      <header className="portal-header">
        <Link className="portal-brand" href="/area-cliente">← Área do Paciente</Link>
        <form action="/auth/sair" method="post"><button className="auth-signout" type="submit">Sair</button></form>
      </header>
      <section className="charts-hero">
        <div>
          <p className="section-kicker">Evolução em gráficos</p>
          <h1>Dados que contam a sua evolução.</h1>
          <p>Visualize tendências dos seus check-ins e metas. Os gráficos são atualizados automaticamente a cada novo registro.</p>
        </div>
        <aside>
          <span>Leitura responsável</span>
          <p>Resultados devem ser interpretados em conjunto com sua rotina, sintomas e evolução clínica — não apenas por um número isolado.</p>
        </aside>
      </section>
      <section className="charts-content">
        <ProgressCharts checkIns={patientCheckIns} goalProgress={patientGoalProgress} goals={patientGoals} />
      </section>
    </main>
  );
}
