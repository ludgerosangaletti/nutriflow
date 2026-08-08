import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "../../db";
import { checkIns, clients } from "../../db/schema";
import { hasActiveAccess } from "../access";
import { requirePatient } from "../supabase/server";
import CheckInForm from "./check-in-form";
import { PatientShell } from "../patient-experience/shell/PatientShell";
import { isWeeklyCheckInAvailable, nextCheckInDateLabel } from "./availability";

export const dynamic = "force-dynamic";
function weekStart(date = new Date()) { const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); const day = utc.getUTCDay() || 7; utc.setUTCDate(utc.getUTCDate() - day + 1); return utc.toISOString().slice(0, 10); }
function dateLabel(value: string) { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }

export default async function CheckInPage() {
  const user = await requirePatient("/check-in");
  const db = getDb();
  const [client] = await db.select().from(clients).where(eq(clients.authUserId, user.id)).limit(1);
  if (!client || !hasActiveAccess(client)) return <main className="portal-shell"><section className="empty-state"><h1>Check-in indisponível.</h1><p>Aguarde a confirmação do pagamento ou renove seu plano.</p><Link className="button button-dark" href="/area-cliente">Voltar</Link></section></main>;
  const history = await db.select().from(checkIns).where(eq(checkIns.clientEmail, client.email)).orderBy(desc(checkIns.weekStart));
  const completedThisWeek = history.some((item) => item.weekStart === weekStart());
  const availableToday = isWeeklyCheckInAvailable();
  const status = completedThisWeek ? "Enviado ✓" : availableToday ? "Disponível" : "Abre na segunda";
  return (
    <PatientShell><main className="portal-shell checkin-page nf-experience-page nf-checkin-v2">
      <header className="portal-header"><Link className="portal-brand" href="/area-cliente">← Área do paciente</Link><form action="/auth/sair" method="post"><button className="auth-signout" type="submit">Sair</button></form></header>
      <section className="nf-checkin-intro"><div><p className="section-kicker">Seu momento da semana</p><h1>{completedThisWeek ? "Check-in concluído." : availableToday ? "Como você está?" : "Seu check-in abre na segunda-feira."}</h1><p>{completedThisWeek ? "Suas respostas já estão disponíveis para o nutricionista." : availableToday ? "São cerca de 3 minutos, uma pergunta por vez." : `Próxima abertura: ${nextCheckInDateLabel()}. Reserve alguns minutos para registrar sua semana.`}</p></div><span className={completedThisWeek ? "is-done" : availableToday ? "" : "is-waiting"}>{status}</span></section>
      {!completedThisWeek && availableToday ? <section className="checkin-form-section"><CheckInForm /></section> : null}
      <section className="checkin-history"><p className="section-kicker">Histórico</p><h2>{history.length ? "Seus check-ins" : "Seu primeiro registro aparecerá aqui"}</h2><div className="checkin-history-grid">{history.map((item) => <article key={item.id}><span>Semana de {dateLabel(item.weekStart)}</span><strong>{item.weightKg ? `${item.weightKg.replace(".", ",")} kg` : "Peso não informado"}</strong><div><span>Aderência <b>{item.adherence}/5</b></span><span>Sono <b>{item.sleep}/5</b></span><span>Energia <b>{item.energy}/5</b></span></div><small>{item.adminStatus === "reviewed" ? "Revisado pelo nutricionista" : "Aguardando análise"}</small></article>)}</div></section>
    </main></PatientShell>
  );
}
