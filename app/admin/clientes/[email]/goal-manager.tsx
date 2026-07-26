"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Goal = {
  id: number;
  category: string;
  title: string;
  initialValue: string;
  targetValue: string;
  currentValue: string;
  unit: string;
  deadline: string | null;
  frequency: string;
  professionalNote: string;
  status: string;
  progressCount: number;
};

const statuses: Record<string, string> = {
  active: "Em andamento",
  achieved: "Alcançada",
  adjusted: "Ajustada",
  closed: "Encerrada",
};

export default function GoalManager({ email, goals }: { email: string; goals: Goal[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    form.set("email", email);
    const response = await fetch("/api/admin/metas", { method: "POST", body: form });
    const result = await response.json() as { error?: string };
    setSaving(false);
    if (!response.ok) return setMessage(result.error || "Não foi possível criar a meta.");
    event.currentTarget.reset();
    setMessage("Meta criada e disponibilizada ao paciente.");
    router.refresh();
  }

  async function update(id: number, status: string) {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/metas", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const result = await response.json() as { error?: string };
    setSaving(false);
    if (!response.ok) return setMessage(result.error || "Não foi possível atualizar.");
    router.refresh();
  }

  return (
    <div className="goal-manager">
      <form className="admin-goal-form" onSubmit={create}>
        <div className="admin-goal-form-grid">
          <label><span>Categoria</span><select name="category" required><option value="weight">Peso corporal</option><option value="waist">Circunferência</option><option value="hydration">Hidratação</option><option value="training">Treinos</option><option value="cardio">Cardio</option><option value="adherence">Adesão ao plano</option><option value="sleep">Sono</option><option value="bowel">Funcionamento intestinal</option><option value="meals">Organização alimentar</option><option value="custom">Personalizada</option></select></label>
          <label className="goal-title-field"><span>Título da meta</span><input maxLength={100} name="title" placeholder="Ex.: Realizar 4 treinos por semana" required /></label>
          <label><span>Valor inicial</span><input inputMode="decimal" name="initialValue" required /></label>
          <label><span>Valor desejado</span><input inputMode="decimal" name="targetValue" required /></label>
          <label><span>Unidade</span><input maxLength={20} name="unit" placeholder="kg, cm, litros, vezes..." required /></label>
          <label><span>Prazo <small>(opcional)</small></span><input name="deadline" type="date" /></label>
          <label><span>Acompanhamento</span><select name="frequency"><option value="weekly">Semanal</option><option value="biweekly">Quinzenal</option><option value="monthly">Mensal</option></select></label>
          <label className="goal-note-field"><span>Orientação profissional <small>(opcional)</small></span><textarea maxLength={600} name="professionalNote" placeholder="Contexto, estratégia ou observação importante." /></label>
        </div>
        <button className="admin-action" disabled={saving || goals.filter((goal) => goal.status === "active").length >= 3} type="submit">
          {saving ? "Salvando..." : goals.filter((goal) => goal.status === "active").length >= 3 ? "Limite de 3 metas ativas" : "Adicionar meta"}
        </button>
      </form>
      {message ? <p className="admin-upload-message" role="status">{message}</p> : null}
      <div className="admin-goal-list">
        {goals.map((goal) => (
          <article key={goal.id}>
            <div>
              <span>{statuses[goal.status] || goal.status}</span>
              <strong>{goal.title}</strong>
              <p>{goal.currentValue} {goal.unit} de {goal.targetValue} {goal.unit} · {goal.progressCount} registro(s)</p>
            </div>
            <select aria-label={`Status de ${goal.title}`} disabled={saving} onChange={(event) => update(goal.id, event.target.value)} value={goal.status}>
              <option value="active">Em andamento</option><option value="achieved">Alcançada</option><option value="adjusted">Ajustada</option><option value="closed">Encerrada</option>
            </select>
          </article>
        ))}
        {!goals.length ? <p>Nenhuma meta definida.</p> : null}
      </div>
    </div>
  );
}
