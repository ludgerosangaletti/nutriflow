import type { ReactNode } from "react";
import Link from "next/link";

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
        <Link className="brand" href="/" aria-label="Ir para a página inicial">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-copy">
            <strong>Ludgero Sangaletti</strong>
            <small>Nutrição clínica &amp; esportiva</small>
          </span>
        </Link>
        <Link className="legal-back" href="/">Voltar ao site</Link>
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
          <Link href="/politica-de-privacidade">Política de Privacidade</Link>
          <Link href="/termos-de-uso">Termos de Uso</Link>
          <Link href="/exclusao-de-dados">Exclusão de Dados</Link>
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
          <Link href="/politica-de-privacidade">Privacidade</Link>
          <Link href="/termos-de-uso">Termos de uso</Link>
          <Link href="/exclusao-de-dados">Exclusão de dados</Link>
        </nav>
      </footer>
    </main>
  );
}
