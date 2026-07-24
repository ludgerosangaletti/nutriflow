import { eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "../../db";
import { clients } from "../../db/schema";
import { isPlanId, plans } from "../plans";
import { requirePatient } from "../supabase/server";
import PaymentButton from "./payment-button";

export const dynamic = "force-dynamic";

export default async function PaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ plano?: string }>;
}) {
  const user = await requirePatient("/pagamento");
  const [client] = await getDb().select().from(clients).where(eq(clients.authUserId, user.id)).limit(1);
  const requested = (await searchParams).plano;
  const planId = requested && isPlanId(requested)
    ? requested
    : client && isPlanId(client.plan)
      ? client.plan
      : "trimestral";
  const plan = plans[planId];

  return (
    <main className="portal-shell auth-page">
      <Link className="portal-brand" href="/">Ludgero Sangaletti</Link>
      <section className="auth-layout">
        <div className="portal-copy">
          <p className="section-kicker">Etapa 3 de 4</p>
          <h1>Finalize sua contratação.</h1>
          <p>Você será direcionado ao ambiente seguro da TON para pagar via Pix ou cartão.</p>
          <ol className="flow-list">
            <li className="is-done"><span>1</span>Plano escolhido</li>
            <li className="is-done"><span>2</span>Conta confirmada</li>
            <li className="is-current"><span>3</span>Pagamento pela TON</li>
            <li><span>4</span>Liberação da anamnese</li>
          </ol>
        </div>
        <div>
          <div className="selected-plan">
            <span>Plano selecionado</span>
            <strong>{plan.name}</strong>
            <b>{plan.price}</b>
            <small>{plan.total}</small>
          </div>
          <div className="signup-card">
            <p>Pix à vista ou cartão de crédito em até 12x, com incidência de juros da operadora.</p>
            <PaymentButton plan={planId} />
            <small>O pagamento é processado pela TON. O site não armazena os dados do seu cartão.</small>
          </div>
        </div>
      </section>
    </main>
  );
}
