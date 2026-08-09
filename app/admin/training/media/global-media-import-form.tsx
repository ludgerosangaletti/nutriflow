"use client";

import { useMemo, useState } from "react";

type GlobalExercise = Readonly<{ slug: string; name: string }>;
type ImportResponse = Readonly<{
  message?: string;
  errorCode?: string;
  data?: Readonly<{ imported: number; replaced: number }>;
}>;

export default function GlobalMediaImportForm({ exercises }: Readonly<{ exercises: readonly GlobalExercise[] }>) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const exampleManifest = useMemo(() => ({
    apiVersion: 1,
    items: exercises.map((exercise) => ({
      slug: exercise.slug,
      videoFile: `${exercise.slug}.mp4`,
      posterFile: `${exercise.slug}.webp`,
      durationSeconds: 15,
    })),
  }), [exercises]);

  function downloadExample() {
    const blob = new Blob([`${JSON.stringify(exampleManifest, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "nutriflow-training-global-media.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const form = new FormData(event.currentTarget);
      form.set("overwriteExisting", form.get("overwriteExisting") === "on" ? "true" : "false");
      const response = await fetch("/api/admin/nutriflow/training/media/import", {
        method: "POST",
        headers: { "x-correlation-id": `corr_${crypto.randomUUID()}` },
        body: form,
      });
      const result = await response.json().catch(() => ({})) as ImportResponse;
      if (!response.ok || !result.data) throw new Error(result.message || "Não foi possível importar as mídias.");
      setMessage(`Importação concluída: ${result.data.imported} exercício(s), ${result.data.replaced} associação(ões) substituída(s).`);
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível importar as mídias.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="training-global-media-import">
      <header>
        <div>
          <p className="section-kicker">Importação controlada</p>
          <h2>Enviar lote para a Biblioteca global</h2>
          <p>O manifesto relaciona cada slug ao seu MP4 e poster. Todos os arquivos são validados antes da associação.</p>
        </div>
        <button type="button" onClick={downloadExample}>Baixar modelo JSON</button>
      </header>
      <form onSubmit={(event) => void submit(event)}>
        <label>
          <span>Manifesto JSON</span>
          <input name="manifest" type="file" required accept="application/json,.json" />
          <small>Use o modelo e mantenha os slugs exatamente como listados.</small>
        </label>
        <label>
          <span>MP4s e posters do lote</span>
          <input name="files" type="file" required multiple accept="video/mp4,image/jpeg,image/png,image/webp,.mp4,.jpg,.jpeg,.png,.webp" />
          <small>Selecione todos os arquivos mencionados no manifesto em uma única operação.</small>
        </label>
        <label className="training-global-media-overwrite">
          <input name="overwriteExisting" type="checkbox" />
          <span>Substituir associações existentes de forma auditada</span>
        </label>
        <p>Esta opção permanece desligada por padrão. Sem ela, qualquer exercício que já possua mídia interrompe o lote inteiro.</p>
        <button type="submit" disabled={submitting}>{submitting ? "Validando e enviando…" : "Validar e importar lote"}</button>
      </form>
      {message ? <p className="training-global-media-message" role="status">{message}</p> : null}
    </section>
  );
}
