"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type PdfResource = Readonly<{ file: File; objectUrl: string }>;

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

export default function GeneratedPdfViewer({ backHref, filename, pdfUrl, title }: Readonly<{
  backHref: string;
  filename: string;
  pdfUrl: string;
  title: string;
}>) {
  const router = useRouter();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [resource, setResource] = useState<PdfResource | null>(null);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState("Preparando documento…");

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";
    document.body.classList.add("nf-generated-pdf-open");

    void fetch(pdfUrl, { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("PDF indisponível");
        const blob = await response.blob();
        const file = new File([blob], filename, { type: "application/pdf" });
        objectUrl = URL.createObjectURL(file);
        setResource(Object.freeze({ file, objectUrl }));
        setMessage("Documento pronto");
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(true);
        setMessage("Não foi possível abrir o documento.");
      });

    return () => {
      controller.abort();
      document.body.classList.remove("nf-generated-pdf-open");
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [filename, pdfUrl]);

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.replace(backHref);
  }

  async function share() {
    if (!resource) return;
    try {
      const shareData = { files: [resource.file], title };
      if (typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
        return;
      }
      const anchor = document.createElement("a");
      anchor.href = resource.objectUrl;
      anchor.download = filename;
      anchor.click();
      setMessage("Arquivo baixado para você compartilhar.");
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setMessage("Não foi possível compartilhar agora.");
    }
  }

  function print() {
    if (!resource) return;
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
      {resource ? <iframe ref={frameRef} src={resource.objectUrl} title={title} /> : <div className={error ? "is-error" : "is-loading"}><span aria-hidden="true" /> <p>{message}</p>{error ? <button onClick={goBack} type="button">Voltar</button> : null}</div>}
    </section>

    <footer className="nf-generated-pdf-actions" aria-label="Ações do documento">
      <button disabled={!resource} onClick={() => void share()} type="button"><Icon name="share" /><span>Compartilhar</span></button>
      <button disabled={!resource} onClick={print} type="button"><Icon name="print" /><span>Imprimir</span></button>
    </footer>
  </main>;
}
