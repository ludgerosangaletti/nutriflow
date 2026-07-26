"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CheckInReviewButton({ id, reviewed }: { id: number; reviewed: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  async function review() {
    setSaving(true);
    const response = await fetch("/api/admin/check-ins", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, reviewed: !reviewed }) });
    setSaving(false);
    if (response.ok) router.refresh();
  }
  return <button className={`checkin-review-button ${reviewed ? "is-reviewed" : ""}`} disabled={saving} onClick={review} type="button">{saving ? "Salvando..." : reviewed ? "Revisado ✓" : "Marcar como revisado"}</button>;
}
