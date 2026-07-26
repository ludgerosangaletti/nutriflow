"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const scales = [
  { name: "adherence", label: "Aderência ao plano alimentar", low: "Muito baixa", high: "Excelente" },
  { name: "hunger", label: "Controle da fome", low: "Muito difícil", high: "Muito bom" },
  { name: "satiety", label: "Saciedade após as refeições", low: "Muito baixa", high: "Muito boa" },
  { name: "sleep", label: "Qualidade do sono", low: "Muito ruim", high: "Excelente" },
  { name: "energy", label: "Energia e disposição", low: "Muito baixa", high: "Excelente" },
] as const;

export default function CheckInForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/check-in", { method: "POST", body: new FormData(event.currentTarget) });
    const result = await response.json() as { error?: string };
    setSaving(false);
    if (!response.ok) return setMessage(result.error || "Não foi possível enviar o check-in.");
    setMessage("Check-in enviado. Suas respostas já estão disponíveis para análise.");
    router.refresh();
  }

  return (
    <form className="checkin-form" onSubmit={submit}>
      <div className="checkin-field-row">
        <label><span>Peso atual <small>(opcional)</small></span><div className="field-with-suffix"><input inputMode="decimal" min="20" max="400" name="weightKg" placeholder="Ex.: 78,5" /><b>kg</b></div></label>
        <label><span>Treinos realizados nos últimos 7 dias</span><input inputMode="numeric" min="0" max="21" name="trainingSessions" required type="number" /></label>
      </div>
      <div className="checkin-scales">
        {scales.map((scale) => (
          <fieldset key={scale.name}>
            <legend>{scale.label}</legend>
            <div className="scale-options">
              {[1, 2, 3, 4, 5].map((value) => <label key={value}><input name={scale.name} required type="radio" value={value} /><span>{value}</span></label>)}
            </div>
            <div className="scale-caption"><span>{scale.low}</span><span>{scale.high}</span></div>
          </fieldset>
        ))}
      </div>
      <label><span>Como esteve o funcionamento intestinal?</span><select defaultValue="" name="bowelFunction" required><option disabled value="">Selecione</option><option value="regular">Regular, sem desconforto</option><option value="constipation">Mais preso que o habitual</option><option value="diarrhea">Mais solto que o habitual</option><option value="alternating">Alternando entre preso e solto</option><option value="discomfort">Com dor, gases ou desconforto</option></select></label>
      <label><span>Qual foi sua principal dificuldade nesta semana?</span><textarea maxLength={800} name="mainDifficulty" placeholder="Conte o que mais atrapalhou sua rotina, alimentação ou treinos." required /></label>
      <label><span>O que funcionou bem ou merece ser comemorado?</span><textarea maxLength={800} name="weeklyWin" placeholder="Registre uma evolução, mesmo que pequena." required /></label>
      <label><span>Há algo mais que Ludgero precisa saber? <small>(opcional)</small></span><textarea maxLength={1200} name="notes" placeholder="Sintomas, mudanças na rotina, dúvidas ou outras observações." /></label>
      <button className="button button-dark checkin-submit" disabled={saving} type="submit">{saving ? "Enviando check-in..." : "Enviar check-in semanal"}</button>
      {message ? <p className="checkin-message" role="status">{message}</p> : null}
    </form>
  );
}
