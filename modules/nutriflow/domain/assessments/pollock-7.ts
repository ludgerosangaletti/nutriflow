export type Pollock7Input = {
  sex: "male" | "female";
  age: number;
  weightKg: number;
  heightCm: number;
  skinfoldsMm: { triceps: number; subscapular: number; suprailiac: number; abdominal: number; midaxillary: number; pectoral: number; thigh: number };
  circumferencesCm: { arm: number; waist: number; abdomen: number; hip: number; thigh: number };
  measurementSide: "left" | "right";
};

export function calculatePollock7(input: Pollock7Input) {
  const values = Object.values(input.skinfoldsMm);
  if (input.age < 18 || input.age > 100 || input.weightKg <= 0 || input.heightCm <= 0 || values.some((v) => v <= 0)) throw new Error("Dados antropométricos inválidos.");
  const sum = values.reduce((a, b) => a + b, 0);
  const density = input.sex === "male"
    ? 1.112 - 0.00043499 * sum + 0.00000055 * sum ** 2 - 0.00028826 * input.age
    : 1.097 - 0.00046971 * sum + 0.00000056 * sum ** 2 - 0.00012828 * input.age;
  const bodyFatPct = Math.max(0, Math.min(75, 495 / density - 450));
  const bmi = input.weightKg / (input.heightCm / 100) ** 2;
  const fatMassKg = input.weightKg * bodyFatPct / 100;
  const leanMassKg = input.weightKg - fatMassKg;
  return { sumSkinfoldsMm: sum, density, bodyFatPct, bmi, fatMassKg, leanMassKg };
}

export function bmiClassification(bmi: number) {
  if (bmi < 18.5) return "Abaixo do peso";
  if (bmi < 25) return "Faixa adequada";
  if (bmi < 30) return "Sobrepeso";
  return "Obesidade";
}
