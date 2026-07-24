export const plans = {
  mensal: {
    id: "mensal",
    name: "Mensal",
    price: "R$ 250",
    total: "Pix ou cartão em até 12x*",
    paymentUrl:
      "https://payment-link-v3.ton.com.br/pl_vz8BGjkoZdn48Z7FWmF8R9yKqpeDQl6a",
  },
  bimestral: {
    id: "bimestral",
    name: "Bimestral",
    price: "R$ 450",
    total: "Pix ou cartão em até 12x*",
    paymentUrl:
      "https://payment-link-v3.ton.com.br/pl_EnKgmNWV0j6QeXKHkfXvB2OLG5JX7dMy",
  },
  trimestral: {
    id: "trimestral",
    name: "Trimestral",
    price: "R$ 600",
    total: "Pix ou cartão em até 12x*",
    paymentUrl:
      "https://payment-link-v3.ton.com.br/pl_4695AvNxVE7p3gdTWUxLG2qZWYLkJPnd",
  },
} as const;

export type PlanId = keyof typeof plans;

export function isPlanId(value: string): value is PlanId {
  return value in plans;
}
