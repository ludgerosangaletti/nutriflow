"use client";

import { useState } from "react";
import type { PlanId } from "../plans";

export default function PaymentButton({ plan }: { plan: PlanId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function pay() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/pagamento/iniciar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !data.url) {
      setError(data.error ?? "Não foi possível iniciar o pagamento.");
      setLoading(false);
      return;
    }
    window.location.assign(data.url);
  }

  return (
    <>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="checkout-button" type="button" onClick={pay} disabled={loading}>
        {loading ? "Abrindo pagamento..." : "Ir para pagamento seguro"}
      </button>
    </>
  );
}
