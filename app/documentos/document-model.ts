export type PatientDocumentKind = "assessment" | "bioimpedance" | "recipe" | "shopping" | "other";

export type PatientDocumentVersion = Readonly<{
  id: string;
  label: string;
  publishedAt: string;
  viewHref: string;
  downloadHref: string;
  sizeLabel?: string;
  pageCount?: number;
}>;

export type PatientDocumentItem = Readonly<{
  id: string;
  title: string;
  kind: PatientDocumentKind;
  publishedAt: string;
  viewHref: string;
  downloadHref: string;
  sizeLabel?: string;
  pageCount?: number;
  isNew?: boolean;
  versions: readonly PatientDocumentVersion[];
}>;

type StoredDocument = Readonly<{
  id: number;
  documentType: string;
  title: string;
  version: string;
  sizeBytes: number;
  isCurrent: boolean;
  publishedAt: string;
}>;

type Assessment = Readonly<{
  publicId: string;
  capturedAt: string;
}>;

const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function formatDocumentSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return undefined;
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1).replace(".", ",")} MB`;
}

export function isRecentlyPublished(publishedAt: string, now = Date.now()) {
  const timestamp = new Date(publishedAt).getTime();
  return Number.isFinite(timestamp) && timestamp <= now && now - timestamp <= NEW_WINDOW_MS;
}

function ordinal(index: number) {
  return `${index + 1}ª`;
}

function storedKind(documentType: string): PatientDocumentKind | null {
  if (documentType === "protocol") return null;
  if (documentType === "physical_assessment") return "bioimpedance";
  if (documentType === "recipe") return "recipe";
  if (documentType === "shopping") return "shopping";
  return "other";
}

function storedVersion(document: StoredDocument): PatientDocumentVersion {
  return Object.freeze({
    id: `stored:${document.id}`,
    label: `Versão ${document.version}`,
    publishedAt: document.publishedAt,
    viewHref: `/api/documentos/${document.id}?mode=inline`,
    downloadHref: `/api/documentos/${document.id}`,
    sizeLabel: formatDocumentSize(document.sizeBytes),
  });
}

function storedGroupKey(document: StoredDocument) {
  if (document.documentType === "physical_assessment") return "physical_assessment";
  return `${document.documentType}:${document.title.trim().toLocaleLowerCase("pt-BR")}`;
}

function storedItems(documents: readonly StoredDocument[], now: number) {
  const supported = documents.filter((document) => storedKind(document.documentType));
  const groups = new Map<string, StoredDocument[]>();
  for (const document of supported) {
    const key = storedGroupKey(document);
    groups.set(key, [...(groups.get(key) ?? []), document]);
  }
  const result: PatientDocumentItem[] = [];

  for (const group of groups.values()) {
    const ordered = [...group].toSorted((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id - a.id);
    const current = ordered.find((document) => document.isCurrent) ?? ordered[0];
    const previous = ordered.filter((document) => document.id !== current.id);
    const kind = storedKind(current.documentType);
    if (!kind) continue;
    result.push(Object.freeze({
      id: `stored:${current.id}`,
      title: current.title,
      kind,
      publishedAt: current.publishedAt,
      viewHref: `/api/documentos/${current.id}?mode=inline`,
      downloadHref: `/api/documentos/${current.id}`,
      sizeLabel: formatDocumentSize(current.sizeBytes),
      isNew: isRecentlyPublished(current.publishedAt, now),
      versions: Object.freeze(previous.map(storedVersion)),
    }));
  }
  return result;
}

function assessmentItem(assessments: readonly Assessment[], now: number): PatientDocumentItem | null {
  if (!assessments.length) return null;
  const ordered = [...assessments].toSorted((a, b) => a.capturedAt.localeCompare(b.capturedAt) || a.publicId.localeCompare(b.publicId));
  const current = ordered.at(-1)!;
  const currentIndex = ordered.length - 1;
  const href = (assessment: Assessment) => `/api/evolucao/relatorio?assessment=${encodeURIComponent(assessment.publicId)}`;
  return Object.freeze({
    id: `assessment:${current.publicId}`,
    title: `Avaliação física - ${ordinal(currentIndex)}`,
    kind: "assessment",
    publishedAt: current.capturedAt,
    viewHref: `${href(current)}#toolbar=0`,
    downloadHref: href(current),
    pageCount: 2,
    isNew: isRecentlyPublished(current.capturedAt, now),
    versions: Object.freeze(ordered.slice(0, -1).toReversed().map((assessment, index) => {
      const originalIndex = currentIndex - index - 1;
      return Object.freeze({
        id: `assessment:${assessment.publicId}`,
        label: `${ordinal(originalIndex)} avaliação`,
        publishedAt: assessment.capturedAt,
        viewHref: `${href(assessment)}#toolbar=0`,
        downloadHref: href(assessment),
        pageCount: 2,
      });
    })),
  });
}

export function buildPatientDocumentItems(input: Readonly<{
  storedDocuments: readonly StoredDocument[];
  assessments: readonly Assessment[];
  now?: number;
}>) {
  const now = input.now ?? Date.now();
  const assessment = assessmentItem(input.assessments, now);
  return Object.freeze([
    ...(assessment ? [assessment] : []),
    ...storedItems(input.storedDocuments, now),
  ].toSorted((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id)));
}
