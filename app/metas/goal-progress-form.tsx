"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GoalProgressForm({
  goalId,
  unit,
}: {
  goalId: number;
  unit: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    form.set("goalId", String(goalId));
    const response = await fetch("/api/metas/progresso", { method: "POST", body: form });
    const result = await response.json() as { error?: string };
    setSaving(false);
    if (!response.ok) return setMessage(result.error || "Não foi possível registrar.");
    setMessage("Progresso registrado.");
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <form className="goal-progress-form" onSubmit={submit}>
      <label>
        <span>Novo valor</span>
        <div className="field-with-suffix">
          <input inputMode="decimal" name="value" placeholder="0" required />
          <b>{unit}</b>
        </div>
      </label>
      <label>
        <span>Observação <small>(opcional)</small></span>
        <input maxLength={300} name="note" placeholder="Como foi alcançar este resultado?" />
      </label>
      <button disabled={saving} type="submit">{saving ? "Salvando..." : "Registrar progresso"}</button>
      {message ? <small className="goal-form-message" role="status">{message}</small> : null}
    </form>
  );
}
