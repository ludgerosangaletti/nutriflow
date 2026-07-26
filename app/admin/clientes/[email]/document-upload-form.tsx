"use client";

import { useState } from "react";

const chunkSize = 700 * 1024;
const maxFileSize = 20 * 1024 * 1024;
const retryDelays = [0, 700, 1600];

type UploadResult = {
  error?: string;
  email?: { sent?: boolean; error?: string };
};

async function readJson(response: Response): Promise<UploadResult> {
  return (await response.json().catch(() => ({}))) as UploadResult;
}

async function uploadChunk(
  uploadId: string,
  partNumber: number,
  chunk: Blob,
) {
  let lastError = "Falha ao enviar uma parte do arquivo.";
  for (const delay of retryDelays) {
    if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
    try {
      const response = await fetch(
        `/api/admin/documentos/upload/part?uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`,
        {
          method: "PUT",
          headers: { "content-type": "application/octet-stream" },
          body: chunk,
        },
      );
      if (response.ok) return;
      const result = await readJson(response);
      lastError = result.error || lastError;
      if (response.status === 401 || response.status === 403) break;
    } catch {
      lastError = "A conexão foi interrompida durante o envio.";
    }
  }
  throw new Error(lastError);
}

export default function DocumentUploadForm({ email }: { email: string }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get("file");
    if (!(file instanceof File)) {
      setMessage("Selecione um arquivo em PDF.");
      return;
    }
    if (
      file.type !== "application/pdf" ||
      !file.name.toLowerCase().endsWith(".pdf") ||
      file.size < 1 ||
      file.size > maxFileSize
    ) {
      setMessage("Envie um PDF válido com até 20 MB.");
      return;
    }

    setSaving(true);
    setMessage("");
    setProgress(0);
    let uploadId = "";
    const totalParts = Math.ceil(file.size / chunkSize);
    try {
      const initResponse = await fetch("/api/admin/documentos/upload/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        }),
      });
      const initResult = (await initResponse.json().catch(() => ({}))) as {
        uploadId?: string;
        error?: string;
      };
      if (!initResponse.ok || !initResult.uploadId) {
        throw new Error(initResult.error || "Não foi possível iniciar o envio.");
      }
      uploadId = initResult.uploadId;

      for (let index = 0; index < totalParts; index += 1) {
        const chunk = file.slice(index * chunkSize, Math.min(file.size, (index + 1) * chunkSize));
        await uploadChunk(uploadId, index + 1, chunk);
        setProgress(Math.round(((index + 1) / totalParts) * 90));
      }

      setMessage("Arquivo recebido. Finalizando a publicação...");
      const response = await fetch("/api/admin/documentos/upload/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          uploadId,
          totalParts,
          fileSize: file.size,
          fileName: file.name,
          email,
          documentType: String(form.get("documentType") || ""),
          title: String(form.get("title") || ""),
          version: String(form.get("version") || ""),
        }),
      });
      const result = await readJson(response);
      if (!response.ok) {
        throw new Error(result.error || "Não foi possível publicar o documento.");
      }
      setProgress(100);
      setMessage(
        result.email?.sent
          ? "Documento publicado e paciente avisado por e-mail."
          : "Documento publicado. O aviso por e-mail não foi enviado.",
      );
      window.setTimeout(() => window.location.reload(), 1400);
    } catch (error) {
      if (uploadId) {
        await fetch("/api/admin/documentos/upload/cancel", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ uploadId, totalParts }),
        }).catch(() => undefined);
      }
      setProgress(0);
      setMessage(
        error instanceof Error ? error.message : "Não foi possível publicar o documento.",
      );
    } finally {
      setSaving(false);
    }
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
        <input accept="application/pdf,.pdf" disabled={saving} name="file" required type="file" />
        <small>PDF de até 20 MB. O envio é protegido contra interrupções momentâneas.</small>
      </label>
      <button className="admin-action" disabled={saving} type="submit">
        {saving ? `Publicando... ${progress}%` : "Publicar na Área do Paciente"}
      </button>
      {saving ? (
        <div
          aria-label={`Progresso do envio: ${progress}%`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progress}
          className="document-upload-progress"
          role="progressbar"
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      ) : null}
      {message ? <p className="admin-upload-message" role="status">{message}</p> : null}
    </form>
  );
}
