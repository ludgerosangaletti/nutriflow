import assert from "node:assert/strict";
import test from "node:test";
import { calculateEnergyExpenditure } from "../modules/nutriflow/domain/energy/calculate-energy-expenditure.ts";

const base = {
  sex: "male" as const,
  ageYears: 30,
  weightKg: 80,
  heightCm: 180,
  activityLevel: "moderate" as const,
  stressFactor: 1,
};

test("calcula Mifflin–St Jeor com fator de atividade", () => {
  const result = calculateEnergyExpenditure({ ...base, protocol: "mifflin_st_jeor" });
  assert.equal(result.basalKcal, 1780);
  assert.equal(result.totalKcal, 2759);
  assert.equal(result.calculationVersion, "1.0.0");
});

test("calcula Harris–Benedict revisada", () => {
  const result = calculateEnergyExpenditure({ ...base, protocol: "harris_benedict_revised", sex: "female" });
  assert.equal(result.basalKcal, 1615);
  assert.equal(result.totalKcal, 2503);
});

test("calcula IOM EER sem reportar taxa basal incompatível", () => {
  const result = calculateEnergyExpenditure({ ...base, protocol: "iom_eer" });
  assert.equal(result.basalKcal, null);
  assert.equal(result.activityFactor, null);
  assert.ok(result.totalKcal > 2000);
});

test("Katch–McArdle exige massa livre de gordura", () => {
  assert.throws(() => calculateEnergyExpenditure({ ...base, protocol: "katch_mcardle" }), /massa livre/i);
  const result = calculateEnergyExpenditure({ ...base, protocol: "katch_mcardle", leanMassKg: 65 });
  assert.equal(result.basalKcal, 1774);
});
