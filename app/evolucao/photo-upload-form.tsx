"use client";

import { useState } from "react";

const angles = [
  { id: "front", label: "Frente" },
  { id: "side", label: "Lado" },
  { id: "back", label: "Costas" },
] as const;

export default function PhotoUploadForm({
  defaultPeriod,
}: {
  defaultPeriod: string;
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/evolucao", {
      method: "POST",
      body: new FormData(event.currentTarget),
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    setSaving(false);
    if (!response.ok) {
      setMessage(result.error || "Não foi possível enviar as fotos.");
      return;
    }
    setMessage("Registro salvo com segurança.");
    window.setTimeout(() => window.location.reload(), 900);
  }

  return (
    <form className="photo-upload-form" onSubmit={submit}>
      <label className="photo-period">
        Mês do acompanhamento
        <input
          defaultValue={defaultPeriod}
          max={defaultPeriod}
          name="period"
          required
          type="month"
        />
      </label>
      <div className="photo-input-grid">
        {angles.map((angle) => (
          <label className="photo-input" key={angle.id}>
            <span>{angle.label}</span>
            <small>JPG, PNG ou WEBP · até 8 MB</small>
            <input
              accept="image/jpeg,image/png,image/webp"
              name={angle.id}
              required
              type="file"
            />
          </label>
        ))}
      </div>
      <label className="photo-consent">
        <input name="photoConsent" required type="checkbox" value="accepted" />
        <span>
          Estou enviando estas fotos voluntariamente e autorizo seu uso restrito
          ao acompanhamento da minha evolução corporal, conforme a{" "}
          <a href="/politica-de-privacidade" target="_blank">
            Política de Privacidade
          </a>. Posso solicitar a exclusão posteriormente.
        </span>
      </label>
      <button className="button button-dark" disabled={saving} type="submit">
        {saving ? "Enviando com segurança..." : "Salvar registro mensal"}
      </button>
      {message ? (
        <p className={message.includes("segurança") ? "form-success" : "form-error"} role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
