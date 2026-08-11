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

test("salvamento da avaliação presencial é idempotente", () => {
  const route = readFileSync(new URL("../app/api/admin/clinical-assessments/route.ts", import.meta.url), "utf8");
  const form = readFileSync(new URL("../app/admin/clientes/[email]/clinical-assessment-form.tsx", import.meta.url), "utf8");
  assert.match(route, /calculation: result, capturedAt/);
  assert.match(route, /onConflictDoNothing/);
  assert.match(route, /duplicate: true/);
  assert.match(form, /capturedAt: calculation\.capturedAt/);
});

test("exclusão de avaliação exige paciente e organização correspondentes", () => {
  const route = readFileSync(new URL("../app/api/admin/clinical-assessments/route.ts", import.meta.url), "utf8");
  const button = readFileSync(new URL("../app/admin/clientes/[email]/clinical-assessment-delete-button.tsx", import.meta.url), "utf8");
  assert.match(route, /export async function DELETE/);
  assert.match(route, /eq\(nfClinicalAssessments\.clientId, client\.id\)/);
  assert.match(route, /eq\(nfClinicalAssessments\.organizationId, context\.organizationId\)/);
  assert.match(route, /clinical-assessment\.deleted/);
  assert.match(button, /window\.confirm/);
});
