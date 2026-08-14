import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import type { PatientPortalPlanV1 } from "../modules/nutriflow/contracts/v1/patient-portal.ts";
import { buildClinicalAssessmentReportPdf, buildPlanReportPdf, clinicalAssessmentPoint, reportFormatting } from "../modules/nutriflow/reports/professional-pdf.ts";

const unit = Object.freeze({ publicId: "unit_g", code: "g", label: "g" });
const plan: PatientPortalPlanV1 = Object.freeze({
  publicationPublicId: "pub_001", planPublicId: "plan_001", planVersionPublicId: "version_001", title: "Estratégia alimentar", versionNumber: 3, contentHash: "hash", publishedAt: "2026-08-08T12:00:00.000Z", notes: "Objetivo: redução de gordura corporal.", patientNotes: Object.freeze(["Mantenha uma boa hidratação ao longo do dia."]), macros: Object.freeze({ energyKcal: 2100, protein: 160, carbohydrate: 220, fat: 65, fiber: 30 }),
  days: Object.freeze([{ publicId: "strategy_1", label: "Estratégia para dias de treino", dayIndex: null, meals: Object.freeze([{ publicId: "meal_1", title: "Café da manhã", scheduledTime: "07:30", instructions: "Ajuste o horário conforme sua rotina.", nutritionComplete: true, macros: Object.freeze({ energyKcal: 420, protein: 28, carbohydrate: 48, fat: 14, fiber: 7 }), items: Object.freeze([]), substitutions: Object.freeze([]), options: Object.freeze([{ publicId: "option_1", label: "Opção 1", sortOrder: 0, items: Object.freeze([{ publicId: "item_1", kind: "food", displayName: "Pão integral", quantityMilli: 50000, unit, preparation: "tostado", notes: null, recipe: null }]), substitutions: Object.freeze([{ publicId: "sub_1", mealItemPublicId: "item_1", title: "Trocar o carboidrato", notes: null, options: Object.freeze([{ publicId: "sub_item_1", displayName: "Tapioca", quantityMilli: 60000, unit, notes: null }]) }]) }]) }]) }]),
});

const assessment = (id: string, capturedAt: string, weightKg: number, bodyFatPct: number, leanMassKg: number) => Object.freeze({ publicId: id, capturedAt, protocolCode: "pollock_7", protocolVersion: "1.0.0", weightKg, heightCm: 172, bmi: weightKg / (1.72 ** 2), bodyFatPct, fatMassKg: weightKg * bodyFatPct / 100, leanMassKg, sumSkinfoldsMm: 112, skinfoldsMm: Object.freeze({ triceps: 14, subscapular: 17, suprailiac: 15, abdominal: 20, midaxillary: 16, pectoral: 13, thigh: 17 }), circumferencesCm: Object.freeze({ arm: 36, waist: id === "a1" ? 92 : 87, abdomen: id === "a1" ? 96 : 90, hip: 101, thigh: 59 }), measurementSide: "right" as const });

test("plano profissional gera um PDF A4 válido a partir do snapshot publicado", async () => {
  let timing = { assetsMs: -1, renderMs: -1, pdfMs: -1 };
  const input = { patientName: "Paciente Exemplo", nutritionistName: "Ludgero Sangaletti", nutritionistRegistration: "CRN-8 11719", validFrom: "2026-08-08", validUntil: "2026-09-08", plan, onTiming: (measured: typeof timing) => { timing = measured; } };
  const bytes = await buildPlanReportPdf(input);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "%PDF");
  const document = await PDFDocument.load(bytes);
  assert.ok(document.getPageCount() >= 1);
  assert.equal(reportFormatting.objectiveFrom(plan), "redução de gordura corporal");
  assert.equal(reportFormatting.printablePlanMacros(plan)?.energyKcal, 2100);
  assert.equal(reportFormatting.printablePlanMacros({ ...plan, days: plan.days.map((day) => ({ ...day, meals: day.meals.map((meal) => ({ ...meal, nutritionComplete: false })) })) }), null);
  assert.deepEqual(reportFormatting.planGeneralNotes(plan), ["Mantenha uma boa hidratação ao longo do dia."]);
  assert.ok(timing.assetsMs >= 0 && timing.renderMs >= 0 && timing.pdfMs >= 0);
  assert.deepEqual(bytes, await buildPlanReportPdf(input), "o mesmo snapshot deve reproduzir o mesmo documento oficial");
});

