"use client";

import { useEffect, useRef, useState } from "react";
import { IconAguardando, IconResposta } from "./CheckinIcons";
import { CHECKIN_QUESTIONS, type CheckInAnswer, type CheckInQuestion, validateNumberAnswer } from "./check-in-model";

type Answers = Record<string, CheckInAnswer>;

export function CheckinFlow(props: Readonly<{
  nutritionistName: string;
  onSubmit: (answers: Readonly<Answers>) => Promise<void>;
  onExit: () => void;
}>) {
  const [phase, setPhase] = useState<"intro" | "done" | number>("intro");
  const [answers, setAnswers] = useState<Answers>({});
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const initial = props.nutritionistName.trim()[0]?.toUpperCase() || "N";

  function go(next: "intro" | number) {
    setFieldError(null);
    setSubmitError(null);
    setPhase(next);
  }

  async function answer(question: CheckInQuestion, value: CheckInAnswer, delay = false) {
    if (busy || advancing || typeof phase !== "number") return;
    const nextAnswers = { ...answers, [question.id]: value };
    setAnswers(nextAnswers);
    setFieldError(null);
    setSubmitError(null);
    haptic();

    if (delay) {
      setAdvancing(true);
      await new Promise((resolve) => setTimeout(resolve, 210));
      setAdvancing(false);
    }

    if (phase < CHECKIN_QUESTIONS.length - 1) {
      setPhase(phase + 1);
      return;
    }

    setBusy(true);
    try {
      await props.onSubmit(nextAnswers);
      setPhase("done");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Verifique sua conexão e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "intro") {
    return (
      <section className="nf-checkin-new-screen nf-checkin-new-intro">
        <div className="nf-checkin-nutritionist"><Avatar initial={initial} size={46} /><span><strong>{props.nutritionistName}</strong><small>seu nutricionista</small></span></div>
        <div><h1>Como foi a sua semana?</h1><p>São 11 perguntas rápidas sobre peso, treinos, fome, sono e o que atrapalhou. É com elas que eu ajusto seu plano para a próxima semana.</p></div>
        <div className="nf-checkin-meta">
          <Meta icon={<IconAguardando size={18} />} value="3 min" label="uma pergunta por vez" />
          <Meta icon={<IconResposta size={18} />} value="Toda semana" label="sempre às segundas" />
        </div>
        <button className="nf-checkin-new-cta nf-pressable" type="button" onClick={() => go(0)}>Começar</button>
        <button className="nf-checkin-new-ghost nf-pressable" type="button" onClick={props.onExit}>Agora não</button>
      </section>
    );
  }

  if (phase === "done") {
    return (
      <section className="nf-checkin-new-screen nf-checkin-new-done">
        <i aria-hidden="true">✓</i>
        <h1>Recebido.</h1>
        <p>{props.nutritionistName} costuma responder em até 2 dias.</p>
        <p>O retorno aparece aqui mesmo, junto com este check-in.</p>
        <button className="nf-checkin-new-cta nf-pressable" type="button" onClick={props.onExit}>Voltar ao início</button>
      </section>
    );
  }

  const question = CHECKIN_QUESTIONS[phase];
  return (
    <section className="nf-checkin-new-screen nf-checkin-new-question">
      <Progress index={phase} onBack={() => go(phase === 0 ? "intro" : phase - 1)} />
      <div className="nf-checkin-new-body">
        <header><h1>{question.question}</h1>{question.help ? <p>{question.help}</p> : null}{question.voice ? <Voice initial={initial} text={question.voice} /> : null}</header>
        <QuestionField
          question={question}
          value={answers[question.id]}
          fieldError={fieldError}
          submitError={submitError}
          disabled={busy || advancing}
          isLast={phase === CHECKIN_QUESTIONS.length - 1}
          onInvalid={setFieldError}
          onAnswer={(value, delay) => void answer(question, value, delay)}
        />
      </div>
    </section>
  );
}

function QuestionField(props: Readonly<{
  question: CheckInQuestion;
  value?: CheckInAnswer;
  fieldError: string | null;
  submitError: string | null;
  disabled: boolean;
  isLast: boolean;
  onInvalid: (error: string | null) => void;
  onAnswer: (value: CheckInAnswer, delay?: boolean) => void;
}>) {
  const { question } = props;
  const [draft, setDraft] = useState(props.value === undefined ? "" : String(props.value));
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (question.type !== "number" && question.type !== "text") return;
    const timer = setTimeout(() => inputRef.current?.focus(), 260);
    return () => clearTimeout(timer);
  }, [question.id, question.type]);

  if (question.type === "scale" || question.type === "choice") {
    const items = question.type === "scale"
      ? (question.labels ?? []).map((label, index) => ({ value: index + 1, label, badge: String(index + 1) }))
      : (question.options ?? []).map((option) => ({ ...option, badge: null }));
    return (
      <div className="nf-checkin-new-field">
        {question.type === "scale" ? <div className="nf-checkin-scale-ends"><span>{question.low}</span><span>{question.high}</span></div> : null}
        <div className="nf-checkin-choice-list" role="group" aria-label={question.question}>
          {items.map((item) => <button className={`nf-pressable${props.value === item.value ? " is-selected" : ""}`} aria-pressed={props.value === item.value} disabled={props.disabled} key={item.value} type="button" onClick={() => props.onAnswer(item.value, true)}>{item.badge ? <b>{item.badge}</b> : null}<span>{item.label}</span></button>)}
        </div>
      </div>
    );
  }

  if (question.type === "number") {
    function submitNumber() {
      const error = validateNumberAnswer(question, draft);
      if (error) return props.onInvalid(error);
      props.onAnswer(Number(draft.replace(",", ".")));
    }
    return (
      <div className="nf-checkin-new-field">
        <div className="nf-checkin-number">
          <input ref={inputRef as React.RefObject<HTMLInputElement>} type="text" inputMode={question.decimal ? "decimal" : "numeric"} aria-label={question.question} placeholder={question.placeholder} value={draft} onChange={(event) => { setDraft(event.target.value); props.onInvalid(null); }} onKeyDown={(event) => { if (event.key === "Enter") submitNumber(); }} />
          <span>{question.unit}</span>
        </div>
        {props.fieldError ? <p className="nf-checkin-new-error" role="alert">{props.fieldError}</p> : question.footnote ? <p className="nf-checkin-new-footnote">{question.footnote}</p> : null}
        <button className="nf-checkin-new-cta nf-pressable" disabled={!draft.trim() || props.disabled} type="button" onClick={submitNumber}>Continuar</button>
      </div>
    );
  }

  function submitText() {
    const value = draft.trim();
    if (!value && question.required) return props.onInvalid("Escreva uma resposta para continuar.");
    props.onAnswer(value);
  }
  return (
    <div className="nf-checkin-new-field">
      <textarea ref={inputRef as React.RefObject<HTMLTextAreaElement>} aria-label={question.question} placeholder={question.placeholder} maxLength={question.maxLength} value={draft} onChange={(event) => { setDraft(event.target.value); props.onInvalid(null); }} />
      {props.fieldError ? <p className="nf-checkin-new-error" role="alert">{props.fieldError}</p> : null}
      {props.submitError ? <p className="nf-checkin-new-error" role="alert">{props.submitError}</p> : null}
      <button className="nf-checkin-new-cta nf-pressable" disabled={props.disabled} type="button" onClick={submitText}>{props.disabled ? "Enviando..." : props.isLast ? "Enviar check-in" : "Continuar"}</button>
    </div>
  );
}

