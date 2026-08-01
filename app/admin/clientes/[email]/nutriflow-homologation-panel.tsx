"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ControlledHomologationSnapshotV1 } from "../../../../modules/nutriflow/contracts/v1/homologation";

type Props = Readonly<{
  clientId: number;
  patientName: string;
  canConfigure: boolean;
  snapshot: ControlledHomologationSnapshotV1;
}>;

export default function NutriFlowHomologationPanel({
  clientId,
  patientName,
  canConfigure,
  snapshot,
}: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(snapshot.mode !== "inactive");
  const [confirmed, setConfirmed] = useState(false);
  const [duration, setDuration] = useState("30");
  const [reason, setReason] = useState("Homologação clínica controlada do MVP NutriFlow.");
  const [pending, setPending] = useState<"activate" | "suspend" | null>(null);
  const [message, setMessage] = useState("");
  const progress = Math.round((snapshot.completedSteps / snapshot.totalSteps) * 100);
  const expiryLabel = useMemo(() => snapshot.expiresAt
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(snapshot.expiresAt))
    : null, [snapshot.expiresAt]);

  async function configure(action: "activate" | "suspend") {
    if (!canConfigure || pending) return;
    if (action === "activate" && !confirmed) {
      setMessage("Confirme que esta é uma conta autorizada para testes.");
      return;
    }
    if (action === "suspend" && !window.confirm(`Suspender imediatamente o NutriFlow para ${patientName}?`)) return;
    setPending(action);
    setMessage("");
    const expiresAt = action === "activate"
      ? new Date(Date.now() + Number(duration) * 24 * 60 * 60 * 1000).toISOString()
      : null;
    try {
      const response = await fetch("/api/admin/nutriflow/homologation", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `homologation-${action}-${clientId}-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({
          clientId,
          action,
          reason,
          expiresAt,
          confirmedTestAccount: action === "suspend" || confirmed,
        }),
      });
      if (!response.ok) throw new Error("request-failed");
      setMessage(action === "activate"
        ? "Homologação ativada somente para esta conta."
        : "Homologação suspensa e acessos do NutriFlow revogados.");
      setConfirmed(false);
      router.refresh();
    } catch {
      setMessage("Não foi possível atualizar a homologação. Tente novamente.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className={`nutriflow-homologation ${snapshot.mode === "active" ? "is-active" : snapshot.mode === "partial" ? "is-partial" : ""}`}>
      <button
        aria-expanded={expanded}
        className="nutriflow-homologation__summary"
        onClick={() => setExpanded((value) => !value)}
        type="button"
      >
        <span className="nutriflow-homologation__mark" aria-hidden="true">NF</span>
        <span>
          <small>Homologação controlada</small>
          <strong>{snapshot.mode === "active" ? "NutriFlow ativo para teste" : snapshot.mode === "partial" ? "Configuração parcial — revisar" : "NutriFlow protegido"}</strong>
        </span>
        <span className="nutriflow-homologation__meta">
          {snapshot.completedSteps}/{snapshot.totalSteps} etapas
          <i aria-hidden="true">{expanded ? "−" : "+"}</i>
        </span>
      </button>
      {expanded ? (
        <div className="nutriflow-homologation__body">
          <div className="nutriflow-homologation__progress">
            <div><span>Ciclo clínico</span><strong>{progress}%</strong></div>
            <div className="nutriflow-homologation__bar" aria-label={`${progress}% do ciclo homologado`}><i style={{ width: `${progress}%` }} /></div>
            <small>{expiryLabel ? `Acesso de teste expira em ${expiryLabel}.` : "Nenhuma liberação individual vigente."}</small>
          </div>
          <div className="nutriflow-homologation__grid">
            <div>
              <h3>Recursos liberados</h3>
              <ul className="nutriflow-homologation__flags">
                {snapshot.flags.map((flag) => { const controlled = flag.enabled && flag.variant === "controlled-homologation" && flag.scope === "client" && Boolean(flag.expiresAt); return (
                  <li className={controlled ? "is-complete" : ""} key={flag.flag}>
                    <span aria-hidden="true">{controlled ? "✓" : "–"}</span>
                    <div><strong>{flag.label}</strong><small>{controlled ? "Liberação individual controlada" : flag.enabled ? "Ativo fora do perfil controlado — revisar" : "Desligado"}</small></div>
                  </li>
                ); })}
              </ul>
            </div>
            <div>
              <h3>Fluxo de validação</h3>
              <ol className="nutriflow-homologation__steps">
                {snapshot.steps.map((step) => (
                  <li className={step.complete ? "is-complete" : ""} key={step.key}>
                    <span aria-hidden="true">{step.complete ? "✓" : ""}</span>
                    <div><strong>{step.label}</strong><small>{step.description}</small></div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          {canConfigure ? (
            <div className="nutriflow-homologation__controls">
              {snapshot.mode !== "active" ? (
                <>
                  <label>
                    Motivo da homologação
                    <input maxLength={500} minLength={12} onChange={(event) => setReason(event.target.value)} value={reason} />
                  </label>
                  <label>
                    Validade da liberação
                    <select onChange={(event) => setDuration(event.target.value)} value={duration}>
                      <option value="7">7 dias</option>
                      <option value="14">14 dias</option>
                      <option value="30">30 dias</option>
                      <option value="60">60 dias</option>
                    </select>
                  </label>
                  <label className="nutriflow-homologation__consent">
                    <input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" />
                    <span>Confirmo que esta conta foi autorizada exclusivamente para homologação clínica.</span>
                  </label>
                  <button disabled={!confirmed || reason.trim().length < 12 || pending !== null} onClick={() => configure("activate")} type="button">
                    {pending === "activate" ? "Ativando…" : "Ativar homologação nesta conta"}
                  </button>
                </>
              ) : (
                <>
                  <p>Todos os recursos do MVP estão liberados somente para este paciente de teste. As flags globais continuam desligadas.</p>
                  <button className="is-danger" disabled={pending !== null} onClick={() => configure("suspend")} type="button">
                    {pending === "suspend" ? "Suspendendo…" : "Suspender homologação"}
                  </button>
                </>
              )}
            </div>
          ) : <p className="nutriflow-homologation__readonly">Somente proprietário ou administrador pode alterar a homologação.</p>}
          {message ? <p className="nutriflow-homologation__message" role="status">{message}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
