"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "./AppHeader";
import { TabBar } from "./TabBar";

/**
 * PatientShell — a casca persistente do Portal do Paciente.
 *
 * PROPOSTA, não imposição: o Work sinalizou que mover as 4 rotas para um
 * grupo `app/(paciente)/` exige teste cuidadoso de autenticação,
 * redirecionamentos, links existentes e compatibilidade entre pacientes
 * online e presenciais. A decisão de adotar o grupo de rotas é dele.
 *
 * Este componente funciona nos dois cenários:
 *  (a) dentro de app/(paciente)/layout.tsx — casca realmente persistente,
 *      não remonta ao navegar (o ganho de "sensação de app" é máximo aqui);
 *  (b) envolvendo o conteúdo de cada page.tsx individualmente — funciona
 *      igual visualmente, mas remonta a cada navegação (ganho parcial).
 *
 * Não altera autenticação: as páginas continuam autenticando via
 * requirePatient nos seus próprios Server Components. Esta casca é
 * puramente visual e não conhece sessão, banco ou domínio.
 *
 * NOTA sobre scroll (ver CORRECOES_REVISAO_WORK.md, ponto 7):
 * deliberadamente NÃO há container de scroll interno, altura 100vh fixa,
 * nem overscroll-behavior. A página rola naturalmente; header e tabbar são
 * sticky. Isso preserva zoom, teclado virtual, Dynamic Type e leitores de
 * tela.
 */
export function PatientShell({ children, onBack }) {
  const syncState = useConnectionState();

  return (
    <div
      className="nf-experience-shell"
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "var(--nf-cream, #f5f5f2)",
      }}
    >
      <AppHeader syncState={syncState} onBack={onBack} />

      {/* Link de pular para o conteúdo — navegação por teclado (WCAG 2.4.1).
          Visível só quando focado. */}
      <a
        href="#conteudo"
        style={{
          position: "absolute",
          left: -9999,
          top: 0,
        }}
        onFocus={(e) => {
          e.currentTarget.style.left = "12px";
          e.currentTarget.style.top = "12px";
          e.currentTarget.style.zIndex = "60";
          e.currentTarget.style.background = "var(--nf-paper, #fff)";
          e.currentTarget.style.padding = "8px 12px";
          e.currentTarget.style.borderRadius = "10px";
        }}
        onBlur={(e) => {
          e.currentTarget.style.left = "-9999px";
        }}
      >
        Pular para o conteúdo
      </a>

      <div
        id="conteudo"
        style={{
          flex: 1,
          paddingLeft: "max(16px, var(--nf-safe-left))",
          paddingRight: "max(16px, var(--nf-safe-right))",
          paddingTop: 16,
          paddingBottom: "calc(88px + var(--nf-safe-bottom))",
        }}
      >
        {children}
      </div>

      <TabBar />
    </div>
  );
}

/**
 * Estado de conexão — apenas para exibir o indicador no cabeçalho.
 *
 * ESCOPO RESTRITO, conforme definido pelo Work: isto só observa
 * navigator.onLine para informar o paciente. Não cacheia dado clínico, não
 * enfileira escrita offline, não sincroniza nada. Qualquer estratégia real
 * de offline para dados clínicos precisa de decisão de arquitetura,
 * sincronização e auditoria — fora do escopo deste pacote.
 */
function useConnectionState() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOffline(!navigator.onLine);

    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  return isOffline ? "offline" : "idle";
}
