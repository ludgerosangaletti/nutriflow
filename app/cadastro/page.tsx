import Link from "next/link";
import { requireChatGPTUser } from "../chatgpt-auth";
import { isPlanId, plans } from "../plans";
import CadastroForm from "./cadastro-form";

export const dynamic = "force-dynamic";

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ plano?: string }>;
}) {
  const params = await searchParams;
  const selected = params.plano ?? "trimestral";
  const planId = isPlanId(selected) ? selected : "trimestral";
  const user = await requireChatGPTUser(`/cadastro?plano=${planId}`);
  const plan = plans[planId];

  return (
    <main className="portal-shell">
      <Link className="portal-brand" href="/">Ludgero Sangaletti</Link>
      <section className="portal-grid">
        <div className="portal-copy">
          <p className="section-kicker">Etapa 2 de 4</p>
          <h1>Cadastre-se antes de pagar.</h1>
          <p>
            Assim conseguimos identificar sua compra, liberar seu acesso e
            manter todas as etapas da consultoria organizadas.
          </p>
          <ol className="flow-list">
            <li className="is-done"><span>1</span>Plano escolhido</li>
            <li className="is-current"><span>2</span>Cadastro breve</li>
            <li><span>3</span>Pagamento pela TON</li>
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
          <CadastroForm
            plan={planId}
            defaultName={user.fullName ?? ""}
            email={user.email}
          />
        </div>
      </section>
    </main>
  );
}
