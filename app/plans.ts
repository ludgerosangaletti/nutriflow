export const plans = {
  mensal: {
    id: "mensal",
    name: "Mensal",
    price: "1x de R$ 250",
    total: "R$ 250 no total",
    paymentUrl:
      "https://payment-link-v3.ton.com.br/pl_5VonzbGe0jE21ov9SqupBJQK8Llvg7rN",
  },
  bimestral: {
    id: "bimestral",
    name: "Bimestral",
    price: "2x de R$ 200",
    total: "R$ 400 no total",
    paymentUrl:
      "https://payment-link-v3.ton.com.br/pl_Rxzyl05wgJ7mrWdkcBFxVDaMjeoqkYnp",
  },
  trimestral: {
    id: "trimestral",
    name: "Trimestral",
    price: "3x de R$ 180",
    total: "R$ 540 no total",
    paymentUrl:
      "https://payment-link-v3.ton.com.br/pl_v67KDy2kAnbQNEOhzoHw5lxoBZVjgM9L",
  },
} as const;

export type PlanId = keyof typeof plans;

export function isPlanId(value: string): value is PlanId {
  return value in plans;
}
