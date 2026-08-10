"use client";

import { usePathname } from "next/navigation";

/**
 * AppHeader — cabeçalho compacto persistente do Portal do Paciente.
 *
 * Como vive no layout, não remonta ao trocar de rota — o título muda, a
 * casca fica. É o que dá continuidade de app em vez de recarregamento de
 * site (item 1 e 18 da análise crítica).
 *
 * Decisões:
 * - sticky, não fixed — a página mantém o scroll natural do documento
 *   (ver CORRECOES_REVISAO_WORK.md, ponto 7 da revisão do Work).
 * - padding-top com safe-area para notch / Dynamic Island.
 * - altura compacta (52px): num app, o cabeçalho não deve competir com o
 *   conteúdo. Nada de logo grande e menu extenso como na home pública.
 * - o indicador de sync é discreto e opcional — só aparece quando o estado
 *   é passado. Padroniza nas 4 telas o que hoje só existe dentro do
 *   patient-plan-viewer.tsx (item 16 da análise).
 *
 * Props:
 *   syncState?: 'idle' | 'syncing' | 'offline'
 *   onBack?: () => void   — se ausente, não mostra botão de voltar
 */

const TITLES = {
  "/area-cliente": "Início",
  "/plano-alimentar": "Plano alimentar",
  "/check-in": "Check-in",
  "/evolucao": "Evolução",
  "/documentos": "Documentos",
  "/treino": "Treino",
  "/treino-info": "Acompanhamento de treino",
};

export function AppHeader({ syncState = "idle", onBack }) {
  const pathname = usePathname();
  const title = TITLES[pathname] ?? "NutriFlow";

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "var(--nf-cream, #f5f5f2)",
        borderBottom: "1px solid var(--nf-line, rgba(10,10,10,0.14))",
        paddingTop: "var(--nf-safe-top)",
        paddingLeft: "var(--nf-safe-left)",
        paddingRight: "var(--nf-safe-right)",
      }}
    >
      <div
        style={{
          height: "var(--nf-header-h, 52px)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 12px",
        }}
      >
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar"
            className="nf-touch nf-pressable"
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "var(--nf-ink, #0a0a0a)",
              marginLeft: -10,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        <h1
          style={{
            flex: 1,
            margin: 0,
            fontSize: 17,
            fontWeight: 700,
            color: "var(--nf-ink, #0a0a0a)",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h1>

        <SyncIndicator state={syncState} />
        <form action="/auth/sair" method="post">
          <button
            type="submit"
            aria-label="Sair da área do paciente"
            style={{ border: 0, background: "transparent", color: "var(--nf-ink-muted, #6b6b68)", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "8px 4px" }}
          >
            Sair
          </button>
        </form>
      </div>
    </header>
  );
}

/**
 * Indicador de sincronização.
 *
 * aria-live="polite" para que leitores de tela anunciem mudanças de estado
 * sem interromper o que o paciente está fazendo (item 19 da análise).
 * Feedback é sempre VISUAL — vibração, quando existir, é extra por cima
 * (ponto 6 da revisão do Work).
 */
function SyncIndicator({ state }) {
  if (state === "idle") return null;

  const isOffline = state === "offline";

  return (
    <span
      role="status"
      aria-live="polite"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        color: isOffline
          ? "var(--nf-danger, #b5342a)"
          : "var(--nf-ink-soft, #242424)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: 6,
          background: isOffline
            ? "var(--nf-danger, #b5342a)"
            : "var(--nf-lime-dark, #dfce00)",
        }}
      />
      {isOffline ? "Sem conexão" : "Sincronizando"}
    </span>
  );
}
