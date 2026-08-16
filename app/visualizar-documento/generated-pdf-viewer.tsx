"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  strokeWidth: 1.9,
  "aria-hidden": true,
};

function Icon({ name }: Readonly<{ name: "back" | "share" | "print" }>) {
  const path = {
    back: <><path d="m15 18-6-6 6-6" /><path d="M9 12h11" /></>,
    share: <><path d="M12 4v11" /><path d="m8 7.5 4-3.5 4 3.5" /><path d="M5 13v6.5h14V13" /></>,
    print: <><path d="M7 9V4h10v5" /><path d="M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M7 14h10v6H7z" /></>,
  }[name];
  return <svg {...iconProps} height="21" width="21">{path}</svg>;
}

function prefersNativePdfViewer() {
  const userAgent = navigator.userAgent;
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iPadOs || /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
}

export default function GeneratedPdfViewer({ backHref, filename, onClose, pdfUrl, title }: Readonly<{
  backHref: string;
  filename: string;
  onClose?: () => void;
  pdfUrl: string;
  title: string;
}>) {
  const router = useRouter();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [frameError, setFrameError] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState("Abrindo documento…");

  useEffect(() => {
    document.body.classList.add("nf-generated-pdf-open");
    return () => {
      document.body.classList.remove("nf-generated-pdf-open");
    };
  }, []);

  function goBack() {
    if (onClose) {
      onClose();
      return;
    }
    if (window.history.length > 1) router.back();
    else router.replace(backHref);
  }

  async function share() {
    if (sharing) return;
    setSharing(true);
    setMessage("Preparando para compartilhar…");
    let objectUrl = "";
    try {
      const response = await fetch(pdfUrl, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error("PDF indisponível");
      const file = new File([await response.blob()], filename, { type: "application/pdf" });
      const shareData = { files: [file], title };
      if (typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
        setMessage("Documento pronto");
        return;
      }
      const anchor = document.createElement("a");
      objectUrl = URL.createObjectURL(file);
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.click();
      setMessage("Arquivo baixado para você compartilhar.");
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setMessage("Não foi possível compartilhar agora.");
    } finally {
      if (objectUrl) window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setSharing(false);
    }
  }

  function print() {
    if (!ready) return;
    const frameWindow = frameRef.current?.contentWindow;
    if (frameWindow) {
      frameWindow.focus();
      frameWindow.print();
      return;
    }
    window.print();
  }

  return <main className="nf-generated-pdf-viewer">
    <header className="nf-generated-pdf-header">
      <button aria-label="Voltar à página anterior" className="nf-generated-pdf-back" onClick={goBack} type="button"><Icon name="back" /></button>
      <div><strong>{title}</strong><span aria-live="polite">{message}</span></div>
    </header>

    <section className="nf-generated-pdf-canvas" aria-label={`Visualização: ${title}`}>
      <iframe
        onError={() => { setFrameError(true); setMessage("Não foi possível exibir o documento aqui."); }}
        onLoad={() => { setReady(true); setFrameError(false); setMessage("Documento pronto"); }}
        ref={frameRef}
        src={pdfUrl}
        title={title}
      />
      {!ready || frameError ? <div className={frameError ? "is-error" : "is-loading"}><span aria-hidden="true" /><p>{message}</p>{frameError ? <a href={pdfUrl} rel="noreferrer" target="_blank">Abrir arquivo diretamente</a> : null}</div> : null}
    </section>

    <footer className="nf-generated-pdf-actions" aria-label="Ações do documento">
      <button disabled={!ready || sharing} onClick={() => void share()} type="button"><Icon name="share" /><span>{sharing ? "Preparando…" : "Compartilhar"}</span></button>
      <button disabled={!ready} onClick={print} type="button"><Icon name="print" /><span>Imprimir</span></button>
    </footer>
  </main>;
}

export function GeneratedPdfLauncher({ backHref, children, className, filename, pdfUrl, title }: Readonly<{
  backHref: string;
  children: ReactNode;
  className?: string;
  filename: string;
  pdfUrl: string;
  title: string;
}>) {
  const [open, setOpen] = useState(false);
  function openPdf() {
    if (prefersNativePdfViewer()) {
      window.location.assign(pdfUrl);
      return;
    }
    setOpen(true);
  }
  return <>
    <button className={className} onClick={openPdf} type="button">{children}</button>
    {open ? <GeneratedPdfViewer backHref={backHref} filename={filename} onClose={() => setOpen(false)} pdfUrl={pdfUrl} title={title} /> : null}
  </>;
}
