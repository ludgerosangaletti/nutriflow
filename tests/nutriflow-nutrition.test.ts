import assert from "node:assert/strict";
import test from "node:test";
import { calculateNutritionForMass } from "../modules/nutriflow/domain/nutrition/calculate-nutrition.ts";

test("nutrition calculation scales a versioned 100 g snapshot without losing missing values", () => {
  const result = calculateNutritionForMass({
    referenceQuantityMilli: 100000,
    amountScaledByCode: {
      energy_kcal: 128258,
      protein: 2521,
      carbohydrate: 28060,
      lipids: 227,
    },
  }, 150000);

  assert.equal(result.amountScaledByCode.energy_kcal, 192387);
  assert.equal(result.amountScaledByCode.protein, 3782);
  assert.equal(result.amountScaledByCode.fiber, null);
  assert.equal(result.completeForMacros, true);
  assert.equal(Object.isFrozen(result.amountScaledByCode), true);
});

test("nutrition calculation never interprets missing macro data as zero", () => {
  const result = calculateNutritionForMass({
    referenceQuantityMilli: 100000,
    amountScaledByCode: { protein: 1000 },
  }, 50000);

  assert.equal(result.amountScaledByCode.protein, 500);
  assert.equal(result.amountScaledByCode.energy_kcal, null);
  assert.equal(result.completeForMacros, false);
});

test("nutrition calculation rejects invalid clinical quantities", () => {
  assert.throws(() => calculateNutritionForMass({ referenceQuantityMilli: 100000, amountScaledByCode: {} }, 0), /NUTRIFLOW_INVALID_NUTRITION:quantityMilli/);
  assert.throws(() => calculateNutritionForMass({ referenceQuantityMilli: 100000, amountScaledByCode: { protein: -1 } }, 100000), /NUTRIFLOW_INVALID_NUTRITION:protein/);
});
