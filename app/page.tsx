import Image from "next/image";
import CheckoutForm from "./checkout-form";

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

const TargetIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="feature-icon">
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v2M22 12h-2M12 22v-2M2 12h2" />
  </svg>
);

const RouteIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="feature-icon">
    <circle cx="5" cy="18" r="2" />
    <circle cx="19" cy="6" r="2" />
    <path d="M7 18h3a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3h1" />
  </svg>
);

const RefreshIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="feature-icon">
    <path d="M20 7v5h-5M4 17v-5h5" />
    <path d="M6.1 9a7 7 0 0 1 11.4-2.5L20 9M4 15l2.5 2.5A7 7 0 0 0 17.9 15" />
  </svg>
);

const LeafIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="feature-icon">
    <path d="M20 4c-8 0-14 4-14 10a5 5 0 0 0 5 5c6 0 9-7 9-15Z" />
    <path d="M4 21c2-6 6-9 12-12" />
  </svg>
);

const benefits = [
  {
    number: "01",
    title: "Estratégia feita para você",
    text: "Nada de copiar dietas prontas. Sua rotina, preferências, histórico e objetivo definem o caminho.",
    icon: <TargetIcon />,
  },
  {
    number: "02",
    title: "Clareza para agir",
    text: "Você entende o que fazer, por que fazer e como adaptar o plano aos dias que não saem como o previsto.",
    icon: <RouteIcon />,
  },
  {
    number: "03",
    title: "Ajustes com contexto",
    text: "O acompanhamento transforma sinais do seu corpo e sua evolução em decisões práticas — sem achismo.",
    icon: <RefreshIcon />,
  },
  {
    number: "04",
    title: "Resultado sustentável",
    text: "O objetivo não é depender para sempre de um cardápio, mas construir consistência e autonomia.",
    icon: <LeafIcon />,
  },
];

