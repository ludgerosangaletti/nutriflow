"use client";

import { useMemo, useState } from "react";

const plans = [
  {
    id: "mensal",
    name: "Mensal",
    duration: "1 mês de acompanhamento",
    installments: "R$ 250",
    total: "Pix ou cartão em até 12x*",
    note: "Para começar com um ciclo mais curto",
    badge: undefined,
  },
  {
    id: "bimestral",
    name: "Bimestral",
    duration: "2 meses de acompanhamento",
    installments: "R$ 450",
    total: "Pix ou cartão em até 12x*",
    note: "Mais tempo para aplicar e ajustar",
    badge: undefined,
  },
  {
    id: "trimestral",
    name: "Trimestral",
    duration: "3 meses de acompanhamento",
    installments: "R$ 600",
    total: "Pix ou cartão em até 12x*",
    note: "Melhor equilíbrio entre tempo e investimento",
    badge: "Mais escolhido",
  },
] as const;

export default function CheckoutForm() {
  const [selectedPlan, setSelectedPlan] = useState("trimestral");
  const currentPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlan) ?? plans[2],
    [selectedPlan],
  );

  return (
    <div className="checkout-form">
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

        <div className="checkout-consent flow-notice">
          <span className="flow-number">1</span>
          <span>
            Primeiro você fará um cadastro breve. Depois será direcionado ao
            pagamento seguro da TON.
          </span>
        </div>

        <a className="checkout-button" href={`/cadastro?plano=${currentPlan.id}`}>
          Continuar para o cadastro
          <svg aria-hidden="true" viewBox="0 0 24 24" className="icon">
            <path d="M7 17 17 7M8 7h9v9" />
          </svg>
        </a>

        <div className="payment-trust">
          <span>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M12 3 5 6v5c0 4.8 2.8 8.3 7 10 4.2-1.7 7-5.2 7-10V6l-7-3Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            Pagamento processado pela TON
          </span>
          <span>Pix à vista</span>
          <span>Cartão em até 12x*</span>
        </div>
        <small className="payment-terms">
          *O parcelamento no cartão está sujeito aos juros aplicados pela TON,
          informados antes da confirmação do pagamento.
        </small>
      </div>
    </div>
  );
}
