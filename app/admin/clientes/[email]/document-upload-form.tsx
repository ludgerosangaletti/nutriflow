"use client";

import { useState } from "react";

export default function DocumentUploadForm({ email }: { email: string }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    form.set("email", email);
    const response = await fetch("/api/admin/documentos", {
      method: "POST",
      body: form,
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
      email?: { sent?: boolean; error?: string };
    };
    setSaving(false);
    if (!response.ok) {
      setMessage(result.error || "Não foi possível publicar o documento.");
      return;
    }
    setMessage(
      result.email?.sent
        ? "Documento publicado e paciente avisado por e-mail."
        : "Documento publicado. O aviso por e-mail não foi enviado.",
    );
    window.setTimeout(() => window.location.reload(), 1400);
  }

  return (
    <form className="document-upload-form" onSubmit={submit}>
      <div className="document-form-grid">
        <label>
          Tipo
          <select defaultValue="protocol" name="documentType">
            <option value="protocol">Protocolo alimentar</option>
            <option value="auxiliary">Material auxiliar</option>
          </select>
        </label>
        <label>
          Versão
          <input defaultValue="1.0" maxLength={30} name="version" required />
        </label>
        <label className="document-title-field">
          Título exibido ao paciente
          <input
            defaultValue="Protocolo alimentar"
            maxLength={120}
            name="title"
            required
          />
        </label>
      </div>
      <label className="document-file-field">
        Arquivo em PDF
        <input accept="application/pdf,.pdf" name="file" required type="file" />
        <small>Máximo de 20 MB.</small>
      </label>
      <button className="admin-action" disabled={saving} type="submit">
        {saving ? "Publicando..." : "Publicar na Área do Paciente"}
      </button>
      {message ? <p className="admin-upload-message" role="status">{message}</p> : null}
    </form>
  );
}