function Progress({ index, onBack }: Readonly<{ index: number; onBack: () => void }>) {
  return <div className="nf-checkin-new-progress"><button className="nf-pressable" type="button" aria-label="Voltar" onClick={onBack}>‹</button><div role="progressbar" aria-valuemin={1} aria-valuemax={CHECKIN_QUESTIONS.length} aria-valuenow={index + 1}><i style={{ width: `${((index + 1) / CHECKIN_QUESTIONS.length) * 100}%` }} /></div><span>{index + 1}/{CHECKIN_QUESTIONS.length}</span></div>;
}

function Avatar({ initial, size }: Readonly<{ initial: string; size: number }>) { return <i className="nf-checkin-avatar" aria-hidden="true" style={{ width: size, height: size }}>{initial}</i>; }
function Voice({ initial, text }: Readonly<{ initial: string; text: string }>) { return <aside className="nf-checkin-voice"><Avatar initial={initial} size={30} /><p>{text}</p></aside>; }
function Meta({ icon, value, label }: Readonly<{ icon: React.ReactNode; value: string; label: string }>) { return <span>{icon}<strong>{value}</strong><small>{label}</small></span>; }
function haptic() { if (typeof navigator !== "undefined" && navigator.vibrate) { try { navigator.vibrate(9); } catch { /* unsupported */ } } }
