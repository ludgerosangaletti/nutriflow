import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculatePollock7 } from "../modules/nutriflow/domain/assessments/pollock-7.ts";

const input = {
  sex: "male" as const,
  age: 32,
  weightKg: 83,
  heightCm: 172,
  measurementSide: "right" as const,
  skinfoldsMm: { triceps: 10, subscapular: 15, suprailiac: 13, abdominal: 18, midaxillary: 12, pectoral: 8, thigh: 18 },
};

test("Pollock 7 calcula sem exigir circunferências opcionais", () => {
  const result = calculatePollock7({ ...input, circumferencesCm: {} });
  assert.equal(result.sumSkinfoldsMm, 94);
  assert.ok(result.bmi > 28 && result.bmi < 29);
  assert.ok(result.bodyFatPct > 0);
});

test("Pollock 7 mantém a exigência clínica das sete dobras", () => {
  const incomplete = { ...input.skinfoldsMm } as Record<string, number>;
  delete incomplete.thigh;
  assert.throws(() => calculatePollock7({ ...input, skinfoldsMm: incomplete as typeof input.skinfoldsMm, circumferencesCm: {} }), /sete dobras/i);
});

test("avaliação presencial usa o vínculo organizacional direto do paciente", () => {
  const route = readFileSync(
    new URL("../app/api/admin/clinical-assessments/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /eq\(clients\.organizationId, context\.organizationId\)/);
  assert.doesNotMatch(route, /nfPlans|innerJoin/);
});
