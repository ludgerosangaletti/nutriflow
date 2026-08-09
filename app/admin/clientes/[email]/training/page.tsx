import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "../../../../../db";
import { clients } from "../../../../../db/schema";
import { NUTRIFLOW_FEATURE_FLAGS } from "../../../../../modules/nutriflow/config/feature-flags";
import { canUseNutriFlowFeature, resolveNutriFlowAdminContext } from "../../../../nutriflow/server";
import { requireAdmin } from "../../../../supabase/server";
import TrainingEditor from "./training-editor";

export const dynamic = "force-dynamic";

export default async function TrainingEditorPage({ params }: { params: Promise<{ email: string }> }) {
  const user = await requireAdmin("/admin/clientes");
  const email = decodeURIComponent((await params).email);
  const [client] = await getDb().select().from(clients).where(and(eq(clients.email, email))).limit(1);
  const context = client ? await resolveNutriFlowAdminContext(user.id) : null;
  if (!client || !context || !(await canUseNutriFlowFeature(context, client.id, NUTRIFLOW_FEATURE_FLAGS.TRAINING))) notFound();
  return <main className="portal-shell training-page"><header className="portal-header"><Link className="portal-brand" href={`/admin/clientes/${encodeURIComponent(client.email)}`}>â† ProntuÃ¡rio de {client.name}</Link><span>NutriFlow Training</span></header><TrainingEditor clientId={client.id} patientName={client.name} /></main>;
}
