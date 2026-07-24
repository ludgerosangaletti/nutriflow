"use client";

import { FormEvent, useState } from "react";
import type { PlanId } from "../plans";

export default function CadastroForm({
  plan,
  defaultName,
  email,
}: {
  plan: PlanId;
  defaultName: string;
  email: string;
}) {
  const [name, setName] = useState(defaultName);
  const [whatsapp, setWhatsapp] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const response = await fetch("/api/cadastro", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, whatsapp, plan }),
    });
    const result = (await response.json()) as {
      error?: string;
      paymentUrl?: string;
    };

    if (!response.ok || !result.paymentUrl) {
      setError(result.error ?? "Não foi possível salvar o cadastro.");
      setSaving(false);
      return;
    }

    window.location.assign(result.paymentUrl);
  }

  return (
    <form className="signup-card" onSubmit={submit}>
      <label>
        Nome completo
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          required
        />
      </label>
      <label>
        E-mail do acesso
        <input value={email} disabled />
      </label>
      <label>
        WhatsApp
        <input
          value={whatsapp}
          onChange={(event) => setWhatsapp(event.target.value)}
          placeholder="(00) 00000-0000"
          inputMode="tel"
          autoComplete="tel"
          required
        />
      </label>
      <label className="signup-consent">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          required
        />
        <span>
          Autorizo o uso destes dados para identificação da compra e prestação
          da consultoria nutricional.
        </span>
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="checkout-button" disabled={!accepted || saving}>
        {saving ? "Salvando cadastro..." : "Salvar e ir para o pagamento"}
      </button>
      <small>
        O pagamento será processado pela TON. Nenhum dado do cartão é armazenado
        neste site.
      </small>
    </form>
  );
}
