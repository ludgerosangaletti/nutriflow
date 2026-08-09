"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Instalações antigas podem continuar armazenando start_url "/" mesmo após
 * a atualização do manifesto. No modo aplicativo, a raiz deve sempre abrir
 * a autenticação do paciente; no navegador, a página pública permanece igual.
 */
export function StandaloneEntryRedirect() {
  const pathname = usePathname();
  const [standalone, setStandalone] = useState<boolean | null>(null);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    setStandalone(isStandalone);
    if (pathname === "/" && isStandalone) window.location.replace("/app");
  }, [pathname]);

  if (pathname === "/" && standalone) {
    return <div className="app-login-splash" role="status" aria-label="Abrindo o NutriFlow"><img src="/icons/splash-mark-512.png" alt="" /><strong>NutriFlow</strong><span className="app-login-loader" /></div>;
  }
  return null;
}
