import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import Link from "next/link";
import { getDb } from "../../db";
import { clients } from "../../db/schema";
import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";
import { isPlanId, plans } from "../plans";

export const dynamic = "force-dynamic";

export default async function ClientArea() {
  const user = await requireChatGPTUser("/area-cliente");
  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.email, user.email))
    .limit(1);

  return (
    <main className="portal-shell">
      <header className="portal-header">
        <Link className="portal-brand" href="/">LS · Ludgero Sangaletti</Link>
        <a href={chatGPTSignOutPath("/")}>Sair</a>
      </header>
      {!client ? (
        <section className="empty-state">
          <p className="section-kicker">Área do cliente</p>
          <h1>Seu cadastro ainda não foi iniciado.</h1>
          <p>Escolha um plano para começar a consultoria.</p>
          <Link className="button button-dark" href="/#comprar">Conhecer os planos</Link>
        </section>
      ) : (
        <section className="dashboard">
          <div className="dashboard-heading">
            <div>
              <p className="section-kicker">Área do cliente</p>
              <h1>Olá, {client.name.split(" ")[0]}.</h1>
              <p>Acompanhe aqui as próximas etapas da sua consultoria.</p>
            </div>
            <div className={`status-card status-${client.paymentStatus}`}>
              <span>Status do pagamento</span>
              <strong>
                {client.paymentStatus === "approved"
                  ? "Pagamento confirmado"
                  : "Aguardando confirmação"}
              </strong>
            </div>
          </div>
          <div className="dashboard-grid">
            <article className="dashboard-card">
              <span>Plano contratado</span>
              <strong>
                {isPlanId(client.plan) ? plans[client.plan].name : client.plan}
              </strong>
              <p>
                Após pagar, a confirmação poderá levar algum tempo. Seu acesso
                à anamnese será liberado assim que o pagamento for conferido.
              </p>
            </article>
            <article className="dashboard-card dashboard-card-accent">
              <span>Próxima etapa</span>
              {client.paymentStatus === "approved" ? (
                <>
                  <strong>Preencher a anamnese</strong>
                  <p>
                    Responda com atenção. Suas informações serão usadas para a
                    elaboração da estratégia alimentar.
                  </p>
                  {env.GOOGLE_FORM_URL ? (
                    <a
                      className="button button-dark"
                      href={env.GOOGLE_FORM_URL}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir formulário de anamnese
                    </a>
                  ) : (
                    <button className="button button-dark" disabled>
                      Formulário em configuração
                    </button>
                  )}
                </>
              ) : (
                <>
                  <strong>Confirmação do pagamento</strong>
                  <p>
                    Se você já concluiu a compra na TON, aguarde a validação para
                    acessar o questionário da consultoria.
                  </p>
                </>
              )}
            </article>
          </div>
        </section>
      )}
    </main>
  );
}
