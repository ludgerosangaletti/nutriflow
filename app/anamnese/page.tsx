import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "../../db";
import { anamneses, clients } from "../../db/schema";
import { hasActiveAccess } from "../access";
import { requirePatient } from "../supabase/server";
import type { Answers } from "./questions";
import AnamneseForm from "./anamnese-form";

export const dynamic = "force-dynamic";

export default async function AnamnesePage() {
  const user = await requirePatient("/anamnese");
  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.authUserId, user.id))
    .limit(1);
  if (client?.modality === "in_person") redirect("/area-cliente");

  if (!client || !hasActiveAccess(client)) {
    return (
      <main className="portal-shell">
        <section className="empty-state">
          <h1>A anamnese não está disponível.</h1>
          <p>
            Aguarde a confirmação do pagamento ou renove seu plano caso a
            vigência tenha terminado.
          </p>
          <a className="button button-dark" href="/area-cliente">Voltar</a>
        </section>
      </main>
    );
  }

  const [record] = await db
    .select()
    .from(anamneses)
    .where(eq(anamneses.clientEmail, client.email))
    .limit(1);

  let answers: Answers = {};
  try {
    answers = record ? JSON.parse(record.answersJson) : {};
  } catch {
    answers = {};
  }

  return (
    <AnamneseForm
      initialAnswers={answers}
      initialStatus={record?.status ?? "not_started"}
    />
  );
}
