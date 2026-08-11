"use client";

import { useState } from "react";

export default function ClinicalAssessmentDeleteButton({ email, publicId, label }: { email: string; publicId: string; label: string }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (!window.confirm(`Excluir a avaliação de ${label}? Esta ação remove somente este registro.`)) return;
    setDeleting(true);
    setError("");
    const response = await fetch("/api/admin/clinical-assessments", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, publicId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setDeleting(false);
      setError(data.error || "Não foi possível excluir.");
      return;
    }
    window.location.reload();
  }

  return <span className="clinical-assessment-delete-wrap"><button className="clinical-assessment-delete" type="button" onClick={remove} disabled={deleting}>{deleting ? "Excluindo…" : "Excluir"}</button>{error ? <small role="alert">{error}</small> : null}</span>;
}
