import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { anamneses, clients } from "../../../../../db/schema";
import AnamneseForm from "../../../../anamnese/anamnese-form";
import type { Answers } from "../../../../anamnese/questions";
import { requireAdmin } from "../../../../supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminInPersonAnamnesisPage({ params }: { params: Promise<{ email: string }> }) {
  await requireAdmin("/admin/clientes");
  const email = decodeURIComponent((await params).email).trim().toLowerCase();
  const db = getDb();
  const [client] = await db.select().from(clients).where(eq(clients.email, email)).limit(1);
  if (!client || client.modality !== "in_person") return <main className="portal-shell"><section className="empty-state"><h1>Paciente presencial não encontrado.</h1></section></main>;
  const [record] = await db.select().from(anamneses).where(eq(anamneses.clientEmail, email)).limit(1);
  let answers: Answers = {};
  try { answers = record ? JSON.parse(record.answersJson) : {}; } catch { answers = {}; }
  const backHref = `/admin/clientes/${encodeURIComponent(email)}`;
  return <AnamneseForm initialAnswers={answers} initialStatus={record?.status ?? "not_started"} mode="admin" endpoint="/api/admin/anamnese" patientEmail={email} backHref={backHref} />;
}
