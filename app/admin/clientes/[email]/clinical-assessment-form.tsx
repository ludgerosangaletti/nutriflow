"use client";
import { useState } from "react";
const skin = ["triceps","subscapular","suprailiac","abdominal","midaxillary","pectoral","thigh"] as const;
const circ = ["arm","waist","abdomen","hip","thigh"] as const;
const skinLabels: Record<(typeof skin)[number], string> = {
  triceps: "Tríceps",
  subscapular: "Subescapular",
  suprailiac: "Supra-ilíaca",
  abdominal: "Abdominal",
  midaxillary: "Axilar média",
  pectoral: "Peitoral",
  thigh: "Coxa",
};
const circumferenceLabels: Record<(typeof circ)[number], string> = {
  arm: "Braço",
  waist: "Cintura",
  abdomen: "Abdômen",
  hip: "Quadril",
  thigh: "Coxa",
};
export default function ClinicalAssessmentForm({ email }: { email: string }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [calculation, setCalculation] = useState<{ sumSkinfoldsMm: number; bmi: number; bodyFatPct: number; fatMassKg: number; leanMassKg: number } | null>(null);
  const inputFrom = (form: HTMLFormElement) => {
    const values = new FormData(form);
    const number = (key: string) => Number(values.get(key));
    const optional = Object.fromEntries(circ.flatMap((key) => {
      const raw = String(values.get(key) ?? "").trim();
      return raw ? [[key, Number(raw)]] : [];
    }));
    return { sex: String(values.get("sex")) as "male" | "female", age: number("age"), weightKg: number("weightKg"), heightCm: number("heightCm"), measurementSide: String(values.get("measurementSide")) as "left" | "right", skinfoldsMm: Object.fromEntries(skin.map((key) => [key, number(key)])), circumferencesCm: optional };
  };
  async function calculate(form: HTMLFormElement) {
    setCalculating(true); setMessage("");
    const response = await fetch("/api/admin/clinical-assessments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, mode: "preview", input: inputFrom(form) }) });
    const data = await response.json().catch(() => ({}));
    setCalculating(false);
    if (!response.ok) { setCalculation(null); setMessage(data.error || "Não foi possível calcular a avaliação."); return; }
    setCalculation(data.calculation); setMessage("Resultado calculado. Revise antes de salvar a avaliação.");
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!calculation) { setMessage("Calcule os resultados antes de salvar a avaliação."); return; }
    setSaving(true); setMessage(""); const input = inputFrom(e.currentTarget);
    const response = await fetch("/api/admin/clinical-assessments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, mode: "save", input }) });
    const data = await response.json().catch(() => ({})); setSaving(false);
    setMessage(response.ok ? "Avaliação registrada como snapshot imutável." : data.error || "Não foi possível registrar.");
    if (response.ok) window.location.reload();
  }
  return <form className="clinical-assessment-form" onSubmit={submit} onChange={() => { if (calculation) { setCalculation(null); setMessage("Dados alterados. Calcule novamente antes de salvar."); } }}><p className="section-kicker">Avaliação física · Pollock 7</p><h3>Novo registro presencial</h3><p className="clinical-form-hint">Circunferências são opcionais. Para calcular Pollock 7, preencha idade, peso, altura e as sete dobras.</p><div className="form-grid"><label>Sexo<select name="sex" defaultValue="male"><option value="male">Masculino</option><option value="female">Feminino</option></select></label><label>Idade<input name="age" type="number" min="18" max="100" /></label><label>Peso (kg)<input name="weightKg" type="number" step="0.1" /></label><label>Altura (cm)<input name="heightCm" type="number" step="0.1" /></label><label>Lado das circunferências<select name="measurementSide"><option value="right">Direito</option><option value="left">Esquerdo</option></select></label></div><h4>Dobras cutâneas (mm)</h4><div className="form-grid">{skin.map(k=><label key={k}>{skinLabels[k]}<input name={k} type="number" step="0.1" min="0.1" /></label>)}</div><h4>Circunferências (cm) <small>opcional</small></h4><div className="form-grid">{circ.map(k=><label key={k}>{circumferenceLabels[k]}<input name={k} type="number" step="0.1" min="1" /></label>)}</div><div className="clinical-assessment-actions"><button className="button button-secondary" type="button" onClick={(event) => calculate(event.currentTarget.form!)} disabled={calculating || saving}>{calculating ? "Calculando…" : "Calcular resultados"}</button>{calculation ? <button className="button button-dark" disabled={saving || calculating}>{saving ? "Salvando…" : "Salvar avaliação"}</button> : null}</div>{calculation ? <section className="clinical-calculation-preview" aria-live="polite"><p className="section-kicker">Resultado calculado</p><div><span><small>IMC</small><strong>{calculation.bmi.toFixed(1)}</strong></span><span><small>Gordura corporal</small><strong>{calculation.bodyFatPct.toFixed(1)}%</strong></span><span><small>Massa gorda</small><strong>{calculation.fatMassKg.toFixed(1)} kg</strong></span><span><small>Massa livre de gordura</small><strong>{calculation.leanMassKg.toFixed(1)} kg</strong></span><span><small>Soma das dobras</small><strong>{calculation.sumSkinfoldsMm.toFixed(1)} mm</strong></span></div></section> : null}{message && <p role="status">{message}</p>}</form>;
}
