"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export function MobileAppBanner() {
  const pathname = usePathname();
  const [mobile, setMobile] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const update = () => setMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    update();
    setStandalone(media.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    window.addEventListener("beforeinstallprompt", capture);
    return () => window.removeEventListener("beforeinstallprompt", capture);
  }, []);

  if (pathname !== "/" || !mobile || standalone) return null;

  async function install() {
    if (prompt) {
      await prompt.prompt();
      setPrompt(null);
      return;
    }
    setShowHelp(true);
  }

  return <aside className="mobile-app-banner" role="status">
    <div className="mobile-app-banner-icon"><img src="/logo-ludgero.png" alt="" /></div>
    <div><strong>Já é paciente?</strong><p>Baixe o NutriFlow e acesse seu acompanhamento como um app.</p></div>
    <button type="button" onClick={install}>{prompt ? "Baixar app" : "Como instalar"}</button>
    {showHelp ? <div className="mobile-app-help"><b>Como adicionar</b><span>Android: toque em “Instalar aplicativo”. iPhone: Safari → Compartilhar → Adicionar à Tela de Início.</span><button type="button" onClick={() => setShowHelp(false)}>Fechar</button></div> : null}
  </aside>;
}
