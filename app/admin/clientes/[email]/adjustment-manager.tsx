"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RequestItem = {
  id: number; reason: string; protocolArea: string; description: string;
  duration: string; attempts: string; requestedChange: string; status: string;
  adminResponse: string | null; linkedDocumentId: number | null;
  attachmentKey: string | null; attachmentName: string | null; createdAt: string;
};

const reasons: Record<string, string> = { hunger: "Fome ou baixa saciedade", meal: "Dificuldade com uma refeição", substitution: "Substituição de alimento", gastrointestinal: "Sintomas gastrointestinais", routine: "Alteração de rotina", training: "Mudança nos treinos", event: "Viagem ou evento", adherence: "Dificuldade de aderência", other: "Outro motivo" };

export default function AdjustmentManager({ requests, documents }: { requests: RequestItem[]; documents: { id: number; title: string; version: string }[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function update(event: React.FormEvent<HTMLFormElement>, id: number) {
    event.preventDefault();
    setSaving(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/ajustes", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status: form.get("status"), adminResponse: form.get("adminResponse"), linkedDocumentId: form.get("linkedDocumentId") || null }) });
    const result = await response.json() as { error?: string };
    setSaving(false);
    if (!response.ok) return setMessage(result.error || "Não foi possível atualizar.");
    setMessage("Solicitação atualizada.");
    router.refresh();
  }

  return <div className="admin-adjustment-list">
    {requests.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt)).map((item) => <article key={item.id}>
      <header><div><span>{reasons[item.reason] || item.reason}</span><strong>{item.protocolArea}</strong></div><b>{item.status}</b></header>
      <dl><div><dt>O que aconteceu</dt><dd>{item.description}</dd></div><div><dt>Há quanto tempo</dt><dd>{item.duration}</dd></div><div><dt>O que já tentou</dt><dd>{item.attempts}</dd></div><div><dt>Mudança solicitada</dt><dd>{item.requestedChange}</dd></div></dl>
      {item.attachmentKey ? <a className="admin-response-link" href={`/api/ajustes/${item.id}/anexo`} target="_blank">Abrir anexo · {item.attachmentName}</a> : null}
      <form onSubmit={(event) => update(event, item.id)}>
        <label><span>Status</span><select defaultValue={item.status} name="status"><option value="submitted">Enviada</option><option value="analyzing">Em análise</option><option value="answered">Respondida</option><option value="adjusted">Ajuste realizado</option><option value="closed">Encerrada</option></select></label>
        <label className="adjustment-answer-field"><span>Resposta ao paciente</span><textarea defaultValue={item.adminResponse || ""} maxLength={1600} name="adminResponse" placeholder="Explique sua análise, orientação ou ajuste realizado." /></label>
        <label><span>Documento relacionado</span><select defaultValue={item.linkedDocumentId || ""} name="linkedDocumentId"><option value="">Nenhum</option>{documents.map((document) => <option key={document.id} value={document.id}>{document.title} · v{document.version}</option>)}</select></label>
        <button className="admin-action" disabled={saving} type="submit">{saving ? "Salvando..." : "Salvar resposta"}</button>
      </form>
    </article>)}
    {!requests.length ? <p>Nenhuma solicitação enviada.</p> : null}
    {message ? <p className="admin-upload-message" role="status">{message}</p> : null}
  </div>;
}
