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
        <header className="legal-document-heading">
          <p className="section-kicker">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="legal-intro">{intro}</p>
          <div className="legal-meta">
            <span>Documento público</span>
            <span>Última atualização: 28 de julho de 2026</span>
          </div>
        </header>
        <nav className="legal-document-nav" aria-label="Documentos relacionados">
          <a href="/politica-de-privacidade">Política de Privacidade</a>
          <a href="/termos-de-uso">Termos de Uso</a>
          <a href="/exclusao-de-dados">Exclusão de Dados</a>
        </nav>
        <div className="legal-content">{children}</div>
        <aside className="legal-contact">
          <div>
            <span>Canal de privacidade</span>
            <strong>Precisa exercer um direito ou esclarecer uma dúvida?</strong>
            <p>O atendimento é gratuito e pode exigir validação de identidade para proteger seus dados.</p>
          </div>
          <a href="https://wa.me/5542999846280">Falar pelo WhatsApp</a>
        </aside>
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
