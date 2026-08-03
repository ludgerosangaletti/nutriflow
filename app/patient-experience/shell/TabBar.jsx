"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * TabBar — navegação inferior persistente do Portal do Paciente.
 *
 * Fica no layout (não na página), então NÃO remonta ao navegar entre rotas
 * — é isso que elimina o "corte seco de site" descrito no item 1 da análise
 * crítica.
 *
 * Decisões registradas:
 * - 4 destinos fixos, nunca mais. O paciente nunca precisa adivinhar onde
 *   algo está (Manifesto M1 — nunca perdido).
 * - position: sticky, não fixed com container de scroll interno — a página
 *   mantém o scroll natural do documento (ver CORRECOES_REVISAO_WORK.md).
 * - padding-bottom com safe-area para a gesture bar do iPhone/Android.
 * - Cada item tem alvo de toque >= 44px mesmo com ícone pequeno.
 * - Usa <Link> do Next: navegação client-side dentro do layout persistente,
 *   sem recarregar a casca.
 *
 * Os ícones abaixo são SVG inline propositalmente — sem dependência de
 * biblioteca de ícones, já que o pacote não deve introduzir dependências
 * novas no projeto (ver INTEGRATION_GUIDE).
 */

const ITEMS = [
  { href: "/area-cliente", label: "Início", icon: IconHome },
  { href: "/plano-alimentar", label: "Plano", icon: IconPlan },
  { href: "/check-in", label: "Check-in", icon: IconCheck },
  { href: "/evolucao", label: "Evolução", icon: IconChart },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      style={{
        position: "sticky",
        bottom: 0,
        zIndex: 40,
        display: "flex",
        justifyContent: "space-around",
        alignItems: "stretch",
        background: "var(--nf-paper, #fff)",
        borderTop: "1px solid var(--nf-line, rgba(10,10,10,0.14))",
        paddingBottom: "var(--nf-safe-bottom)",
        paddingLeft: "var(--nf-safe-left)",
        paddingRight: "var(--nf-safe-right)",
      }}
    >
      {ITEMS.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className="nf-pressable"
            style={{
              flex: 1,
              minHeight: "var(--nf-touch-min, 44px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              padding: "8px 4px",
              textDecoration: "none",
              color: isActive
                ? "var(--nf-ink, #0a0a0a)"
                : "var(--nf-ink-muted, #6b6b68)",
              fontWeight: isActive ? 700 : 500,
              fontSize: 11,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 22,
                /* sublinhado lime marca o item ativo sem depender de cor de
                   texto lime (que teria contraste ruim em texto pequeno) */
                boxShadow: isActive
                  ? "0 3px 0 var(--nf-lime, #ffea00)"
                  : "none",
              }}
            >
              <Icon active={isActive} />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/* --- ícones (stroke currentColor, herdam a cor do item ativo/inativo) --- */

function IconHome({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.4 : 1.9}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </svg>
  );
}

function IconPlan({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.4 : 1.9}
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v8.5h8.5" />
    </svg>
  );
}

function IconCheck({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.4 : 1.9}
      strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </svg>
  );
}

function IconChart({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.4 : 1.9}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19h16" />
      <path d="m5 15 4.5-5 3.5 3.5L19 6" />
    </svg>
  );
}
