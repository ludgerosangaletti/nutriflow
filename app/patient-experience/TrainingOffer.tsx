import Link from "next/link";
import { IconTreino } from "./QuickAccessIcons";
import { TRAINING_OFFER_FEATURES } from "./training-offer";

export function TrainingOfferPage({ whatsappUrl }: Readonly<{ whatsappUrl: string }>) {
  return (
    <main className="nf-training-offer-page">
      <Link className="nf-training-offer-back nf-pressable" href="/area-cliente">← Voltar ao início</Link>
      <section className="nf-training-offer-hero">
        <i aria-hidden="true"><IconTreino size={24} /></i>
        <p className="nf-eyebrow">Acompanhamento de treino</p>
        <h1>Seu treino no mesmo lugar do seu plano.</h1>
        <p>Uma planilha montada para o seu objetivo, ajustada junto com a alimentação — e não em paralelo a ela.</p>
      </section>

      <section className="nf-training-offer-features" aria-labelledby="training-features-title">
        <p className="nf-eyebrow" id="training-features-title">O que está incluso</p>
        <ul>{TRAINING_OFFER_FEATURES.map((feature) => <li key={feature.title}><i aria-hidden="true">✓</i><span><strong>{feature.title}</strong><small>{feature.description}</small></span></li>)}</ul>
      </section>

      <section className="nf-training-offer-how">
        <p className="nf-eyebrow">Como funciona</p>
        <p>Você conversa com Ludgero pelo WhatsApp sobre seu objetivo e sua rotina. Depois que a planilha for montada e publicada, ela passa a aparecer aqui no aplicativo.</p>
      </section>

      <details className="nf-training-offer-faq">
        <summary>Preciso contratar para tirar dúvidas?</summary>
        <p>Não. A conversa é sem compromisso e serve também para entender se o acompanhamento de treino faz sentido para você.</p>
      </details>
      <details className="nf-training-offer-faq">
        <summary>O treino considera minha rotina?</summary>
        <p>Sim. Objetivo, experiência, disponibilidade e equipamentos entram na montagem da sua planilha individual.</p>
      </details>

      <a className="nf-training-offer-cta nf-pressable" href={whatsappUrl} target="_blank" rel="noopener noreferrer">
        Falar com Ludgero no WhatsApp
      </a>
      <p className="nf-training-offer-note">Atendimento humano, em horário comercial.<br />Sem compromisso — você decide se quer prosseguir.</p>
    </main>
  );
}
