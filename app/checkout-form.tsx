"use client";

import { FormEvent, useMemo, useState } from "react";

const plans = [
  {
    id: "mensal",
    name: "Mensal",
    duration: "1 mês de acompanhamento",
    installments: "1x de R$ 250",
    total: "R$ 250 no total",
    note: "Para começar com um ciclo mais curto",
    link: "https://payment-link-v3.ton.com.br/pl_5VonzbGe0jE21ov9SqupBJQK8Llvg7rN",
  },
  {
    id: "bimestral",
    name: "Bimestral",
    duration: "2 meses de acompanhamento",
    installments: "2x de R$ 200",
    total: "R$ 400 no total",
    note: "Mais tempo para aplicar e ajustar",
    link: "https://payment-link-v3.ton.com.br/pl_Rxzyl05wgJ7mrWdkcBFxVDaMjeoqkYnp",
  },
  {
    id: "trimestral",
    name: "Trimestral",
    duration: "3 meses de acompanhamento",
    installments: "3x de R$ 180",
    total: "R$ 540 no total",
    note: "Melhor equilíbrio entre tempo e investimento",
    badge: "Mais escolhido",
    link: "https://payment-link-v3.ton.com.br/pl_v67KDy2kAnbQNEOhzoHw5lxoBZVjgM9L",
  },
] as const;

export default function CheckoutForm() {
  const [selectedPlan, setSelectedPlan] = useState("trimestral");
  const [accepted, setAccepted] = useState(false);

  const currentPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlan) ?? plans[2],
    [selectedPlan],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accepted) return;
    window.location.assign(currentPlan.link);
  }

  return (
    <form className="checkout-form" onSubmit={handleSubmit}>
      <fieldset>
        <legend className="sr-only">Escolha o plano da consultoria online</legend>
        <div className="plans-grid">
          {plans.map((plan) => (
            <label
              className={`plan-option ${selectedPlan === plan.id ? "is-selected" : ""}`}
              key={plan.id}
            >
              <input
                type="radio"
                name="plano"
                value={plan.id}
                checked={selectedPlan === plan.id}
                onChange={() => setSelectedPlan(plan.id)}
              />
              <span className="plan-radio" aria-hidden="true" />
              <span className="plan-topline">
                <strong>{plan.name}</strong>
                {plan.badge ? <em>{plan.badge}</em> : null}
              </span>
              <span className="plan-duration">{plan.duration}</span>
              <span className="plan-price">{plan.installments}</span>
              <span className="plan-total">{plan.total}</span>
              <span className="plan-note">{plan.note}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="checkout-panel">
        <div className="checkout-summary" aria-live="polite">
          <span className="summary-label">Plano selecionado</span>
          <div>
            <strong>{currentPlan.name}</strong>
            <span>{currentPlan.installments}</span>
          </div>
          <small>{currentPlan.total}</small>
        </div>

        <label className="checkout-consent">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            required
          />
          <span>
            Entendi que serei redirecionado ao ambiente seguro da TON para
            preencher meus dados e concluir o pagamento.
          </span>
        </label>

        <button className="checkout-button" type="submit" disabled={!accepted}>
          Ir para o pagamento seguro
          <svg aria-hidden="true" viewBox="0 0 24 24" className="icon">
            <path d="M7 17 17 7M8 7h9v9" />
          </svg>
        </button>

        <div className="payment-trust">
          <span>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M12 3 5 6v5c0 4.8 2.8 8.3 7 10 4.2-1.7 7-5.2 7-10V6l-7-3Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            Pagamento processado pela TON
          </span>
          <span>Pix e cartão</span>
          <span>Você revisa antes de pagar</span>
        </div>
      </div>
    </form>
  );
}
