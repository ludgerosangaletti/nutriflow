"use client";

import { useEffect, useMemo, useState } from "react";
import type { PatientDocumentItem, PatientDocumentKind, PatientDocumentVersion } from "./document-model";

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const kinds: Readonly<Record<PatientDocumentKind, Readonly<{ label: string; icon: "chart" | "recipe" | "file"; dark: boolean }>>> = Object.freeze({
  assessment: { label: "Avaliação", icon: "chart", dark: true },
  bioimpedance: { label: "Bioimpedância", icon: "chart", dark: true },
  recipe: { label: "Receitas", icon: "recipe", dark: false },
  shopping: { label: "Lista de compras", icon: "recipe", dark: false },
  other: { label: "Documento", icon: "file", dark: false },
});

const filters = Object.freeze([
  { key: "all", label: "Todos", accepts: ["assessment", "bioimpedance", "recipe", "shopping", "other"] as PatientDocumentKind[] },
  { key: "assessment", label: "Avaliações", accepts: ["assessment", "bioimpedance"] as PatientDocumentKind[] },
  { key: "recipe", label: "Receitas", accepts: ["recipe", "shopping"] as PatientDocumentKind[] },
  { key: "other", label: "Outros", accepts: ["other"] as PatientDocumentKind[] },
]);

type OpenDocument = PatientDocumentItem | (PatientDocumentVersion & Pick<PatientDocumentItem, "title" | "kind">);

