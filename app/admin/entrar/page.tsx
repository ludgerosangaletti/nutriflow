import Link from "next/link";
import AdminLoginForm from "./admin-login-form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erro?: string }>;
}) {
  const params = await searchParams;
  const next =
    params.next?.startsWith("/admin/") && !params.next.startsWith("//")
      ? params.next
      : "/admin/clientes";

  return (
    <main className="portal-shell auth-page">
      <Link className="portal-brand" href="/">Ludgero Sangaletti</Link>
      <section className="auth-layout">
        <div className="portal-copy">
          <p className="section-kicker">Acesso administrativo</p>
          <h1>Gestão da consultoria.</h1>
          <p>
            Entre com sua conta administrativa para acompanhar pacientes,
            pagamentos e respostas da anamnese.
          </p>
        </div>
        <AdminLoginForm
          next={next}
          confirmationError={params.erro === "confirmacao"}
        />
      </section>
    </main>
  );
}
