"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_STORAGE_KEY = "nf-install-prompt-dismissed";

/**
 * Banner discreto sugerindo instalar o app — não bloqueante, some
 * definitivamente se o paciente recusar (sem insistir a cada visita).
 *
 * v3: cores/raios trocados pelos valores reais do site (creme #f5f5f2,
 * preto #0a0a0a, lime #ffea00, radius 24px) — ver
 * docs/IDENTIDADE_VISUAL_REAL.md do Experience Pack.
 *
 * Faltava no pacote recebido do Work: o manifest.webmanifest e o service
 * worker já habilitam a instalação, mas nada no app captura o evento
 * `beforeinstallprompt` para oferecer isso de forma visível. Sem este
 * componente, o único jeito de instalar seria o paciente descobrir a opção
 * sozinho no menu do navegador.
 *
 * Importante para iOS/Safari: esse navegador não dispara
 * `beforeinstallprompt` e não expõe instalação programática — por isso o
 * componente simplesmente não aparece lá. Um texto manual de "Adicionar à
 * Tela de Início" para iOS é uma decisão de copy/produto que ficou de fora
 * deste componente; avise se quiser que eu adicione essa variação.
 */
export function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(DISMISS_STORAGE_KEY) === "1") return;

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  async function handleInstall() {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    const { outcome } = await deferredEvent.userChoice;
    if (outcome === "dismissed") {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, "1");
    }
    setVisible(false);
    setDeferredEvent(null);
  }

  function handleDismiss() {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible || !deferredEvent) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-[24px] border border-black/[0.14] bg-[#f5f5f2] p-4">
      <div>
        <p className="text-sm font-bold text-[#0a0a0a]">Instalar o NutriFlow</p>
        <p className="mt-1 text-sm text-[#242424]">
          Adicione à tela de início para acessar seu plano mais rápido.
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-[10px] px-3 py-2 text-sm text-[#242424]"
        >
          Agora não
        </button>
        <button
          type="button"
          onClick={handleInstall}
          className="rounded-[10px] bg-[#ffea00] px-3 py-2 text-sm font-bold text-[#0a0a0a]"
        >
          Instalar
        </button>
      </div>
    </div>
  );
}
