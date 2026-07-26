"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdjustmentForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/ajustes", { method: "POST", body: new FormData(event.currentTarget) });
    const result = await response.json() as { error?: string };
    setSaving(false);
    if (!response.ok) return setMessage(result.error || "Não foi possível enviar.");
    setMessage("Solicitação enviada para análise.");
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <form className="adjustment-form" onSubmit={submit}>
      <div className="adjustment-form-grid">
        <label><span>Motivo principal</span><select defaultValue="" name="reason" required><option disabled value="">Selecione</option><option value="hunger">Fome ou baixa saciedade</option><option value="meal">Dificuldade com uma refeição</option><option value="substitution">Substituição de alimento</option><option value="gastrointestinal">Sintomas gastrointestinais</option><option value="routine">Alteração de horários ou rotina</option><option value="training">Mudança nos treinos</option><option value="event">Viagem ou evento específico</option><option value="adherence">Dificuldade de aderência</option><option value="other">Outro motivo</option></select></label>
        <label><span>Parte do protocolo</span><input maxLength={120} name="protocolArea" placeholder="Ex.: café da manhã, pré-treino..." required /></label>
      </div>
      <label><span>O que aconteceu?</span><textarea maxLength={1200} name="description" placeholder="Descreva a dificuldade com detalhes." required /></label>
      <div className="adjustment-form-grid">
        <label><span>Há quanto tempo isso ocorre?</span><input maxLength={200} name="duration" placeholder="Ex.: desde a semana passada" required /></label>
        <label><span>O que você já tentou fazer?</span><input maxLength={500} name="attempts" required /></label>
      </div>
      <label><span>Qual mudança você gostaria de solicitar?</span><textarea maxLength={800} name="requestedChange" required /></label>
      <label className="adjustment-file"><span>Anexo <small>(opcional)</small></span><input accept="image/jpeg,image/png,image/webp,application/pdf" name="attachment" type="file" /><small>Imagem ou PDF com até 8 MB.</small></label>
      <button className="button button-dark" disabled={saving} type="submit">{saving ? "Enviando..." : "Enviar solicitação de ajuste"}</button>
      {message ? <p className="adjustment-message" role="status">{message}</p> : null}
    </form>
  );
}
