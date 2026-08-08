"use client";

import { useMemo, useState } from "react";

type Point = { label: string; weight: number; bodyFat: number; leanMass: number; circumference: number | null };
const metrics = [
  ["weight", "Peso", "kg"],
  ["bodyFat", "% gordura", "%"],
  ["leanMass", "Massa muscular", "kg"],
  ["circumference", "Circunferências", "cm"],
] as const;

export default function EvolutionHistoryChart({ points }: { points: Point[] }) {
  const [metric, setMetric] = useState<(typeof metrics)[number][0]>("weight");
  const selected = metrics.find(([key]) => key === metric)!;
  const series = useMemo(() => points.map((point) => ({ ...point, value: point[metric] })).filter((point): point is Point & { value: number } => typeof point.value === "number" && Number.isFinite(point.value)), [points, metric]);
  const values = series.map((point) => point.value);
  const min = Math.min(...values), max = Math.max(...values), span = Math.max(max - min, 1);
  const polyline = series.map((point, index) => `${series.length === 1 ? 50 : (index / (series.length - 1)) * 100},${92 - ((point.value - min) / span) * 70}`).join(" ");
  return <section className="evolution-history" aria-label="Histórico da evolução"><div className="evolution-section-heading"><div><p className="section-kicker">Histórico</p><h2>Veja sua trajetória</h2></div></div><div className="evolution-history-tabs" role="tablist">{metrics.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={metric === key} onClick={() => setMetric(key)}>{label}</button>)}</div>{series.length ? <><div className="evolution-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${selected[1]} ao longo das avaliações`}><line x1="0" x2="100" y1="92" y2="92"/><polyline points={polyline}/>{series.map((point,index)=><circle key={point.label} cx={series.length === 1 ? 50 : (index / (series.length - 1)) * 100} cy={92 - ((point.value - min) / span) * 70} r="2.6"/>)}</svg></div><div className="evolution-chart-caption"><strong>{series.at(-1)!.value.toFixed(1).replace(".", ",")} {selected[2]}</strong><span>Última avaliação</span></div></> : <p className="evolution-muted">Ainda não há dados suficientes para este gráfico.</p>}</section>;
}
