"use client";

import { useMemo, useState } from "react";

type Point = { label: string; weight: number; bodyFat: number; leanMass: number; circumferences: Record<string, number> };
const metrics = [
  ["weight", "Peso", "kg"],
  ["bodyFat", "% gordura", "%"],
  ["leanMass", "Massa muscular", "kg"],
] as const;
const circumferenceLabels: Record<string, string> = { arm: "Braço", waist: "Cintura", abdomen: "Abdômen", hip: "Quadril", thigh: "Coxa" };

export default function EvolutionHistoryChart({ points }: { points: Point[] }) {
  const circumferenceKeys = Array.from(new Set(points.flatMap((point) => Object.keys(point.circumferences))));
  const options = [...metrics, ...circumferenceKeys.map((key) => [`circ:${key}`, circumferenceLabels[key] ?? key, "cm"] as const)];
  const [metric, setMetric] = useState<string>("weight");
  const selected = options.find(([key]) => key === metric) ?? options[0];
  const series = useMemo(() => points.map((point) => ({ ...point, value: metric.startsWith("circ:") ? point.circumferences[metric.slice(5)] : point[metric as "weight" | "bodyFat" | "leanMass"] })).filter((point): point is Point & { value: number } => typeof point.value === "number" && Number.isFinite(point.value)), [points, metric]);
  const values = series.map((point) => point.value);
  const min = Math.min(...values), max = Math.max(...values), span = Math.max(max - min, 1);
  const polyline = series.map((point, index) => `${series.length === 1 ? 50 : (index / (series.length - 1)) * 100},${92 - ((point.value - min) / span) * 70}`).join(" ");
  return <section className="evolution-history" aria-label="Histórico da evolução"><div className="evolution-section-heading"><div><p className="section-kicker">Histórico</p><h2>Veja sua trajetória</h2><p className="evolution-history-note">Os gráficos aparecem após duas avaliações.</p></div></div><div className="evolution-history-tabs" role="tablist">{options.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={metric === key} onClick={() => setMetric(key)}>{label}</button>)}</div>{series.length >= 2 ? <><div className="evolution-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${selected[1]} ao longo das avaliações`}><line x1="0" x2="100" y1="92" y2="92"/><polyline points={polyline}/>{series.map((point,index)=><circle key={point.label} cx={(index / (series.length - 1)) * 100} cy={92 - ((point.value - min) / span) * 70} r="2.6"/>)}</svg></div><div className="evolution-chart-caption"><strong>{series.at(-1)!.value.toFixed(1).replace(".", ",")} {selected[2]}</strong><span>Última avaliação</span></div></> : <p className="evolution-muted">Registre uma nova avaliação para comparar a evolução.</p>}</section>;
}
