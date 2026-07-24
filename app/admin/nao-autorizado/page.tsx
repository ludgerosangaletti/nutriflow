import Link from "next/link";

export default function UnauthorizedAdminPage() {
  return (
    <main className="portal-shell">
      <section className="empty-state">
        <p className="section-kicker">Acesso administrativo</p>
        <h1>Esta conta não possui permissão.</h1>
        <p>Entre com o e-mail administrativo autorizado para acessar os dados dos pacientes.</p>
        <form action="/auth/sair" method="post">
          <button className="button button-dark" type="submit">Sair desta conta</button>
        </form>
        <Link className="inline-auth-link" href="/">Voltar ao site</Link>
      </section>
    </main>
  );
}
