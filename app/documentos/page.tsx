import { and, asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "../../db";
import { clients, nfClinicalAssessments, patientDocuments } from "../../db/schema";
import { hasActiveAccess } from "../access";
import { PatientShell } from "../patient-experience/shell/PatientShell";
import { requirePatient } from "../supabase/server";
import { buildPatientDocumentItems } from "./document-model";
import DocumentsScreen from "./documents-screen";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const user = await requirePatient("/documentos");
  const db = getDb();
  const [client] = await db.select().from(clients).where(eq(clients.authUserId, user.id)).limit(1);

  if (!client || !hasActiveAccess(client)) {
    return <PatientShell><main className="portal-shell"><section className="empty-state">
      <p className="section-kicker">Documentos</p><h1>Materiais indisponíveis.</h1>
      <p>Aguarde a confirmação do pagamento ou renove seu plano.</p>
      <Link className="button button-dark" href="/area-cliente">Voltar</Link>
    </section></main></PatientShell>;
  }

  const [storedDocuments, assessments] = await Promise.all([
    db.select().from(patientDocuments).where(eq(patientDocuments.clientEmail, client.email)).orderBy(desc(patientDocuments.publishedAt), desc(patientDocuments.id)),
    client.organizationId == null
      ? Promise.resolve([])
      : db.select({ publicId: nfClinicalAssessments.publicId, capturedAt: nfClinicalAssessments.capturedAt })
        .from(nfClinicalAssessments)
        .where(and(eq(nfClinicalAssessments.clientId, client.id), eq(nfClinicalAssessments.organizationId, client.organizationId)))
        .orderBy(asc(nfClinicalAssessments.capturedAt), asc(nfClinicalAssessments.id)),
  ]);
  const documents = buildPatientDocumentItems({ storedDocuments, assessments });

  return <PatientShell><main className="portal-shell nf-documents-page">
    <DocumentsScreen documents={documents} inPerson={client.modality === "in_person"} nutritionistName="Ludgero" />
  </main></PatientShell>;
}
