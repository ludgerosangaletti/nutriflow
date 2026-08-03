"use client";

import { useEffect } from "react";

/**
 * Registra o service worker do PWA. Não pede permissão de notificação
 * (isso fica a cargo de <NotificationOptIn />, acionado por ação do usuário).
 * Renderizar uma vez no layout raiz.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Falha ao registrar o service worker do PWA:", error);
    });
  }, []);

  return null;
}