test("relatório físico oficial funciona desde o baseline e limita a evolução ao alvo", async () => {
  const initial = assessment("a1", "2026-06-08T12:00:00.000Z", 86.4, 24.8, 60.4);
  const second = assessment("a2", "2026-08-08T12:00:00.000Z", 82.1, 20.6, 61.3);
  const future = assessment("a3", "2026-10-08T12:00:00.000Z", 80.9, 19.2, 61.5);
  const input = { patientName: "Paciente Exemplo", nutritionistName: "Ludgero Sangaletti", nutritionistRegistration: "CRN-8 11719", assessments: [future, initial, second], targetAssessmentPublicId: initial.publicId };
  const baselineBytes = await buildClinicalAssessmentReportPdf(input);
  assert.equal(new TextDecoder().decode(baselineBytes.slice(0, 4)), "%PDF");
  assert.match(new TextDecoder("latin1").decode(baselineBytes), /\/Subtype \/Image/, "a marca oficial deve estar incorporada mesmo sem carregamento externo");
  assert.equal((await PDFDocument.load(baselineBytes)).getPageCount(), 2);
  assert.deepEqual(reportFormatting.orderedAssessmentHistory(input.assessments, initial.publicId).map((item) => item.publicId), ["a1"]);
  assert.deepEqual(reportFormatting.orderedAssessmentHistory(input.assessments, second.publicId).map((item) => item.publicId), ["a1", "a2"]);
  assert.deepEqual(baselineBytes, await buildClinicalAssessmentReportPdf(input), "o mesmo estado válido deve produzir o mesmo relatório oficial");
});

test("leitura profissional cobre baseline, recomposição e cenário misto sem diagnóstico automático", () => {
  const initial = assessment("a1", "2026-04-08T12:00:00.000Z", 86.4, 24.8, 65);
  const recomposition = assessment("a2", "2026-06-08T12:00:00.000Z", 82.1, 20.6, 65.2);
  const mixed = assessment("a3", "2026-08-08T12:00:00.000Z", 79.4, 18.8, 62.9);
  assert.match(reportFormatting.professionalReading([initial]), /ponto de partida/i);
  assert.match(reportFormatting.professionalReading([initial, recomposition]), /gordura corporal reduziu 4,2 p\.p\./i);
  assert.match(reportFormatting.professionalReading([initial, mixed]), /acompanhada por redução/i);
  assert.doesNotMatch(reportFormatting.professionalReading([initial, mixed]), /diagnóst|doença|tratamento/i);
});

test("relatório distingue a circunferência da coxa da dobra cutânea da coxa", () => {
  const snapshot = { input: { circumferencesCm: { thigh: 59 }, skinfoldsMm: { thigh: 17 }, measurementSide: "right" }, result: { sumSkinfoldsMm: 112 } };
  const point = clinicalAssessmentPoint({ publicId: "a1", protocolCode: "pollock_7", protocolVersion: "1.0.0", capturedAt: "2026-08-08T12:00:00.000Z", weightKg: "82", heightCm: "172", bmi: "27.7", bodyFatPct: "20", fatMassKg: "16.4", leanMassKg: "65.6", snapshotJson: JSON.stringify(snapshot) });
  assert.equal(point.circumferencesCm.thigh, 59);
  assert.equal(point.skinfoldsMm.thigh, 17);
});

test("downloads administrativo e paciente aplicam alvo, organização e acesso vigente", () => {
  const adminRoute = readFileSync(new URL("../app/api/admin/clinical-assessments/report/route.ts", import.meta.url), "utf8");
  const patientRoute = readFileSync(new URL("../app/api/evolucao/relatorio/route.ts", import.meta.url), "utf8");
  assert.match(adminRoute, /eq\(clients\.organizationId, context\.organizationId\)/);
  assert.match(adminRoute, /eq\(nfClinicalAssessments\.organizationId, context\.organizationId\)/);
  assert.match(patientRoute, /hasActiveAccess\(client\)/);
  assert.match(patientRoute, /eq\(nfClinicalAssessments\.organizationId, client\.organizationId\)/);
  assert.match(patientRoute, /searchParams\.get\("assessment"\)/);
});

test("cabeçalho dos relatórios usa a marca oficial e não recria o monograma genérico", () => {
  const source = readFileSync(new URL("../modules/nutriflow/reports/professional-pdf.ts", import.meta.url), "utf8");
  const embeddedLogo = readFileSync(new URL("../modules/nutriflow/reports/report-logo.ts", import.meta.url), "utf8");
  const reporting = readFileSync(new URL("../app/nutriflow/reporting.ts", import.meta.url), "utf8");
  assert.doesNotMatch(reporting, /fetch\(new URL\("\/brand\/nutriflow-report-logo\.png"/);
  assert.match(reporting, /return embeddedReportLogoBytes\(\)/);
  assert.match(reporting, /server-timing/);
  assert.match(reporting, /\.all<RecipeRow>\(\)/, "as receitas devem ser carregadas em uma consulta em lote");
  assert.doesNotMatch(source, /drawText\("NF"/);
  assert.match(source, /embeddedReportLogoBytes\(\)/);
  assert.match(embeddedLogo, /NUTRIFLOW_REPORT_LOGO_BASE64/);
  assert.match(source, /const iconSize = 46/);
  assert.match(source, /this\.versionLabel/);
});
