import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "../../db";
import { checkIns, clients } from "../../db/schema";
import { hasActiveAccess } from "../access";
import { PatientShell } from "../patient-experience/shell/PatientShell";
import { requirePatient } from "../supabase/server";
import CheckInForm from "./check-in-form";
import { isWeeklyCheckInAvailable, nextCheckInDateLabel } from "./availability";

export const dynamic = "force-dynamic";

function weekStart(date = new Date()) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() - day + 1);
  return utc.toISOString().slice(0, 10);
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export default async function CheckInPage() {
  const user = await requirePatient("/check-in");
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
          <h1>Check-in indisponível.</h1>
          <p>Aguarde a confirmação do pagamento ou renove seu plano.</p>
          <Link className="button button-dark" href="/area-cliente">Voltar</Link>
        </section>
      </main>
    );
  }

  const history = await db
    .select()
    .from(checkIns)
    .where(eq(checkIns.clientEmail, client.email))
    .orderBy(desc(checkIns.weekStart));
  const completedThisWeek = history.some((item) => item.weekStart === weekStart());
  const availableToday = isWeeklyCheckInAvailable();

  return (
    <PatientShell>
      <main className="portal-shell checkin-page nf-experience-page nf-checkin-v3">
        <header className="portal-header">
          <Link className="portal-brand" href="/area-cliente">← Área do paciente</Link>
          <form action="/auth/sair" method="post">
            <button className="auth-signout" type="submit">Sair</button>
          </form>
        </header>

        {completedThisWeek ? (
          <section className="nf-checkin-complete" aria-labelledby="checkin-complete-title">
            <div>
              <p className="section-kicker">Enviado</p>
              <h1 id="checkin-complete-title">Check-in registrado.</h1>
              <p>Ludgero costuma responder em até 48 horas. Quando houver um retorno, ele aparecerá no histórico abaixo.</p>
            </div>
            <span aria-label="Check-in enviado">✓</span>
          </section>
        ) : (
          <section className="nf-checkin-intro">
            <div>
              <p className="section-kicker">Seu momento da semana</p>
              <h1>{availableToday ? "Como você está?" : "Seu check-in abre na segunda-feira."}</h1>
              <p>{availableToday ? "São cerca de 3 minutos, uma pergunta por vez." : `Próxima abertura: ${nextCheckInDateLabel()}. Reserve alguns minutos para registrar sua semana.`}</p>
            </div>
            <span className={availableToday ? "" : "is-waiting"}>{availableToday ? "Disponível" : "Abre na segunda"}</span>
          </section>
        )}

        {!completedThisWeek && availableToday ? (
          <section className="checkin-form-section"><CheckInForm /></section>
        ) : null}

        <section className="nf-checkin-history" aria-labelledby="checkin-history-title">
          <header>
            <div>
              <p className="section-kicker">Histórico</p>
              <h2 id="checkin-history-title">{history.length ? "Seu acompanhamento semanal" : "Seu primeiro registro aparecerá aqui"}</h2>
            </div>
            {history.length ? <span>{history.length} {history.length === 1 ? "registro" : "registros"}</span> : null}
          </header>

          {history.length ? (
            <div className="nf-checkin-history-list">
              {history.map((item, index) => {
                const hasFeedback = Boolean(item.feedback.trim());
                return (
                  <article className={index === 0 ? "is-latest" : ""} key={item.id}>
                    <header>
                      <div>
                        <span>{index === 0 ? "Mais recente" : "Check-in semanal"}</span>
                        <strong>Semana de {dateLabel(item.weekStart)}</strong>
                      </div>
                      <b className={hasFeedback ? "has-feedback" : ""}>{hasFeedback ? "Com retorno" : item.adminStatus === "reviewed" ? "Revisado" : "Em análise"}</b>
                    </header>
                    <div className="nf-checkin-history-summary">
                      <div><small>Peso</small><strong>{item.weightKg ? `${item.weightKg.replace(".", ",")} kg` : "—"}</strong></div>
                      <div><small>Aderência</small><strong>{item.adherence}/5</strong></div>
                      <div><small>Sono</small><strong>{item.sleep}/5</strong></div>
                      <div><small>Energia</small><strong>{item.energy}/5</strong></div>
                    </div>
                    {hasFeedback ? (
                      <blockquote><span>Retorno do Ludgero</span><p>“{item.feedback.trim()}”</p></blockquote>
                    ) : (
                      <p className="nf-checkin-awaiting">Seu registro foi recebido e está disponível para análise.</p>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="nf-checkin-history-empty"><span>✓</span><p>Depois do primeiro envio, seus registros e os retornos do Ludgero ficarão organizados aqui.</p></div>
          )}
        </section>
      </main>
    </PatientShell>
  );
}