function date(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

function month(value: string) {
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(new Date(value));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function download(document: OpenDocument) {
  const anchor = window.document.createElement("a");
  anchor.href = document.downloadHref;
  anchor.download = "";
  anchor.rel = "noreferrer";
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export default function DocumentsScreen({ documents, nutritionistName, inPerson }: Readonly<{
  documents: readonly PatientDocumentItem[];
  nutritionistName: string;
  inPerson: boolean;
}>) {
  const [filter, setFilter] = useState("all");
  const [openDocument, setOpenDocument] = useState<OpenDocument | null>(null);
  const counts = useMemo(() => Object.fromEntries(filters.map((item) => [item.key, documents.filter((document) => item.accepts.includes(document.kind)).length])), [documents]);
  const visible = useMemo(() => {
    const active = filters.find((item) => item.key === filter) ?? filters[0];
    return documents.filter((document) => active.accepts.includes(document.kind));
  }, [documents, filter]);
  const groups = useMemo(() => {
    const grouped = new Map<string, PatientDocumentItem[]>();
    for (const document of visible) {
      const key = month(document.publishedAt);
      grouped.set(key, [...(grouped.get(key) ?? []), document]);
    }
    return grouped;
  }, [visible]);

  if (!documents.length) return <EmptyDocuments nutritionistName={nutritionistName} inPerson={inPerson} />;

  return <>
    <section className="nf-documents" aria-labelledby="documents-title">
      <header className="nf-documents-heading">
        <p className="nf-eyebrow">Seus arquivos</p>
        <h2 id="documents-title">{documents.length} {documents.length === 1 ? "documento" : "documentos"}</h2>
        <p>Avaliações e materiais publicados por {nutritionistName}.</p>
      </header>

      <div className="nf-document-filters" role="group" aria-label="Filtrar documentos por tipo">
        {filters.filter((item) => item.key === "all" || counts[item.key] > 0).map((item) => <button
          aria-pressed={filter === item.key}
          className="nf-pressable"
          key={item.key}
          onClick={() => setFilter(item.key)}
          type="button"
        >{item.label}<span>{counts[item.key]}</span></button>)}
      </div>

      {!visible.length ? <p className="nf-documents-filter-empty">Nenhum documento neste filtro.</p> : [...groups].map(([label, group]) => <section className="nf-document-month" key={label}>
        <p className="nf-eyebrow">{label}</p>
        {group.map((document) => <DocumentRow document={document} key={document.id} onDownload={() => download(document)} onOpen={() => setOpenDocument(document)} onOpenVersion={(version) => setOpenDocument({ ...version, title: document.title, kind: document.kind })} />)}
      </section>)}
    </section>
    {openDocument ? <DocumentViewer document={openDocument} onClose={() => setOpenDocument(null)} onDownload={() => download(openDocument)} /> : null}
  </>;
}

function DocumentRow({ document, onOpen, onDownload, onOpenVersion }: Readonly<{
  document: PatientDocumentItem;
  onOpen: () => void;
  onDownload: () => void;
  onOpenVersion: (version: PatientDocumentVersion) => void;
}>) {
  const [expanded, setExpanded] = useState(false);
  const kind = kinds[document.kind];
  return <>
    <article className={`nf-document-row${document.isNew ? " is-new" : ""}`}>
      <button className="nf-document-open nf-pressable" onClick={onOpen} type="button">
        <span className={`nf-document-kind${kind.dark ? " is-dark" : ""}`}><Icon name={kind.icon} /></span>
        <span className="nf-document-copy">
          <span className="nf-document-title">{document.title}{document.isNew ? <b>Novo</b> : null}</span>
          <span className="nf-document-meta"><span>{kind.label}</span><i>·</i><span>{date(document.publishedAt)}</span>{document.pageCount ? <><i>·</i><span>{document.pageCount} páginas</span></> : null}{document.sizeLabel ? <><i>·</i><span>{document.sizeLabel}</span></> : null}</span>
        </span>
      </button>
      <button aria-label={`Baixar ${document.title}`} className="nf-document-download nf-pressable" onClick={onDownload} type="button"><Icon name="download" /></button>
    </article>
    {document.versions.length ? <div className="nf-document-versions">
      <button aria-expanded={expanded} className="nf-document-versions-toggle nf-pressable" onClick={() => setExpanded((value) => !value)} type="button">
        <span>Ver versões anteriores <strong>({document.versions.length})</strong></span><span aria-hidden="true">{expanded ? "▴" : "▾"}</span>
      </button>
      {expanded ? document.versions.map((version) => <button className="nf-document-version nf-pressable" key={version.id} onClick={() => onOpenVersion(version)} type="button">
        <span>{version.label} · {date(version.publishedAt)}</span><b>Anterior</b>
      </button>) : null}
    </div> : null}
  </>;
}

function DocumentViewer({ document, onClose, onDownload }: Readonly<{ document: OpenDocument; onClose: () => void; onDownload: () => void }>) {
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    window.document.body.classList.add("nf-document-viewer-open");
    return () => { window.removeEventListener("keydown", close); window.document.body.classList.remove("nf-document-viewer-open"); };
  }, [onClose]);

  const share = async () => {
    if (!canShare) return;
    try { await navigator.share({ title: document.title, url: new URL(document.downloadHref, window.location.origin).href }); } catch { /* cancelamento do compartilhamento não altera a tela */ }
  };

  return <div aria-label={document.title} aria-modal="true" className="nf-document-viewer" role="dialog">
    <header>
      <button aria-label="Fechar documento" autoFocus onClick={onClose} type="button"><Icon name="close" /></button>
      <div><strong>{document.title}</strong><span>{date(document.publishedAt)}{document.pageCount ? ` · ${document.pageCount} páginas` : ""}</span></div>
    </header>
    <div className="nf-document-frame"><iframe src={document.viewHref} title={document.title} /></div>
    <footer>
      {canShare ? <button className="nf-pressable is-secondary" onClick={share} type="button"><Icon name="share" />Compartilhar</button> : null}
      <button className="nf-pressable is-primary" onClick={onDownload} type="button"><Icon name="download" />Baixar</button>
    </footer>
  </div>;
}

function EmptyDocuments({ nutritionistName, inPerson }: Readonly<{ nutritionistName: string; inPerson: boolean }>) {
  return <section className="nf-documents nf-documents-empty" aria-labelledby="documents-empty-title">
    <header className="nf-documents-heading"><p className="nf-eyebrow">Seus arquivos</p><h2 id="documents-empty-title">Nada por aqui ainda</h2></header>
    <div className="nf-documents-empty-content">
      <span aria-hidden="true"><Icon name="folder" /></span>
      <h3>Seu primeiro documento chega em breve</h3>
      <p>Avaliações e materiais complementares ficam guardados aqui, sempre disponíveis.</p>
      <div><b aria-hidden="true">{nutritionistName.slice(0, 1).toUpperCase()}</b><p>{inPerson ? `Depois da sua consulta presencial, ${nutritionistName} publica a avaliação física aqui - normalmente em até 2 dias úteis. Você recebe um aviso no celular.` : `${nutritionistName} publica aqui os materiais complementares do seu acompanhamento assim que estiverem prontos.`}</p></div>
    </div>
  </section>;
}

function Icon({ name }: Readonly<{ name: "chart" | "recipe" | "file" | "folder" | "download" | "share" | "close" }>) {
  const paths = {
    chart: <><path d="M4 19h16" /><path d="m5 15 4.5-5 3.5 3.5L19 6" /></>,
    recipe: <><path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z" /><path d="M9 9h6M9 13h4" /></>,
    file: <><path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z" /><path d="M14 3.5V8h4.5" /></>,
    folder: <path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2.5h8A1.5 1.5 0 0 1 20.5 10v8a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18z" />,
    download: <><path d="M12 4v11" /><path d="m7.5 11 4.5 4.5 4.5-4.5" /><path d="M5 19.5h14" /></>,
    share: <><path d="M12 4v11" /><path d="m8 7.5 4-3.5 4 3.5" /><path d="M5 13v6.5h14V13" /></>,
    close: <path d="M6 6l12 12M18 6 6 18" />,
  };
  return <svg {...iconProps} width="20" height="20" strokeWidth="1.9">{paths[name]}</svg>;
}
