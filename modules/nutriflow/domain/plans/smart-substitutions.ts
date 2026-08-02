export type NutrientVector = Readonly<{ energyKcal: number; protein: number; carbohydrate: number; lipids: number }>;
export type SubstitutionCandidate = Readonly<{ publicId: string; displayName: string; referenceQuantityMilli: number; nutrients: NutrientVector }>;
export function rankNutritionallyEquivalentSubstitutions(original: NutrientVector, candidates: readonly SubstitutionCandidate[], limit = 5) {
  const distance = (candidate: SubstitutionCandidate) => {
    const relative = (a: number, b: number) => Math.abs(a - b) / Math.max(1, Math.abs(a));
    return relative(original.energyKcal, candidate.nutrients.energyKcal) * .4 + relative(original.protein, candidate.nutrients.protein) * .25 + relative(original.carbohydrate, candidate.nutrients.carbohydrate) * .2 + relative(original.lipids, candidate.nutrients.lipids) * .15;
  };
  return Object.freeze([...candidates].sort((a, b) => distance(a) - distance(b)).slice(0, Math.max(3, Math.min(5, limit))).map((candidate) => Object.freeze({ ...candidate, equivalenceScore: Number((1 - Math.min(1, distance(candidate))).toFixed(4)) })));
}
