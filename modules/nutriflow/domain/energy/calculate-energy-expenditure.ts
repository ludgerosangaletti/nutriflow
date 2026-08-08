export type EnergyProtocol = "mifflin_st_jeor" | "harris_benedict_revised" | "schofield_who" | "iom_eer" | "katch_mcardle";
export type EnergyInput = Readonly<{ protocol: EnergyProtocol; sex: "male" | "female"; ageYears: number; weightKg: number; heightCm: number; activityLevel: "sedentary" | "light" | "moderate" | "high" | "very_high"; leanMassKg?: number | null; stressFactor: number }>;
const factors = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725, very_high: 1.9 } as const;
const iomPa = { male: { sedentary: 1, light: 1.11, moderate: 1.25, high: 1.48, very_high: 1.48 }, female: { sedentary: 1, light: 1.12, moderate: 1.27, high: 1.45, very_high: 1.45 } } as const;
const protocols = new Set<EnergyProtocol>(["mifflin_st_jeor", "harris_benedict_revised", "schofield_who", "iom_eer", "katch_mcardle"]);
export function calculateEnergyExpenditure(input: EnergyInput) {
  if (!protocols.has(input.protocol)) throw new Error("Selecione um protocolo de cálculo válido.");
  if (input.ageYears < 18 || input.ageYears > 100 || input.weightKg <= 20 || input.weightKg > 400 || input.heightCm < 100 || input.heightCm > 250 || input.stressFactor < .8 || input.stressFactor > 1.5) throw new Error("Revise os dados utilizados no cálculo.");
  const h = input.heightCm, w = input.weightKg, a = input.ageYears;
  let bmr: number;
  switch (input.protocol) {
    case "mifflin_st_jeor": bmr = input.sex === "male" ? 10*w + 6.25*h - 5*a + 5 : 10*w + 6.25*h - 5*a - 161; break;
    case "harris_benedict_revised": bmr = input.sex === "male" ? 88.362 + 13.397*w + 4.799*h - 5.677*a : 447.593 + 9.247*w + 3.098*h - 4.33*a; break;
    case "schofield_who": { const mj = input.sex === "male" ? (a < 30 ? .063*w + 2.896 : a < 60 ? .048*w + 3.653 : .0499*w + 2.459) : (a < 30 ? .062*w + 2.036 : a < 60 ? .034*w + 3.538 : .0386*w + 2.755); bmr = mj * 239.0057; break; }
    case "iom_eer": { const pa = iomPa[input.sex][input.activityLevel]; const eer = input.sex === "male" ? 662 - 9.53*a + pa*(15.91*w + 539.6*(h/100)) : 354 - 6.91*a + pa*(9.36*w + 726*(h/100)); return Object.freeze({ basalKcal: null, activityFactor: null, stressFactor: input.stressFactor, totalKcal: Math.round(eer * input.stressFactor), calculationVersion: "1.0.0" }); }
    case "katch_mcardle": if (!input.leanMassKg || input.leanMassKg <= 0) throw new Error("Katch-McArdle exige massa livre de gordura."); bmr = 370 + 21.6 * input.leanMassKg; break;
  }
  return Object.freeze({ basalKcal: Math.round(bmr!), activityFactor: factors[input.activityLevel], stressFactor: input.stressFactor, totalKcal: Math.round(bmr! * factors[input.activityLevel] * input.stressFactor), calculationVersion: "1.0.0" });
}

export const energyProtocolLabel: Record<EnergyProtocol, string> = { mifflin_st_jeor: "Mifflin–St Jeor", harris_benedict_revised: "Harris–Benedict revisada", schofield_who: "Schofield (OMS/FAO)", iom_eer: "IOM – EER", katch_mcardle: "Katch–McArdle" };
