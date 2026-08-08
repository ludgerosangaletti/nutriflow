"use client";

import { useState } from "react";

const angles = [
  { id: "front", label: "Frente" },
  { id: "side", label: "Lado" },
  { id: "back", label: "Costas" },
] as const;

export default function PhotoUploadForm({
  defaultPeriod,
  existingAngles = [],
}: {
  defaultPeriod: string;
  existingAngles?: readonly string[];
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});

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
      <div className="photo-register-heading">
        <div>
          <strong>Registro fotográfico</strong>
          <p>Opcional. Suas fotos são privadas e visíveis apenas para você e seu nutricionista.</p>
        </div>
        <label className="photo-period">
        <span>Mês</span>
        <input
          defaultValue={defaultPeriod}
          max={defaultPeriod}
          name="period"
          required
          type="month"
        />
        </label>
      </div>
      <div className="photo-input-grid">
        {angles.map((angle) => {
          const alreadySaved = existingAngles.includes(angle.id);
          const ready = Boolean(selected[angle.id]) || alreadySaved;
          return (
          <label className={`photo-input ${ready ? "has-file" : ""}`} key={angle.id}>
            <i aria-hidden="true">{ready ? "✓" : "+"}</i>
            <span>{angle.label}</span>
            <small>{selected[angle.id] ? "Nova foto escolhida" : alreadySaved ? "Enviada" : "Adicionar"}</small>
            <input
              accept="image/jpeg,image/png,image/webp"
              name={angle.id}
              type="file"
              onChange={(event) => setSelected((current) => ({ ...current, [angle.id]: event.target.files?.[0]?.name || "" }))}
            />
          </label>
        )})}
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
        {saving ? "Enviando com segurança..." : "Salvar fotos selecionadas"}
      </button>
      {message ? (
        <p className={message.includes("segurança") ? "form-success" : "form-error"} role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
