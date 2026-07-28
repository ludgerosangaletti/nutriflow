import type { ReactNode } from "react";

type LegalLayoutProps = {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
};

export default function LegalLayout({
  eyebrow,
  title,
  intro,
  children,
}: LegalLayoutProps) {
  return (
    <main className="legal-page">
      <header className="legal-header">
        <a className="brand" href="/" aria-label="Ir para a página inicial">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-copy">
            <strong>Ludgero Sangaletti</strong>
            <small>Nutrição clínica &amp; esportiva</small>
          </span>
        </a>
        <a className="legal-back" href="/">Voltar ao site</a>
      </header>

      <article className="legal-document">
        <p className="section-kicker">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="legal-intro">{intro}</p>
        <p className="legal-updated">Última atualização: 27 de julho de 2026.</p>
        <div className="legal-content">{children}</div>
      </article>

      <footer className="legal-footer">
        <p>Ludgero Sangaletti · CRN-8 11719</p>
        <nav aria-label="Documentos legais">
          <a href="/politica-de-privacidade">Privacidade</a>
          <a href="/termos-de-uso">Termos de uso</a>
          <a href="/exclusao-de-dados">Exclusão de dados</a>
        </nav>
      </footer>
    </main>
  );
}
