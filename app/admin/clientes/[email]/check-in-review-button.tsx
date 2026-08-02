"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CheckInReviewButton({ id, reviewed, feedback = "" }: { id: number; reviewed: boolean; feedback?: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(feedback);
  async function review() {
    setSaving(true);
    const response = await fetch("/api/admin/check-ins", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, reviewed: !reviewed, feedback: message }) });
    setSaving(false);
    if (response.ok) router.refresh();
  }
  return <div className="checkin-review-box"><textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} placeholder="Feedback opcional para o paciente" aria-label="Feedback opcional do check-in" /><button className={`checkin-review-button ${reviewed ? "is-reviewed" : ""}`} disabled={saving} onClick={review} type="button">{saving ? "Salvando..." : reviewed ? "Revisado ✓" : "Marcar como revisado"}</button></div>;
}
