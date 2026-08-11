"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TRAINING_WEEKDAYS, type TrainingWeekday } from "../../../modules/nutriflow/contracts/v1/training.ts";
import {
  TRAINING_ANAMNESIS_ACTIVITIES, TRAINING_ANAMNESIS_CURRENT_ROUTINE, TRAINING_ANAMNESIS_DURATIONS,
  TRAINING_ANAMNESIS_EQUIPMENT, TRAINING_ANAMNESIS_EXPERIENCE, TRAINING_ANAMNESIS_LOCATIONS,
  TRAINING_ANAMNESIS_OBJECTIVES, TRAINING_ANAMNESIS_PRIORITIES,
  type TrainingAnamnesisAnswersV1, type TrainingAnamnesisV1,
} from "../../../modules/nutriflow/contracts/v1/training-anamnesis.ts";

const steps = [
  ["Objetivo", "O que você quer priorizar no treinamento."],
  ["Experiência", "Seu momento atual e segurança nos exercícios."],
  ["Rotina", "A disponibilidade que realmente cabe na sua semana."],
  ["Estrutura", "Onde você treina e quais equipamentos possui."],
  ["Limitações", "Pontos de atenção para revisão profissional."],
  ["Preferências", "O que torna o treino mais sustentável para você."],
  ["Finalização", "Um último espaço para informações importantes."],
] as const;

const weekdayLabels: Record<TrainingWeekday, string> = { mon: "SEG", tue: "TER", wed: "QUA", thu: "QUI", fri: "SEX", sat: "SÁB", sun: "DOM" };

function Field({ title, hint, children }: Readonly<{ title: string; hint?: string; children: React.ReactNode }>) {
  return <fieldset className="training-anamnesis-field"><legend>{title}</legend>{hint ? <p>{hint}</p> : null}{children}</fieldset>;
}

function Choices({ options, value, onChange, multiple = false }: Readonly<{ options: readonly (readonly [string, string])[]; value: string | readonly string[] | null; onChange: (value: string | readonly string[]) => void; multiple?: boolean }>) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  return <div className="training-anamnesis-choices">{options.map(([key, label]) => <button key={key} type="button" aria-pressed={selected.includes(key)} className={selected.includes(key) ? "is-selected" : ""} onClick={() => {
    if (!multiple) return onChange(key);
    const next = selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key];
    onChange(next);
  }}>{label}</button>)}</div>;
}

function YesNo({ value, onChange }: Readonly<{ value: boolean | null; onChange: (value: boolean) => void }>) {
  return <div className="training-anamnesis-yes-no"><button type="button" className={value === true ? "is-selected" : ""} aria-pressed={value === true} onClick={() => onChange(true)}>Sim</button><button type="button" className={value === false ? "is-selected" : ""} aria-pressed={value === false} onClick={() => onChange(false)}>Não</button></div>;
}

function TextArea({ value, onChange, placeholder }: Readonly<{ value: string | null; onChange: (value: string) => void; placeholder: string }>) {
  return <textarea value={value ?? ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} />;
}

function stepComplete(step: number, a: TrainingAnamnesisAnswersV1) {
  if (step === 0) return Boolean(a.objective && a.priorities.length && (a.objective !== "other" || a.objectiveOther) && (!a.priorities.includes("other") || a.priorityOther));
  if (step === 1) return Boolean(a.experience && a.currentRoutine && a.unsafeExercises !== null && (!a.unsafeExercises || a.unsafeExercisesDetails));
  if (step === 2) return Boolean(a.trainingDaysPerWeek && a.availableDays.length && a.sessionDuration);
  if (step === 3) return Boolean(a.trainingLocation && (a.trainingLocation !== "other" || a.trainingLocationOther) && (!["limited_gym", "home"].includes(a.trainingLocation) || a.equipment.length) && (!a.equipment.includes("other") || a.equipmentOther));
  if (step === 4) return [[a.pain, a.painDetails], [a.injuryHistory, a.injuryHistoryDetails], [a.professionalRestrictions, a.professionalRestrictionsDetails], [a.healthCondition, a.healthConditionDetails]].every(([answer, details]) => answer !== null && (!answer || details));
  if (step === 5) return Boolean(a.otherActivity && (a.otherActivity === "none" || a.otherActivityFrequency) && (!["other_sport", "other_activity"].includes(a.otherActivity) || a.otherActivityDetails));
  return true;
}

