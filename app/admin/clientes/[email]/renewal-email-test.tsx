"use client";

import { useState } from "react";

export default function RenewalEmailTest({ email }: { email: string }) {
  const [days, setDays] = useState("7");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  async function sendTest() {
    setSending(true);
    setMessage("");
    const response = await fetch("/api/admin/test-renewal-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, daysRemaining: Number(days) }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    setSending(false);
    setMessage(
      response.ok
        ? result.message || "E-mail de teste enviado."
        : result.error || "Não foi possível enviar o teste.",
    );
  }

  return (
    <div className="renewal-email-test">
      <div>
        <span>Teste controlado</span>
        <strong>Lembrete de renovação</strong>
        <p>Envia uma simulação sem alterar a vigência nem registrar um lembrete real.</p>
      </div>
      <label>
        Marco simulado
        <select
          disabled={sending}
          onChange={(event) => setDays(event.target.value)}
          value={days}
        >
          <option value="7">7 dias restantes</option>
          <option value="3">3 dias restantes</option>
          <option value="1">1 dia restante</option>
        </select>
      </label>
      <button
        className="admin-action"
        disabled={sending}
        onClick={sendTest}
        type="button"
      >
        {sending ? "Enviando teste..." : "Enviar e-mail de teste"}
      </button>
      {message ? <small role="status">{message}</small> : null}
    </div>
  );
}
