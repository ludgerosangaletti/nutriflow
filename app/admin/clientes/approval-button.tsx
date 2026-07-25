"use client";

import { useState } from "react";

export default function ApprovalButton({
  email,
  approved,
  expired,
}: {
  email: string;
  approved: boolean;
  expired: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function update() {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/clientes", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        paymentStatus: approved && !expired ? "pending" : "approved",
        renew: approved && expired,
      }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
      email?: { sent?: boolean; error?: string };
    };
    setSaving(false);
    if (!response.ok) {
      setMessage(result.error || "Não foi possível salvar.");
      return;
    }
    if (expired) {
      setMessage("Nova vigência iniciada.");
    } else if (!approved && result.email?.sent) {
      setMessage("Pagamento aprovado e e-mail enviado.");
    } else if (!approved && result.email?.error) {
      setMessage("Pagamento aprovado, mas o e-mail não foi enviado.");
    }
    window.setTimeout(() => window.location.reload(), 1400);
  }

  return (
    <div>
      <button className="admin-action" onClick={update} disabled={saving}>
        {saving
          ? "Salvando..."
          : approved && expired
            ? "Renovar vigência"
            : approved
              ? "Retirar liberação"
              : "Confirmar pagamento"}
      </button>
      {message ? <small role="status">{message}</small> : null}
    </div>
  );
}
