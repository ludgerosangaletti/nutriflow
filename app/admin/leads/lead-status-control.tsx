"use client";

import { useState } from "react";

const stages = [
  ["new", "Novo"],
  ["informed", "Informações enviadas"],
  ["qualified", "Qualificado"],
  ["converted", "Convertido"],
  ["archived", "Arquivado"],
] as const;

export default function LeadStatusControl({
  id,
  initialStage,
}: {
  id: number;
  initialStage: string;
}) {
  const [stage, setStage] = useState(initialStage);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function update(nextStage: string) {
    const previous = stage;
    setStage(nextStage);
    setSaving(true);
    setMessage("");

    const response = await fetch("/api/admin/leads", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, stage: nextStage }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
    };

    setSaving(false);
    if (!response.ok) {
      setStage(previous);
      setMessage(result.error || "Não foi possível atualizar.");
      return;
    }
    setMessage("Salvo");
  }

  return (
    <label className="lead-stage-control">
      <span>Estágio</span>
      <select
        aria-label="Estágio do lead"
        disabled={saving}
        onChange={(event) => update(event.target.value)}
        value={stage}
      >
        {stages.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {message ? <small role="status">{message}</small> : null}
    </label>
  );
}
