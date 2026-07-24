const ArrowUpRight = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="icon">
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);

const Check = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="icon icon-check">
    <path d="m5 12 4 4L19 6" />
  </svg>
);

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Ir para o início">
          <span className="brand-mark">LS</span>
          <span className="brand-copy">
            <strong>Ludgero Sangaletti</strong>
            <small>Nutrição clínica &amp; esportiva</small>
          </span>
        </a>

        <nav className="header-nav" aria-label="Navegação principal">
          <a href="#beneficios">Benefícios</a>
          <a href="#autoridade">Sobre</a>
          <a href="#faq">Dúvidas</a>
        </nav>

        <a className="button button-small button-dark" href="#contato">
          Quero começar
          <ArrowUpRight />
        </a>
      </header>

      <section className="hero" id="inicio">
        <div className="hero-orbit hero-orbit-one" />
        <div className="hero-orbit hero-orbit-two" />

        <div className="hero-copy">
          <p className="eyebrow">
            <span />
            Consultoria nutricional personalizada
          </p>
          <h1>
            Sua alimentação deve acompanhar a <em>vida que você quer viver.</em>
          </h1>
          <p className="hero-lead">
            Estratégia nutricional baseada em evidências, construída para a sua
            rotina e ajustada com você — para transformar intenção em resultado
            consistente.
          </p>

          <div className="hero-actions">
            <a className="button button-lime" href="#contato">
              Quero conhecer a consultoria
              <ArrowUpRight />
            </a>
            <a className="text-link" href="#beneficios">
              Ver como funciona
              <span aria-hidden="true">↓</span>
            </a>
          </div>

          <div className="hero-proof" aria-label="Áreas de atendimento">
            <span><Check /> Emagrecimento</span>
            <span><Check /> Saúde e bem-estar</span>
            <span><Check /> Performance esportiva</span>
          </div>
        </div>

        <div className="hero-visual" aria-label="Acompanhamento que evolui com você">
          <div className="progress-card">
            <div className="progress-card-top">
              <span className="mini-label">Sua evolução</span>
              <span className="status-pill">Em acompanhamento</span>
            </div>
            <h2>Um plano que não fica parado.</h2>
            <p>
              Cada etapa considera sua resposta, seus desafios e o que cabe de
              verdade na sua semana.
            </p>

            <div className="progress-path">
              <div className="progress-line" />
              <div className="progress-step is-done">
                <span>01</span>
                <div>
                  <strong>Entender</strong>
                  <small>Contexto, rotina e objetivo</small>
                </div>
              </div>
              <div className="progress-step is-current">
                <span>02</span>
                <div>
                  <strong>Estruturar</strong>
                  <small>Estratégia sob medida</small>
                </div>
              </div>
              <div className="progress-step">
                <span>03</span>
                <div>
                  <strong>Evoluir</strong>
                  <small>Ajustes com acompanhamento</small>
                </div>
              </div>
            </div>
          </div>

          <div className="floating-note">
            <span className="note-icon">↗</span>
            <div>
              <small>Foco do processo</small>
              <strong>Consistência sustentável</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="trust-bar" aria-label="Credenciais e atendimento">
        <span>CRN-8</span>
        <i />
        <span>Nutrição clínica</span>
        <i />
        <span>Nutrição esportiva</span>
        <i />
        <span>Presencial em Guarapuava + online</span>
      </section>

      <section className="mini-contact" id="contato">
        <p>Pronto para construir um plano que funciona na vida real?</p>
        <a href="#inicio">Falar sobre meu objetivo <ArrowUpRight /></a>
      </section>
    </main>
  );
}