export default function TrainingAnamnesisForm({ initial }: Readonly<{ initial: TrainingAnamnesisV1 }>) {
  const [answers, setAnswers] = useState(initial.answers);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [completed, setCompleted] = useState(false);
  const progress = Math.round(((step + 1) / steps.length) * 100);
  const update = (patch: Partial<TrainingAnamnesisAnswersV1>) => { setAnswers((current) => Object.freeze({ ...current, ...patch })); setMessage(""); };
  const conditionalEquipment = ["limited_gym", "home"].includes(answers.trainingLocation ?? "");
  const valid = useMemo(() => stepComplete(step, answers), [answers, step]);

  async function save(submit: boolean) {
    if (!valid) { setMessage("Responda os campos desta etapa para continuar."); return false; }
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/nutriflow/v1/training/anamnesis", { method: "PUT", headers: { "content-type": "application/json", "x-correlation-id": `corr_${crypto.randomUUID()}` }, body: JSON.stringify({ answers, submit }) });
      const result = await response.json().catch(() => ({})) as { data?: TrainingAnamnesisV1; message?: string };
      if (!response.ok || !result.data) throw new Error(result.message || "Não foi possível salvar suas respostas.");
      setAnswers(result.data.answers);
      if (submit) setCompleted(true);
      return true;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível salvar suas respostas."); return false; }
    finally { setSaving(false); }
  }

  async function next() {
    if (!(await save(false))) return;
    setStep((current) => Math.min(steps.length - 1, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (completed) return <main className="training-anamnesis-screen"><section className="training-anamnesis-complete"><span>✓</span><p>NutriFlow Training</p><h1>Anamnese de treino concluída</h1><p>Recebemos as informações necessárias para preparar seu treino. Sua prescrição será elaborada considerando seu objetivo, experiência, disponibilidade, estrutura de treino, preferências e eventuais limitações.</p><Link href="/treino">Continuar para o Training</Link></section></main>;

  return <main className="training-anamnesis-screen">
    <header className="training-anamnesis-header"><Link href="/treino">← Voltar</Link><div><p>NutriFlow Training</p><h1>{steps[step][0]}</h1><span>{steps[step][1]}</span></div><small>Etapa {step + 1} de {steps.length}</small><div className="training-anamnesis-progress" aria-label={`${progress}% concluído`}><i style={{ width: `${progress}%` }} /></div></header>
    <section className="training-anamnesis-form">
      {step === 0 ? <>
        <Field title="Qual é o seu principal objetivo com o treinamento?"><Choices options={TRAINING_ANAMNESIS_OBJECTIVES} value={answers.objective} onChange={(value) => update({ objective: value as TrainingAnamnesisAnswersV1["objective"] })} />{answers.objective === "other" ? <input value={answers.objectiveOther ?? ""} onChange={(event) => update({ objectiveOther: event.target.value })} placeholder="Qual é o seu objetivo?" /> : null}</Field>
        <Field title="Existe alguma região que gostaria de desenvolver com maior prioridade?" hint="Você pode selecionar mais de uma."><Choices multiple options={TRAINING_ANAMNESIS_PRIORITIES} value={answers.priorities} onChange={(value) => { const next = value as TrainingAnamnesisAnswersV1["priorities"]; update({ priorities: next.includes("none") && !answers.priorities.includes("none") ? ["none"] : next.filter((item) => item !== "none") }); }} />{answers.priorities.includes("other") ? <input value={answers.priorityOther ?? ""} onChange={(event) => update({ priorityOther: event.target.value })} placeholder="Qual outra região?" /> : null}</Field>
      </> : null}
      {step === 1 ? <>
        <Field title="Há quanto tempo pratica musculação?"><Choices options={TRAINING_ANAMNESIS_EXPERIENCE} value={answers.experience} onChange={(value) => update({ experience: value as TrainingAnamnesisAnswersV1["experience"] })} /></Field>
        <Field title="Atualmente, como está sua rotina de musculação?"><Choices options={TRAINING_ANAMNESIS_CURRENT_ROUTINE} value={answers.currentRoutine} onChange={(value) => update({ currentRoutine: value as TrainingAnamnesisAnswersV1["currentRoutine"] })} /></Field>
        <Field title="Existe algum exercício que você não saiba executar ou não se sinta seguro fazendo?"><YesNo value={answers.unsafeExercises} onChange={(value) => update({ unsafeExercises: value, unsafeExercisesDetails: value ? answers.unsafeExercisesDetails : null })} />{answers.unsafeExercises ? <TextArea value={answers.unsafeExercisesDetails} onChange={(value) => update({ unsafeExercisesDetails: value })} placeholder="Quais exercícios?" /> : null}</Field>
      </> : null}
      {step === 2 ? <>
        <Field title="Quantos dias por semana você realmente consegue treinar?"><div className="training-anamnesis-number">{[1,2,3,4,5,6,7].map((number) => <button type="button" key={number} className={answers.trainingDaysPerWeek === number ? "is-selected" : ""} onClick={() => update({ trainingDaysPerWeek: number })}>{number}</button>)}</div></Field>
        <Field title="Em quais dias normalmente consegue treinar?"><div className="training-anamnesis-weekdays">{TRAINING_WEEKDAYS.map((day) => <button type="button" key={day} className={answers.availableDays.includes(day) ? "is-selected" : ""} aria-pressed={answers.availableDays.includes(day)} onClick={() => update({ availableDays: answers.availableDays.includes(day) ? answers.availableDays.filter((item) => item !== day) : [...answers.availableDays, day] })}>{weekdayLabels[day]}</button>)}</div></Field>
        <Field title="Quanto tempo normalmente possui para cada treino?"><Choices options={TRAINING_ANAMNESIS_DURATIONS} value={answers.sessionDuration} onChange={(value) => update({ sessionDuration: value as TrainingAnamnesisAnswersV1["sessionDuration"] })} /></Field>
      </> : null}
      {step === 3 ? <>
        <Field title="Onde realizará a maior parte dos treinos?"><Choices options={TRAINING_ANAMNESIS_LOCATIONS} value={answers.trainingLocation} onChange={(value) => update({ trainingLocation: value as TrainingAnamnesisAnswersV1["trainingLocation"] })} />{answers.trainingLocation === "other" ? <input value={answers.trainingLocationOther ?? ""} onChange={(event) => update({ trainingLocationOther: event.target.value })} placeholder="Onde você treina?" /> : null}</Field>
        {conditionalEquipment ? <Field title="Quais equipamentos estão disponíveis?" hint="Selecione todos que se aplicam."><Choices multiple options={TRAINING_ANAMNESIS_EQUIPMENT} value={answers.equipment} onChange={(value) => { const next = value as TrainingAnamnesisAnswersV1["equipment"]; update({ equipment: next.includes("none") && !answers.equipment.includes("none") ? ["none"] : next.filter((item) => item !== "none") }); }} />{answers.equipment.includes("other") ? <input value={answers.equipmentOther ?? ""} onChange={(event) => update({ equipmentOther: event.target.value })} placeholder="Quais outros equipamentos?" /> : null}</Field> : null}
      </> : null}
      {step === 4 ? <>
        <p className="training-anamnesis-attention">Estas respostas são pontos de atenção para revisão profissional. Não realizam diagnóstico, liberação ou contraindicação automática.</p>
        <Field title="Atualmente sente dor ou desconforto durante algum exercício ou movimento do dia a dia?"><YesNo value={answers.pain} onChange={(value) => update({ pain: value, painDetails: value ? answers.painDetails : null })} />{answers.pain ? <TextArea value={answers.painDetails} onChange={(value) => update({ painDetails: value })} placeholder="Onde sente e em quais movimentos?" /> : null}</Field>
        <Field title="Possui histórico de lesão, cirurgia ou limitação física que possa interferir no treinamento?"><YesNo value={answers.injuryHistory} onChange={(value) => update({ injuryHistory: value, injuryHistoryDetails: value ? answers.injuryHistoryDetails : null })} />{answers.injuryHistory ? <TextArea value={answers.injuryHistoryDetails} onChange={(value) => update({ injuryHistoryDetails: value })} placeholder="Descreva brevemente." /> : null}</Field>
        <Field title="Algum médico ou profissional de saúde já orientou evitar ou adaptar algum exercício ou tipo de esforço?"><YesNo value={answers.professionalRestrictions} onChange={(value) => update({ professionalRestrictions: value, professionalRestrictionsDetails: value ? answers.professionalRestrictionsDetails : null })} />{answers.professionalRestrictions ? <TextArea value={answers.professionalRestrictionsDetails} onChange={(value) => update({ professionalRestrictionsDetails: value })} placeholder="Qual orientação você recebeu?" /> : null}</Field>
        <Field title="Existe alguma condição de saúde que considere importante sabermos antes de montar o treino?"><YesNo value={answers.healthCondition} onChange={(value) => update({ healthCondition: value, healthConditionDetails: value ? answers.healthConditionDetails : null })} />{answers.healthCondition ? <TextArea value={answers.healthConditionDetails} onChange={(value) => update({ healthConditionDetails: value })} placeholder="Conte apenas o que for importante para a prescrição." /> : null}</Field>
      </> : null}
      {step === 5 ? <>
        <Field title="Existe algum exercício que gosta e gostaria que estivesse no treino?"><TextArea value={answers.likedExercises} onChange={(value) => update({ likedExercises: value })} placeholder="Opcional. Ex.: supino reto." /></Field>
        <Field title="Existe algum exercício que não gosta ou prefere evitar?"><TextArea value={answers.dislikedExercises} onChange={(value) => update({ dislikedExercises: value })} placeholder="Opcional. Ex.: agachamento livre." /></Field>
        <Field title="Além da musculação, pratica outra atividade física ou esporte regularmente?"><Choices options={TRAINING_ANAMNESIS_ACTIVITIES} value={answers.otherActivity} onChange={(value) => update({ otherActivity: value as TrainingAnamnesisAnswersV1["otherActivity"] })} />{answers.otherActivity && ["other_sport", "other_activity"].includes(answers.otherActivity) ? <input value={answers.otherActivityDetails ?? ""} onChange={(event) => update({ otherActivityDetails: event.target.value })} placeholder="Qual atividade?" /> : null}{answers.otherActivity && answers.otherActivity !== "none" ? <label className="training-anamnesis-frequency"><span>Frequência semanal</span><select value={answers.otherActivityFrequency ?? ""} onChange={(event) => update({ otherActivityFrequency: Number(event.target.value) || null })}><option value="">Selecione</option>{[1,2,3,4,5,6,7,8,9,10,11,12,13,14].map((number) => <option key={number} value={number}>{number}x por semana</option>)}</select></label> : null}</Field>
      </> : null}
      {step === 6 ? <Field title="Existe algo sobre você, sua rotina ou seus treinos que deveríamos saber antes de montar sua prescrição?" hint="Pergunta opcional."><TextArea value={answers.additionalNotes} onChange={(value) => update({ additionalNotes: value })} placeholder="Escreva aqui se houver algo importante." /><p className="training-anamnesis-privacy">Suas respostas, inclusive informações de saúde, serão usadas exclusivamente no seu acompanhamento e tratadas conforme a <Link href="/politica-de-privacidade" target="_blank">Política de Privacidade</Link>.</p></Field> : null}
      {message ? <p className="training-anamnesis-message" role="alert">{message}</p> : null}
      <footer className="training-anamnesis-actions"><button type="button" className="is-secondary" disabled={step === 0 || saving} onClick={() => setStep((current) => Math.max(0, current - 1))}>Voltar</button>{step < steps.length - 1 ? <button type="button" disabled={saving} onClick={() => void next()}>{saving ? "Salvando…" : "Continuar"}</button> : <button type="button" disabled={saving} onClick={() => void save(true)}>{saving ? "Enviando…" : initial.status === "submitted" ? "Atualizar informações" : "Concluir anamnese"}</button>}</footer>
    </section>
  </main>;
}
