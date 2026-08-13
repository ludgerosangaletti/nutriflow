import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const viewer = readFileSync(new URL("../app/plano-alimentar/patient-plan-viewer.tsx", import.meta.url), "utf8");
const pdf = readFileSync(new URL("../modules/nutriflow/reports/professional-pdf.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/nutriflow/v1/plan-pdf/route.ts", import.meta.url), "utf8");

test("nova leitura do plano mantém alternativas explícitas e não inventa preparo", () => {
  assert.match(viewer, /Escolha <strong>uma<\/strong> das opções/);
  assert.match(viewer, /item\.preparation, item\.notes/);
  assert.doesNotMatch(viewer, /Conforme orientação do plano/);
  assert.match(viewer, /RecipeScreen/);
  assert.match(viewer, /role="tablist"/);
});

test("totais só aparecem com nutrição completa e a impressão usa a estratégia selecionada", () => {
  assert.match(viewer, /item\.macros\?\.energyKcal != null && item\.macros\?\.protein != null/);
  assert.match(viewer, /Cálculo nutricional em revisão/);
  assert.match(pdf, /const prepLines = preparation \? wrap/);
  assert.doesNotMatch(pdf, /preparation \|\| "Conforme orientação do plano"/);
  assert.match(pdf, /Escolha uma das opções - elas se equivalem/);
  assert.match(route, /new URL\(request\.url\)\.searchParams\.get\("strategy"\)/);
  assert.match(route, /portal\.plan\.days\.filter/);
});
