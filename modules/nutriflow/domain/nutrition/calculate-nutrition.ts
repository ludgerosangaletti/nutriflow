export const NUTRIFLOW_MACRO_NUTRIENT_CODES = Object.freeze([
  "energy_kcal",
  "protein",
  "carbohydrate",
  "lipids",
  "fiber",
] as const);

export type NutriFlowMacroNutrientCode =
  (typeof NUTRIFLOW_MACRO_NUTRIENT_CODES)[number];

export type NutritionReference = Readonly<{
  referenceQuantityMilli: number;
  amountScaledByCode: Readonly<
    Partial<Record<NutriFlowMacroNutrientCode, number>>
  >;
}>;

export type CalculatedNutrition = Readonly<{
  quantityMilli: number;
  amountScaledByCode: Readonly<
    Record<NutriFlowMacroNutrientCode, number | null>
  >;
  completeForMacros: boolean;
}>;

function positiveSafeInteger(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`NUTRIFLOW_INVALID_NUTRITION:${field}`);
  }
}

/**
 * Scales a versioned per-reference nutrient snapshot to a mass quantity.
 * Missing nutrients remain null: unavailable data must never be interpreted as zero.
 */
export function calculateNutritionForMass(
  reference: NutritionReference,
  quantityMilli: number,
): CalculatedNutrition {
  positiveSafeInteger(reference.referenceQuantityMilli, "referenceQuantityMilli");
  positiveSafeInteger(quantityMilli, "quantityMilli");

  const values = Object.fromEntries(
    NUTRIFLOW_MACRO_NUTRIENT_CODES.map((code) => {
      const amount = reference.amountScaledByCode[code];
      if (amount === undefined) return [code, null] as const;
      if (!Number.isSafeInteger(amount) || amount < 0) {
        throw new Error(`NUTRIFLOW_INVALID_NUTRITION:${code}`);
      }
      return [
        code,
        Math.round((amount * quantityMilli) / reference.referenceQuantityMilli),
      ] as const;
    }),
  ) as Record<NutriFlowMacroNutrientCode, number | null>;

  return Object.freeze({
    quantityMilli,
    amountScaledByCode: Object.freeze(values),
    completeForMacros:
      values.energy_kcal !== null &&
      values.protein !== null &&
      values.carbohydrate !== null &&
      values.lipids !== null,
  });
}
