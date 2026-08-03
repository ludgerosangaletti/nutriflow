"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Instalações antigas podem continuar armazenando start_url "/" mesmo após
 * a atualização do manifesto. No modo aplicativo, a raiz deve sempre abrir
 * a autenticação do paciente; no navegador, a página pública permanece igual.
 */
export function StandaloneEntryRedirect() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    if (standalone) window.location.replace("/entrar");
  }, [pathname]);

  return null;
}
