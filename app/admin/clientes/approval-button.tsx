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

  async function update(paymentStatus: "pending" | "approved" | "rejected") {
    if (
      paymentStatus === "rejected" &&
      !window.confirm(
        "Recusar este pagamento? O cadastro sairá da lista principal, mas será preservado para auditoria.",
      )
    ) {
      return;
    }
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/clientes", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        paymentStatus,
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
    if (paymentStatus === "rejected") {
      setMessage("Pagamento recusado e cadastro arquivado.");
    } else if (expired) {
      setMessage("Nova vigência iniciada.");
    } else if (!approved && result.email?.sent) {
      setMessage("Pagamento aprovado e e-mail enviado.");
    } else if (!approved && result.email?.error) {
      setMessage("Pagamento aprovado, mas o e-mail não foi enviado.");
    }
    window.setTimeout(() => window.location.reload(), 1400);
  }

  return (
    <div className="admin-payment-actions">
      <button
        className="admin-action"
        onClick={() =>
          update(approved && !expired ? "pending" : "approved")
        }
        disabled={saving}
      >
        {saving
          ? "Salvando..."
          : approved && expired
            ? "Renovar vigência"
            : approved
              ? "Retirar liberação"
              : "Confirmar pagamento"}
      </button>
      {!approved ? (
        <button
          className="admin-payment-reject"
          type="button"
          onClick={() => update("rejected")}
          disabled={saving}
        >
          Recusar pagamento
        </button>
      ) : null}
      {message ? <small role="status">{message}</small> : null}
    </div>
  );
}
