import Link from "next/link";

export const dynamic = "force-dynamic";

function validType(value?: string) {
  return value === "invite" || value === "magiclink";
}

export default async function ActivateAccountPage({
  searchParams,
}: {
  searchParams: Promise<{
    token_hash?: string;
    type?: string;
  }>;
}) {
  const params = await searchParams;
  const valid = Boolean(params.token_hash) && validType(params.type);

  return (
    <main className="portal-shell activation-page">
      <header className="portal-header">
        <Link className="portal-brand" href="/">
          Ludgero Sangaletti
        </Link>
        <span>Atendimento presencial</span>
      </header>
      <section className="activation-card">
        <p className="section-kicker">Área do paciente</p>
        <h1>{valid ? "Confirme seu primeiro acesso." : "Este convite não é válido."}</h1>
        {valid ? (
          <>
            <p>
              Seu e-mail foi convidado para acessar o acompanhamento presencial.
              Confirme abaixo para seguir ao cadastro dos seus dados e da sua senha.
            </p>
            <form action="/auth/confirmar-convite" method="post">
              <input
                name="token_hash"
                type="hidden"
                value={params.token_hash}
              />
              <input name="type" type="hidden" value={params.type} />
              <button type="submit">Confirmar e criar minha conta</button>
            </form>
            <small>
              A confirmação acontece somente ao pressionar o botão. Isso protege
              seu convite contra verificações automáticas do e-mail.
            </small>
          </>
        ) : (
          <>
            <p>
              Solicite um novo convite ao profissional e utilize somente a mensagem
              mais recente recebida.
            </p>
            <Link className="activation-secondary-link" href="/entrar">
              Voltar para o acesso
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
