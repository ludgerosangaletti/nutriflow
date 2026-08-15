import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("plano e avaliação abrem o visualizador no local, sem navegar para uma rota intermediária", () => {
  const plan = read("app/plano-alimentar/patient-plan-viewer.tsx");
  const evolution = read("app/evolucao/page.tsx");
  const page = read("app/visualizar-documento/page.tsx");

  assert.match(plan, /GeneratedPdfLauncher/);
  assert.match(evolution, /GeneratedPdfLauncher/);
  assert.doesNotMatch(plan, /\/visualizar-documento\?type=plan/);
  assert.doesNotMatch(evolution, /\/visualizar-documento\?type=assessment/);
  assert.match(plan, /\/api\/nutriflow\/v1\/plan-pdf\?strategy=/);
  assert.match(evolution, /\/api\/evolucao\/relatorio\?assessment=/);
  assert.match(page, /await requirePatient\(currentHref\)/);
  assert.match(page, /\/api\/nutriflow\/v1\/plan-pdf/);
  assert.match(page, /\/api\/evolucao\/relatorio\?assessment=/);
});

test("visualizador abre o PDF diretamente e oferece voltar, compartilhar e imprimir", () => {
  const viewer = read("app/visualizar-documento/generated-pdf-viewer.tsx");

  assert.match(viewer, /src=\{pdfUrl\}/);
  assert.match(viewer, /fetch\(pdfUrl/);
  assert.match(viewer, /files: \[file\]/);
  assert.match(viewer, /navigator\.share\(shareData\)/);
  assert.match(viewer, /frameWindow\.print\(\)/);
  assert.match(viewer, /router\.back\(\)/);
  assert.match(viewer, /if \(onClose\)/);
  assert.match(viewer, /setOpen\(true\)/);
  assert.match(viewer, /Abrir arquivo diretamente/);
  assert.doesNotMatch(viewer, /src=\{resource\.objectUrl\}/);
  assert.match(viewer, /"Compartilhar"/);
  assert.match(viewer, />Imprimir</);
});

test("barra móvel ocupa o viewport e respeita as áreas seguras", () => {
  const css = read("app/globals.css");

  assert.match(css, /\.nf-generated-pdf-viewer \{ position: fixed; inset: 0;/);
  assert.match(css, /height: 100dvh/);
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /min-height: 46px/);
});
