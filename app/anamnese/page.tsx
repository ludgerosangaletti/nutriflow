import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { anamneses, clients } from "../../db/schema";
import { requireChatGPTUser } from "../chatgpt-auth";
import type { Answers } from "./questions";
import AnamneseForm from "./anamnese-form";

export const dynamic = "force-dynamic";

export default async function AnamnesePage() {
  const user = await requireChatGPTUser("/anamnese");
  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.email, user.email), eq(clients.paymentStatus, "approved")))
    .limit(1);

  if (!client) {
    return (
      <main className="portal-shell">
        <section className="empty-state">
          <h1>A anamnese ainda não foi liberada.</h1>
          <p>Aguarde a confirmação do pagamento para continuar.</p>
          <a className="button button-dark" href="/area-cliente">Voltar</a>
        </section>
      </main>
    );
  }

  const [record] = await db
    .select()
    .from(anamneses)
    .where(eq(anamneses.clientEmail, user.email))
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
