"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CheckInReviewButton({
  id,
  reviewed,
  feedback = "",
}: {
  id: number;
  reviewed: boolean;
  feedback?: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(feedback);
  const [status, setStatus] = useState("");

  async function saveFeedback() {
    setSaving(true);
    setStatus("");
    const response = await fetch("/api/admin/check-ins", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, reviewed: true, feedback: message.trim() }),
    });
    setSaving(false);
    if (!response.ok) {
      setStatus("Não foi possível salvar o retorno.");
      return;
    }
    setStatus(message.trim() ? "Feedback disponível para o paciente." : "Check-in marcado como revisado.");
    router.refresh();
  }

  return (
    <div className="checkin-review-box">
      <label htmlFor={`checkin-feedback-${id}`}>Retorno opcional ao paciente</label>
      <p>Escreva uma orientação breve ou uma frase motivacional. Ela aparecerá no histórico deste check-in.</p>
      <textarea
        id={`checkin-feedback-${id}`}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        maxLength={500}
        placeholder="Ex.: Ótima evolução nesta semana. Continue assim!"
      />
      <div>
        <small>{message.length}/500</small>
        <button className={`checkin-review-button ${reviewed ? "is-reviewed" : ""}`} disabled={saving} onClick={saveFeedback} type="button">
          {saving ? "Salvando..." : message.trim() ? "Salvar feedback" : reviewed ? "Revisado ✓" : "Marcar como revisado"}
        </button>
      </div>
      {status ? <span role={status.startsWith("Não") ? "alert" : "status"}>{status}</span> : null}
    </div>
  );
}
