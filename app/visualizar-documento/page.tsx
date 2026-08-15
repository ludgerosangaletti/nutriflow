import { redirect } from "next/navigation";
import { requirePatient } from "../supabase/server";
import GeneratedPdfViewer from "./generated-pdf-viewer";

export const dynamic = "force-dynamic";

type ViewerSearchParams = Promise<Readonly<{
  type?: string | string[];
  strategy?: string | string[];
  assessment?: string | string[];
}>>;

function value(input: string | string[] | undefined) {
  return (Array.isArray(input) ? input[0] : input)?.trim() ?? "";
}

export default async function GeneratedDocumentPage({ searchParams }: Readonly<{ searchParams: ViewerSearchParams }>) {
  const params = await searchParams;
  const type = value(params.type);
  const strategy = value(params.strategy);
  const assessment = value(params.assessment);
  const currentHref = type === "plan"
    ? `/visualizar-documento?type=plan${strategy ? `&strategy=${encodeURIComponent(strategy)}` : ""}`
    : `/visualizar-documento?type=assessment${assessment ? `&assessment=${encodeURIComponent(assessment)}` : ""}`;

  await requirePatient(currentHref);

  if (type === "plan") {
    const pdfUrl = `/api/nutriflow/v1/plan-pdf${strategy ? `?strategy=${encodeURIComponent(strategy)}` : ""}`;
    return <GeneratedPdfViewer backHref="/plano-alimentar" filename="plano-alimentar.pdf" pdfUrl={pdfUrl} title="Plano alimentar" />;
  }

  if (type === "assessment" && assessment) {
    const pdfUrl = `/api/evolucao/relatorio?assessment=${encodeURIComponent(assessment)}`;
    return <GeneratedPdfViewer backHref="/evolucao" filename="avaliacao-fisica.pdf" pdfUrl={pdfUrl} title="Avaliação física" />;
  }

  redirect("/area-cliente");
}
