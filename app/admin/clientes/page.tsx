import { desc } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "../../../db";
import { clients } from "../../../db/schema";
import { requireAdmin } from "../../supabase/server";
import ApprovalButton from "./approval-button";

export const dynamic = "force-dynamic";

export default async function AdminClients() {
  await requireAdmin("/admin/clientes");

  const rows = await getDb()
    .select()
    .from(clients)
    .orderBy(desc(clients.createdAt));

  return (
    <main className="portal-shell">
      <header className="portal-header">
        <Link className="portal-brand" href="/">Gestão da consultoria</Link>
        <form action="/auth/sair" method="post">
          <button className="auth-signout" type="submit">Sair</button>
        </form>
      </header>
      <section className="admin-panel">
        <p className="section-kicker">Gestão de clientes</p>
        <h1>Pagamentos e acessos</h1>
        <p>
          Confirme somente após localizar o pagamento correspondente na TON.
        </p>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>WhatsApp</th>
                <th>Plano</th>
                <th>Status</th>
                <th>Anamnese</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((client) => (
                <tr key={client.id}>
                  <td><strong>{client.name}</strong><small>{client.email}</small></td>
                  <td>{client.whatsapp}</td>
                  <td>{client.plan}</td>
                  <td>
                    {client.paymentStatus === "approved"
                      ? "Liberado"
                      : "Pendente"}
                  </td>
                  <td>
                    {client.formStatus === "submitted" ? (
                      <Link
                        className="admin-response-link"
                        href={`/admin/clientes/${encodeURIComponent(client.email)}`}
                      >
                        Ver respostas
                      </Link>
                    ) : client.formStatus === "draft" ? "Em preenchimento" : "Não iniciada"}
                  </td>
                  <td>
                    <ApprovalButton
                      email={client.email}
                      approved={client.paymentStatus === "approved"}
                    />
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr><td colSpan={6}>Nenhum cadastro recebido até o momento.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
