import Link from "next/link";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erro?: string }>;
}) {
  const params = await searchParams;
  const next =
    params.next?.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/area-cliente";

  return (
    <main className="portal-shell auth-page">
      <Link className="portal-brand" href="/">Ludgero Sangaletti</Link>
      <section className="auth-layout">
        <div className="portal-copy">
          <p className="section-kicker">Área do paciente</p>
          <h1>Entre na sua conta.</h1>
          <p>Acesse seu pagamento, acompanhe a liberação e preencha sua anamnese.</p>
        </div>
        <LoginForm next={next} confirmationError={params.erro === "confirmacao"} />
      </section>
    </main>
  );
}
