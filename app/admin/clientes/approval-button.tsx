"use client";

import { useState } from "react";

export default function ApprovalButton({
  email,
  approved,
}: {
  email: string;
  approved: boolean;
}) {
  const [saving, setSaving] = useState(false);

  async function update() {
    setSaving(true);
    const response = await fetch("/api/admin/clientes", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        paymentStatus: approved ? "pending" : "approved",
      }),
    });
    setSaving(false);
    if (response.ok) window.location.reload();
  }

  return (
    <button className="admin-action" onClick={update} disabled={saving}>
      {saving ? "Salvando..." : approved ? "Retirar liberação" : "Confirmar pagamento"}
    </button>
  );
}
