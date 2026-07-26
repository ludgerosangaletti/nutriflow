import { asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "../../db";
import { clients, goalProgress, goals } from "../../db/schema";
import { hasActiveAccess } from "../access";
import { requirePatient } from "../supabase/server";
import GoalProgressForm from "./goal-progress-form";

export const dynamic = "force-dynamic";

const categoryLabels: Record<string, string> = {
  weight: "Peso corporal",
  waist: "Circunferência",
  hydration: "Hidratação",
  training: "Treinos",
  cardio: "Cardio",
  adherence: "Adesão ao plano",
  sleep: "Sono",
  bowel: "Funcionamento intestinal",
  meals: "Organização alimentar",
  custom: "Meta personalizada",
};

const statusLabels: Record<string, string> = {
  active: "Em andamento",
  achieved: "Alcançada",
  adjusted: "Ajustada",
  closed: "Encerrada",
};

function progressPercent(initial: string, current: string, target: string) {
  const start = Number(initial), now = Number(current), end = Number(target);
  if (![start, now, end].every(Number.isFinite) || start === end) return 0;
  return Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
}

export default async function GoalsPage() {
  const user = await requirePatient("/metas");
  const db = getDb();
  const [client] = await db.select().from(clients).where(eq(clients.authUserId, user.id)).limit(1);
  if (!client || !hasActiveAccess(client)) return <main className="portal-shell"><section className="empty-state"><h1>Metas indisponíveis.</h1><p>Aguarde a confirmação do pagamento ou renove seu plano.</p><Link className="button button-dark" href="/area-cliente">Voltar</Link></section></main>;

  const patientGoals = await db.select().from(goals).where(eq(goals.clientEmail, client.email)).orderBy(asc(goals.createdAt));
  const progress = await db.select().from(goalProgress).where(eq(goalProgress.clientEmail, client.email)).orderBy(desc(goalProgress.createdAt));

  return (
    <main className="portal-shell goals-page">
      <header className="portal-header"><Link className="portal-brand" href="/area-cliente">← Área do paciente</Link><form action="/auth/sair" method="post"><button className="auth-signout" type="submit">Sair</button></form></header>
      <section className="goals-hero">
        <div><p className="section-kicker">Metas em conjunto</p><h1>Objetivos claros.<br />Progresso possível.</h1><p>Suas metas são definidas com orientação profissional e acompanhadas ao longo da consultoria.</p></div>
        <aside><span>Foco atual</span><strong>{patientGoals.filter((goal) => goal.status === "active").length}/3</strong><p>metas ativas</p></aside>
      </section>
      {!patientGoals.length ? (
        <section className="goals-empty"><strong>Suas primeiras metas ainda serão definidas.</strong><p>Após avaliar sua anamnese e seu protocolo, Ludgero adicionará aqui os objetivos prioritários do acompanhamento.</p></section>
      ) : (
        <section className="goals-grid">
          {patientGoals.map((goal) => {
            const percent = progressPercent(goal.initialValue, goal.currentValue, goal.targetValue);
            const history = progress.filter((item) => item.goalId === goal.id);
            return (
              <article className={`goal-card goal-${goal.status}`} key={goal.id}>
                <header><span>{categoryLabels[goal.category] || goal.category}</span><b>{statusLabels[goal.status] || goal.status}</b></header>
                <h2>{goal.title}</h2>
                <div className="goal-numbers"><div><span>Início</span><strong>{goal.initialValue} {goal.unit}</strong></div><div><span>Atual</span><strong>{goal.currentValue} {goal.unit}</strong></div><div><span>Objetivo</span><strong>{goal.targetValue} {goal.unit}</strong></div></div>
                <div className="goal-progress-bar"><i style={{ width: `${percent}%` }} /></div>
                <div className="goal-meta"><span>{percent}% do caminho</span>{goal.deadline ? <span>Prazo: {goal.deadline.split("-").reverse().join("/")}</span> : null}</div>
                {goal.professionalNote ? <blockquote>{goal.professionalNote}</blockquote> : null}
                {goal.status === "active" ? <GoalProgressForm goalId={goal.id} unit={goal.unit} /> : null}
                {history.length ? <details><summary>Ver histórico ({history.length})</summary><ol>{history.map((item) => <li key={item.id}><span>{new Intl.DateTimeFormat("pt-BR").format(new Date(item.createdAt))}</span><strong>{item.value} {goal.unit}</strong>{item.note ? <p>{item.note}</p> : null}</li>)}</ol></details> : null}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
