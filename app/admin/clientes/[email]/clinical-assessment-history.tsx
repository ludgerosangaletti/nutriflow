import type { nfClinicalAssessments } from "../../../../db/schema";
import ClinicalAssessmentDeleteButton from "./clinical-assessment-delete-button";

type Assessment = typeof nfClinicalAssessments.$inferSelect;
const labels: Record<string, string> = { arm: "Braço", waist: "Cintura", abdomen: "Abdômen", hip: "Quadril", thigh: "Coxa" };
const number = (value: number) => value.toFixed(1).replace(".", ",");

function parse(item: Assessment) {
  const snapshot = JSON.parse(item.snapshotJson) as { input?: { circumferencesCm?: Record<string, number> }; result: { bmi: number; bodyFatPct: number; leanMassKg: number } };
  return { item, snapshot, circumferences: Object.entries(snapshot.input?.circumferencesCm ?? {}).filter(([, value]) => Number(value) > 0) };
}

export default function ClinicalAssessmentHistory({ assessments, email }: { assessments: Assessment[]; email: string }) {
  const ordered = assessments.toSorted((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  const latest = ordered.at(-1);
  if (!latest) return <p>Nenhuma avaliação física registrada.</p>;
  const current = parse(latest);
  const previous = ordered.length > 1 ? parse(ordered.at(-2)!) : null;
  const dateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  return <div className="clinical-assessment-history-v2">
    <header><div><p className="section-kicker">Medidas registradas</p><h3>{previous ? "Comparativo mais recente" : "Medidas da avaliação"}</h3></div><span>{ordered.length} {ordered.length === 1 ? "avaliação" : "avaliações"}</span></header>
    <p className="clinical-history-note">{previous ? `Variação em relação à avaliação de ${new Intl.DateTimeFormat("pt-BR").format(new Date(previous.item.capturedAt))}.` : "Este registro será a base para a próxima reavaliação e comparação."}</p>
    <div className="clinical-assessment-meta-v2"><strong>{new Intl.DateTimeFormat("pt-BR").format(new Date(current.item.capturedAt))}</strong><span>Pollock 7 dobras · IMC {number(Number(current.snapshot.result.bmi))} · {number(Number(current.snapshot.result.bodyFatPct))}% gordura · {number(Number(current.snapshot.result.leanMassKg))} kg massa livre de gordura</span></div>
    <div className="clinical-assessment-records" aria-label="Avaliações registradas">{ordered.toReversed().map((assessment, index) => <div key={assessment.publicId}><span><strong>{dateTime(assessment.capturedAt)}</strong>{index === 0 ? <small>Mais recente</small> : null}</span><span className="clinical-assessment-row-actions"><a className="clinical-assessment-pdf" href={`/api/admin/clinical-assessments/report?email=${encodeURIComponent(email)}&assessment=${encodeURIComponent(assessment.publicId)}`} rel="noreferrer" target="_blank">Baixar PDF</a><a className="clinical-assessment-edit" href={`/admin/clientes/${encodeURIComponent(email)}?editAssessment=${encodeURIComponent(assessment.publicId)}#avaliacoes`}>Editar</a><ClinicalAssessmentDeleteButton email={email} publicId={assessment.publicId} label={dateTime(assessment.capturedAt)} /></span></div>)}</div>
    {current.circumferences.length ? <div className="clinical-circumference-grid">{current.circumferences.map(([key, value]) => { const oldValue = previous?.circumferences.find(([oldKey]) => oldKey === key)?.[1]; const difference = oldValue === undefined ? null : Number(value) - Number(oldValue); return <article key={key}><small>{labels[key] ?? key}</small><strong>{number(Number(value))} <i>cm</i></strong>{oldValue !== undefined ? <span>{difference === 0 ? "Sem alteração" : `${difference > 0 ? "+" : "−"}${number(Math.abs(difference))} cm desde a anterior`}</span> : <span>Primeiro registro</span>}</article>; })}</div> : <p className="clinical-history-note">Nenhuma circunferência foi informada nesta avaliação.</p>}
  </div>;
}
