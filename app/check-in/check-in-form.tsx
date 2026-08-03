"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const scales = [
  { name: "adherence", label: "Como foi sua aderência ao plano?", low: "Foi difícil seguir", high: "Segui muito bem" },
  { name: "hunger", label: "Como ficou o controle da fome?", low: "Senti muita fome", high: "Fome bem controlada" },
  { name: "satiety", label: "Como foi sua saciedade?", low: "Pouco satisfeito", high: "Muito satisfeito" },
  { name: "sleep", label: "Como você avalia seu sono?", low: "Muito ruim", high: "Excelente" },
  { name: "energy", label: "Como esteve sua energia?", low: "Muito baixa", high: "Excelente" },
] as const;

const scaleWords = ["Muito baixo", "Baixo", "Regular", "Bom", "Excelente"];
const totalSteps = 11;

export default function CheckInForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [values, setValues] = useState<Record<string, string>>({
    weightKg: "", trainingSessions: "", adherence: "3", hunger: "3", satiety: "3",
    sleep: "3", energy: "3", bowelFunction: "", mainDifficulty: "", weeklyWin: "", notes: "",
  });
  const progress = useMemo(() => Math.round(((step + 1) / totalSteps) * 100), [step]);

  function update(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function canContinue() {
    const required = ["trainingSessions", "adherence", "hunger", "satiety", "sleep", "energy", "bowelFunction", "mainDifficulty", "weeklyWin"];
    const keys = ["weightKg", "trainingSessions", ...scales.map((item) => item.name), "bowelFunction", "mainDifficulty", "weeklyWin", "notes"];
    const key = keys[step];
    return !required.includes(key) || Boolean(values[key]?.trim());
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < totalSteps - 1) return setStep((current) => current + 1);
    setSaving(true);
    setMessage("");
    const body = new FormData();
    Object.entries(values).forEach(([key, value]) => body.set(key, value));
    const response = await fetch("/api/check-in", { method: "POST", body });
    const result = await response.json() as { error?: string };
    setSaving(false);
    if (!response.ok) return setMessage(result.error || "Não foi possível enviar o check-in.");
    setMessage("Check-in enviado. Suas respostas já estão disponíveis para análise.");
    router.refresh();
  }

  const scale = step >= 2 && step <= 6 ? scales[step - 2] : null;

  return <form className="nf-checkin-flow" onSubmit={submit}>
    <header className="nf-checkin-progress">
      <div><span>Etapa {step + 1} de {totalSteps}</span><b>{progress}%</b></div>
      <progress max="100" value={progress} aria-label={`${progress}% concluído`} />
      <p>Uma resposta por vez. Você pode voltar antes de enviar.</p>
    </header>

    <div className="nf-checkin-slide" key={step}>
      {step === 0 ? <label><span>Peso atual <small>opcional</small></span><p>Ajuda a acompanhar sua evolução ao longo das semanas.</p><div className="field-with-suffix"><input autoFocus inputMode="decimal" min="20" max="400" value={values.weightKg} onChange={(e) => update("weightKg", e.target.value)} placeholder="78,5" /><b>kg</b></div></label> : null}
      {step === 1 ? <label><span>Quantos treinos você realizou?</span><p>Considere os últimos sete dias.</p><div className="nf-stepper"><button type="button" onClick={() => update("trainingSessions", String(Math.max(0, Number(values.trainingSessions || 0) - 1)))}>−</button><strong>{values.trainingSessions || "0"}</strong><button type="button" onClick={() => update("trainingSessions", String(Math.min(21, Number(values.trainingSessions || 0) + 1)))}>＋</button></div></label> : null}
      {scale ? <fieldset className="nf-range-question"><legend>{scale.label}</legend><p>Deslize para representar melhor sua semana.</p><output>{values[scale.name]} · {scaleWords[Number(values[scale.name]) - 1]}</output><input aria-label={scale.label} min="1" max="5" step="1" type="range" value={values[scale.name]} onChange={(e) => update(scale.name, e.target.value)} /><div><span>{scale.low}</span><span>{scale.high}</span></div></fieldset> : null}
      {step === 7 ? <fieldset className="nf-choice-question"><legend>Como esteve seu funcionamento intestinal?</legend><p>Escolha a opção mais próxima da sua semana.</p>{[
        ["regular", "Regular, sem desconforto"], ["constipation", "Mais preso que o habitual"], ["diarrhea", "Mais solto que o habitual"], ["alternating", "Alternando entre preso e solto"], ["discomfort", "Com dor, gases ou desconforto"],
      ].map(([value, label]) => <button className={values.bowelFunction === value ? "is-selected" : ""} key={value} type="button" onClick={() => update("bowelFunction", value)}>{label}</button>)}</fieldset> : null}
      {step === 8 ? <label><span>Qual foi sua principal dificuldade?</span><p>Pode ser na alimentação, rotina, sono ou treinos.</p><textarea autoFocus maxLength={800} value={values.mainDifficulty} onChange={(e) => update("mainDifficulty", e.target.value)} placeholder="Conte com suas palavras..." /></label> : null}
      {step === 9 ? <label><span>O que funcionou bem?</span><p>Toda evolução conta, mesmo que pareça pequena.</p><textarea autoFocus maxLength={800} value={values.weeklyWin} onChange={(e) => update("weeklyWin", e.target.value)} placeholder="O que você gostaria de comemorar?" /></label> : null}
      {step === 10 ? <label><span>Quer acrescentar algo?</span><p>Opcional: sintomas, mudanças na rotina ou dúvidas.</p><textarea autoFocus maxLength={1200} value={values.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Escreva aqui, se desejar..." /></label> : null}
    </div>

    <footer className="nf-checkin-actions">
      <button className="nf-flow-back" disabled={step === 0 || saving} type="button" onClick={() => setStep((current) => Math.max(0, current - 1))}>Voltar</button>
      <button className="nf-flow-next" disabled={!canContinue() || saving} type="submit">{saving ? "Enviando..." : step === totalSteps - 1 ? "Enviar check-in" : "Continuar"}</button>
    </footer>
    {message ? <p className="checkin-message" role="status">{message}</p> : null}
  </form>;
}