const faqItems = [
  {
    question: "A consultoria é presencial ou online?",
    answer:
      "As duas modalidades estão disponíveis. O atendimento presencial acontece em Guarapuava e a consultoria online permite o mesmo raciocínio individualizado, com organização e acompanhamento à distância.",
  },
  {
    question: "Preciso seguir uma dieta rígida?",
    answer:
      "Não. A estratégia é estruturada para orientar suas escolhas sem ignorar preferências, rotina social e imprevistos. O plano precisa ser tecnicamente adequado e, ao mesmo tempo, possível de executar.",
  },
  {
    question: "O acompanhamento serve para emagrecimento e performance?",
    answer:
      "Sim. A condução é personalizada para objetivos clínicos, composição corporal, saúde, corrida, musculação e outras demandas esportivas. A avaliação inicial define as prioridades de cada caso.",
  },
  {
    question: "O que acontece na primeira consulta?",
    answer:
      "Conversamos sobre histórico, rotina, sintomas, alimentação, treino e objetivos. A partir dessa avaliação, são definidas prioridades e uma estratégia nutricional aplicável ao seu momento.",
  },
  {
    question: "Em quanto tempo começo a ver resultados?",
    answer:
      "A velocidade varia conforme objetivo, condição inicial, adesão e resposta individual. O compromisso é trabalhar com metas realistas, indicadores claros e ajustes consistentes — sem promessas irreais.",
  },
  {
    question: "Vou precisar usar suplementos?",
    answer:
      "Somente quando houver indicação e benefício real. Suplementos entram como complemento da estratégia, nunca como substitutos de uma alimentação bem estruturada.",
  },
  {
    question: "Como funciona o pagamento da consultoria online?",
    answer:
      "Você escolhe o plano na própria página e segue para o ambiente seguro da TON. O pagamento pode ser feito por Pix à vista ou cartão de crédito em até 12 vezes. No parcelamento, há incidência dos juros aplicados pela TON, apresentados antes da confirmação. O site não recebe nem armazena os dados do seu cartão.",
  },
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Ir para o início">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-copy">
            <strong>Ludgero Sangaletti</strong>
            <small>Nutrição clínica &amp; esportiva</small>
          </span>
        </a>

        <nav className="header-nav" aria-label="Navegação principal">
          <a href="#beneficios">Benefícios</a>
          <a href="#autoridade">Sobre</a>
          <a href="#comprar">Planos</a>
          <a href="#faq">Dúvidas</a>
          <a href="/area-cliente">Área do paciente</a>
        </nav>

        <a
          className="button button-small button-dark"
          href="#comprar"
        >
          Quero começar
          <ArrowUpRight />
        </a>
      </header>

      <section className="hero" id="inicio">
        <div className="hero-stripe hero-stripe-one" />
        <div className="hero-stripe hero-stripe-two" />
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
            <a
              className="button button-lime"
              href="#comprar"
            >
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

        <div className="hero-visual" aria-label="Team Ludgero Sangaletti">
          <div className="logo-stage">
            <Image
              src="/logo-ludgero.png"
              alt="Team Ludgero Sangaletti — Alimentação e Performance"
              width={500}
              height={500}
              priority
            />
          </div>
          <div className="floating-note floating-note-top">
            <span className="note-icon">01</span>
            <div>
              <small>Primeiro passo</small>
              <strong>Entender sua realidade</strong>
            </div>
          </div>
          <div className="floating-note">
            <span className="note-icon">↗</span>
            <div>
              <small>Estratégia individual</small>
              <strong>Alimentação + performance</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="trust-bar" aria-label="Credenciais e atendimento">
        <span>CRN-8 11719</span>
        <i />
        <span>Nutrição clínica</span>
        <i />
        <span>Nutrição esportiva</span>
        <i />
        <span>Presencial em Guarapuava + online</span>
      </section>

      <section className="benefits-section" id="beneficios">
        <div className="section-heading split-heading">
          <div>
            <p className="section-kicker">O que muda com acompanhamento</p>
            <h2>Menos regras soltas.<br />Mais direção.</h2>
          </div>
          <p>
            A consultoria organiza o que realmente importa para que suas
            decisões sejam mais simples, intencionais e consistentes.
          </p>
        </div>

        <div className="benefits-grid">
          {benefits.map((benefit) => (
            <article className="benefit-card" key={benefit.number}>
              <div className="benefit-card-top">
                <span>{benefit.number}</span>
                {benefit.icon}
              </div>
              <h3>{benefit.title}</h3>
              <p>{benefit.text}</p>
            </article>
          ))}
        </div>

        <div className="method-strip">
          <div className="method-intro">
            <span className="method-badge">Como funciona</span>
            <h3>Um processo simples, sem ser superficial.</h3>
          </div>
          <ol>
            <li>
              <span>1</span>
              <div>
                <strong>Avaliação completa</strong>
                <p>Entendemos o ponto de partida e definimos prioridades.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Estratégia individual</strong>
                <p>Você recebe um plano pensado para sua rotina real.</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Acompanhamento e ajustes</strong>
                <p>A evolução orienta as próximas decisões do processo.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="authority-section" id="autoridade">
        <div className="authority-copy">
          <p className="section-kicker section-kicker-light">Experiência que orienta</p>
          <h2>Ciência no raciocínio. Escuta na condução.</h2>
          <p className="authority-lead">
            Sou Ludgero Sangaletti, nutricionista clínico e esportivo. Meu
            trabalho une conhecimento técnico, leitura individual e
            acompanhamento próximo para criar estratégias que façam sentido
            dentro e fora do consultório.
          </p>

          <ul className="credential-list">
            <li><Check /> Especialização em Nutrição Clínica</li>
            <li><Check /> Especialização em Nutrição no Esporte e Atividade Física</li>
            <li><Check /> Experiência clínica, esportiva e multiprofissional</li>
            <li><Check /> Atuação em educação em saúde e palestras</li>
          </ul>

          <a
            className="button button-outline"
            href="#comprar"
          >
            Escolher meu plano
            <ArrowUpRight />
          </a>
        </div>

        <div className="authority-proof">
          <div className="authority-portrait">
            <Image
              src="/ludgero-consultorio.jpeg"
              alt="Ludgero Sangaletti em seu consultório"
              fill
              sizes="(max-width: 900px) 90vw, 42vw"
            />
            <div className="portrait-caption">
              <span>Atendimento próximo</span>
              <strong>Estratégia feita por quem escuta você.</strong>
            </div>
            <div className="rating-card">
              <span className="rating-number">96–100%</span>
              <p>de avaliações classificadas como <strong>“Ótimo”</strong></p>
              <small>Avaliações internas recentes de atendimento</small>
            </div>
          </div>
          <div className="proof-grid">
            <div>
              <strong>Clínica</strong>
              <span>Saúde, sintomas e composição corporal</span>
            </div>
            <div>
              <strong>Esporte</strong>
              <span>Corrida, musculação e performance</span>
            </div>
            <div>
              <strong>Humano</strong>
              <span>Estratégia adaptada à rotina e preferências</span>
            </div>
            <div className="proof-accent">
              <strong>Presencial + online</strong>
              <span>O mesmo cuidado, onde você estiver</span>
            </div>
          </div>
        </div>
      </section>

      <section className="checkout-section" id="comprar">
        <div className="checkout-heading">
          <div>
            <p className="section-kicker">Consultoria online</p>
            <h2>Escolha o tempo que seu resultado precisa.</h2>
          </div>
          <p>
            Selecione o plano que melhor combina com o seu momento. Primeiro
            faremos um cadastro breve; depois você conclui o pagamento por Pix
            ou cartão em até 12 vezes no ambiente seguro da TON.
          </p>
        </div>

        <CheckoutForm />
      </section>

      <section className="faq-section" id="faq">
        <div className="faq-intro">
          <p className="section-kicker">Perguntas frequentes</p>
          <h2>O que você precisa saber antes de começar.</h2>
          <p>
            Se sua dúvida não estiver aqui, a primeira conversa serve justamente
            para entender se a consultoria faz sentido para o seu momento.
          </p>
        </div>

        <div className="faq-list">
          {faqItems.map((item, index) => (
            <details key={item.question} open={index === 0}>
              <summary>
                <span>{item.question}</span>
                <i aria-hidden="true">+</i>
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="final-cta" id="contato">
        <div className="cta-orbit cta-orbit-one" />
        <div className="cta-orbit cta-orbit-two" />
        <p className="section-kicker section-kicker-light">Seu próximo passo</p>
        <h2>Você não precisa de mais uma tentativa. Precisa de uma estratégia.</h2>
        <p>
          Conte brevemente seu objetivo e descubra como a consultoria pode
          transformar informação em um plano possível para você.
        </p>
        <div className="cta-actions">
          <a
            className="button button-lime"
            href="#comprar"
          >
            Escolher meu plano
            <ArrowUpRight />
          </a>
          <a href="#faq" className="text-link">
            Rever dúvidas frequentes
            <span aria-hidden="true">↑</span>
          </a>
        </div>
        <small className="cta-note">Atendimento presencial em Guarapuava e consultoria online.</small>
      </section>

      <footer>
        <a className="brand" href="#inicio" aria-label="Voltar ao início">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-copy">
            <strong>Ludgero Sangaletti</strong>
            <small>Nutrição clínica &amp; esportiva</small>
          </span>
        </a>
        <p>CRN-8 11719 · Atendimento nutricional individualizado</p>
        <a href="#inicio" className="footer-top">Voltar ao topo ↑</a>
      </footer>
    </main>
  );
}
