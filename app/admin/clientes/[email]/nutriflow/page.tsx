import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "../../../../../db";
import { clients } from "../../../../../db/schema";
import { canUseNutriFlowEditor, canUseNutriFlowFeature, resolveNutriFlowAdminContext } from "../../../../nutriflow/server";
import { NUTRIFLOW_FEATURE_FLAGS } from "../../../../../modules/nutriflow/config/feature-flags";
import { requireAdmin } from "../../../../supabase/server";
import NutriFlowEditor from "./nutriflow-editor";

export const dynamic = "force-dynamic";

export default async function NutriFlowEditorPage({ params }: { params: Promise<{ email: string }> }) {
  const user = await requireAdmin("/admin/clientes");
  const email = decodeURIComponent((await params).email);
  const [client] = await getDb().select().from(clients).where(and(eq(clients.email, email))).limit(1);
  if (!client) notFound();
  const context = await resolveNutriFlowAdminContext(user.id);
  if (!context || !(await canUseNutriFlowEditor(context, client.id))) notFound();
  const [catalogEnabled, recipesEnabled, mealTemplatesEnabled, nutritionTotalsEnabled] = await Promise.all([
    canUseNutriFlowFeature(context, client.id, NUTRIFLOW_FEATURE_FLAGS.GLOBAL_CATALOG),
    canUseNutriFlowFeature(context, client.id, NUTRIFLOW_FEATURE_FLAGS.RECIPES),
    canUseNutriFlowFeature(context, client.id, NUTRIFLOW_FEATURE_FLAGS.MEAL_TEMPLATES),
    canUseNutriFlowFeature(context, client.id, NUTRIFLOW_FEATURE_FLAGS.NUTRITION_TOTALS),
  ]);
  return <main className="portal-shell nutriflow-page"><header className="portal-header"><Link className="portal-brand" href={`/admin/clientes/${encodeURIComponent(client.email)}`}>← Prontuário de {client.name}</Link><span>NutriFlow · rascunho</span></header><NutriFlowEditor clientId={client.id} patientName={client.name} tools={{ catalogEnabled, recipesEnabled, mealTemplatesEnabled, nutritionTotalsEnabled }} /></main>;
}
