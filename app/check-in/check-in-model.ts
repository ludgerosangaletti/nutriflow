export type CheckInAnswer = string | number;

export type CheckInQuestion = Readonly<{
  id: string;
  type: "number" | "scale" | "choice" | "text";
  required?: boolean;
  question: string;
  help?: string;
  voice?: string;
  unit?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  decimal?: boolean;
  footnote?: string;
  low?: string;
  high?: string;
  labels?: readonly string[];
  options?: readonly Readonly<{ value: string; label: string }>[];
  maxLength?: number;
}>;

export const CHECKIN_QUESTIONS: readonly CheckInQuestion[] = Object.freeze([
  {
    id: "weightKg", type: "number", required: true,
    question: "Qual é o seu peso hoje?",
    help: "A pesagem semanal é o que permite acompanhar sua evolução com consistência.",
    unit: "kg", placeholder: "0,0", min: 20, max: 400, decimal: true,
    footnote: "Obrigatório · uma pesagem por semana",
  },
  {
    id: "trainingSessions", type: "number", required: true,
    question: "Quantos treinos você fez nesta semana?",
    help: "Considere os últimos sete dias.",
    unit: "treinos", placeholder: "0", min: 0, max: 21, decimal: false,
  },
  {
    id: "adherence", type: "scale", required: true,
    question: "Como foi sua aderência ao plano?", low: "Foi difícil", high: "Segui muito bem",
    labels: ["Foi difícil seguir", "Segui pouco", "Regular", "Segui bem", "Segui muito bem"],
  },
  {
    id: "hunger", type: "scale", required: true,
    question: "Como esteve sua fome?", low: "Muita fome", high: "Controlada",
    labels: ["Muita fome", "Fome frequente", "Regular", "Quase sempre controlada", "Controlada"],
  },
  {
    id: "satiety", type: "scale", required: true,
    question: "E sua saciedade depois das refeições?", low: "Baixa", high: "Ótima",
    labels: ["Baixa", "Pouca", "Regular", "Boa", "Ótima"],
  },
  {
    id: "sleep", type: "scale", required: true,
    question: "Como está seu sono?", low: "Ruim", high: "Ótimo",
    labels: ["Ruim", "Irregular", "Regular", "Bom", "Ótimo"],
  },
  {
    id: "energy", type: "scale", required: true,
    question: "E sua energia no dia a dia?", low: "Baixa", high: "Alta",
    labels: ["Baixa", "Oscilando", "Regular", "Boa", "Alta"],
  },
  {
    id: "bowelFunction", type: "choice", required: true,
    question: "Como está o funcionamento intestinal?",
    voice: "Sono, energia e intestino são o que me dizem se o plano está caindo bem no seu corpo — não só na balança.",
    options: [
      { value: "regular", label: "Regular, sem desconforto" },
      { value: "constipation", label: "Mais preso que o habitual" },
      { value: "diarrhea", label: "Mais solto que o habitual" },
      { value: "alternating", label: "Alternando entre preso e solto" },
      { value: "discomfort", label: "Dor, gases ou desconforto" },
    ],
  },
  {
    id: "mainDifficulty", type: "text", required: true,
    question: "Qual foi sua maior dificuldade nesta semana?",
    voice: "Pode escrever do seu jeito. É a partir daqui que eu ajusto seu plano para a próxima semana.",
    placeholder: "Ex.: comer fora nos fins de semana, fome à noite, rotina corrida…", maxLength: 800,
  },
  {
    id: "weeklyWin", type: "text", required: true,
    question: "E o que funcionou bem?", help: "Serve para eu manter o que já está dando certo.",
    placeholder: "Ex.: consegui manter o café da manhã todos os dias.", maxLength: 800,
  },
  {
    id: "notes", type: "text", required: false,
    question: "Quer me contar mais alguma coisa?",
    placeholder: "Opcional — qualquer coisa que você ache que eu deva saber.", maxLength: 1200,
  },
]);

export function validateNumberAnswer(question: CheckInQuestion, rawValue: string) {
  const raw = rawValue.replace(",", ".").trim();
  if (!raw) return question.id === "weightKg" ? "Informe seu peso para continuar." : "Informe um valor para continuar.";
  const value = Number(raw);
  if (!Number.isFinite(value) || value < (question.min ?? -Infinity) || value > (question.max ?? Infinity)) {
    return `Informe um valor entre ${question.min} e ${question.max} ${question.unit}.`;
  }
  if (!question.decimal && !Number.isInteger(value)) return "Informe um número inteiro.";
  return null;
}

export function buildCheckInFormData(answers: Readonly<Record<string, CheckInAnswer>>) {
  const body = new FormData();
  for (const question of CHECKIN_QUESTIONS) {
    const value = answers[question.id];
    if (value === undefined || value === null || String(value).trim() === "") continue;
    body.set(question.id, String(value));
  }
  return body;
}
