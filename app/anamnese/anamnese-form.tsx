"use client";

import { FormEvent, useMemo, useState } from "react";
import { sections, type Answers } from "./questions";

export default function AnamneseForm({
  initialAnswers,
  initialStatus,
}: {
  initialAnswers: Answers;
  initialStatus: string;
}) {
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const section = sections[step];
  const progress = Math.round(((step + 1) / sections.length) * 100);

  const completed = useMemo(
    () =>
      sections.map((item) =>
        item.fields.filter((field) => field.required).every((field) => Boolean(answers[field.id])),
      ),
    [answers],
  );

  function setValue(id: string, value: string | boolean) {
    setAnswers((current) => ({ ...current, [id]: value }));
    setMessage("");
  }

  async function save(submit = false) {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/anamnese", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers, submit }),
    });
    const result = (await response.json()) as { error?: string; status?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage(result.error ?? "Não foi possível salvar.");
      return false;
    }
    setStatus(result.status ?? "draft");
    setMessage(submit ? "Anamnese enviada com sucesso." : "Rascunho salvo.");
    return true;
  }

  async function next(event: FormEvent) {
    event.preventDefault();
    const missing = section.fields.some(
      (field) => field.required && !answers[field.id],
    );
    if (missing) {
      setMessage("Preencha os campos obrigatórios desta etapa.");
      return;
    }
    await save(false);
    if (step < sections.length - 1) {
      setStep((current) => current + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  if (status === "submitted") {
    return (
      <section className="submitted-state">
        <span>✓</span>
        <p className="section-kicker">Anamnese recebida</p>
        <h1>Suas respostas foram enviadas.</h1>
        <p>
          Ludgero poderá acessar as informações e iniciar a elaboração da sua
          estratégia alimentar.
        </p>
        <a className="button button-dark" href="/area-cliente">Voltar à área do cliente</a>
      </section>
    );
  }

  return (
    <div className="anamnesis-layout">
      <aside className="anamnesis-sidebar">
        <a className="portal-brand" href="/area-cliente">LS · Área do cliente</a>
        <p>Progresso da anamnese</p>
        <div className="progress-meter"><i style={{ width: `${progress}%` }} /></div>
        <strong>{progress}%</strong>
        <ol>
          {sections.map((item, index) => (
            <li
              key={item.id}
              className={`${index === step ? "is-current" : ""} ${completed[index] ? "is-complete" : ""}`}
            >
              <button type="button" onClick={() => setStep(index)}>
                <span>{completed[index] ? "✓" : index + 1}</span>
                {item.title}
              </button>
            </li>
          ))}
        </ol>
        <button className="draft-button" type="button" onClick={() => save(false)} disabled={saving}>
          {saving ? "Salvando..." : "Salvar e continuar depois"}
        </button>
      </aside>

      <main className="anamnesis-main">
        <div className="anamnesis-heading">
          <p className="section-kicker">Etapa {step + 1} de {sections.length}</p>
          <h1>{section.title}</h1>
          <p>{section.description}</p>
        </div>
        <form className="anamnesis-form" onSubmit={next}>
          {section.fields.map((field) => (
            <label
              key={field.id}
              className={field.type === "checkbox" ? "field-checkbox" : ""}
            >
              {field.type === "checkbox" ? (
                <>
                  <input
                    type="checkbox"
                    checked={Boolean(answers[field.id])}
                    onChange={(event) => setValue(field.id, event.target.checked)}
                    required={field.required}
                  />
                  <span>{field.label}</span>
                </>
              ) : (
                <>
                  <span>
                    {field.label}
                    {field.required ? <b>Obrigatório</b> : null}
                  </span>
                  {field.type === "textarea" ? (
                    <textarea
                      value={String(answers[field.id] ?? "")}
                      onChange={(event) => setValue(field.id, event.target.value)}
                      placeholder={"placeholder" in field ? field.placeholder : undefined}
                      required={field.required}
                    />
                  ) : field.type === "select" ? (
                    <select
                      value={String(answers[field.id] ?? "")}
                      onChange={(event) => setValue(field.id, event.target.value)}
                      required={field.required}
                    >
                      <option value="">Selecione</option>
                      {field.options.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      value={String(answers[field.id] ?? "")}
                      onChange={(event) => setValue(field.id, event.target.value)}
                      placeholder={"placeholder" in field ? field.placeholder : undefined}
                      required={field.required}
                      step={field.type === "number" ? "0.1" : undefined}
                    />
                  )}
                </>
              )}
            </label>
          ))}
          {message ? <p className={message.includes("sucesso") || message.includes("salvo") ? "form-success" : "form-error"}>{message}</p> : null}
          <div className="form-navigation">
            <button
              className="button button-outline-dark"
              type="button"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0}
            >
              Voltar
            </button>
            {step === sections.length - 1 ? (
              <button
                className="button button-dark"
                type="button"
                onClick={() => save(true)}
                disabled={saving}
              >
                Enviar anamnese
              </button>
            ) : (
              <button className="button button-dark" disabled={saving}>
                Salvar e continuar
              </button>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
