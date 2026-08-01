import type { ReactNode } from "react";

export type EditorSyncState = "loading" | "saved" | "dirty" | "saving" | "error" | "conflict";

export function SyncIndicator({ state, detail }: { state: EditorSyncState; detail: string }) {
  const labels: Record<EditorSyncState, string> = {
    loading: "Carregando…",
    saving: "Salvando…",
    dirty: "Alterações pendentes",
    error: "Falha ao sincronizar",
    conflict: "Conflito de edição",
    saved: "Tudo sincronizado",
  };
  return <div className={`nutriflow-sync is-${state}`} aria-live="polite"><span aria-hidden="true" /><div><strong>{labels[state]}</strong><small>{detail}</small></div></div>;
}

export function EditorLoadingSkeleton() {
  return <section className="nutriflow-loading-shell" aria-busy="true" aria-live="polite">
    <header><span /><span /></header>
    <div><aside><span /><span /><span /></aside><main><span /><span /><span /><span /></main></div>
    <p>Preparando o Editor NutriFlow…</p>
  </section>;
}

export function EditorNotice({ state, children, action }: { state: EditorSyncState; children: ReactNode; action?: ReactNode }) {
  return <div className={`nutriflow-message is-${state}`} role={state === "error" || state === "conflict" ? "alert" : "status"}><span>{children}</span>{action}</div>;
}

