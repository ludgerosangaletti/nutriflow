import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import type { PatientPortalPlanV1 } from "../modules/nutriflow/contracts/v1/patient-portal.ts";
import { buildClinicalEvolutionReportPdf, buildPlanReportPdf, reportFormatting } from "../modules/nutriflow/reports/professional-pdf.ts";

const unit = Object.freeze({ publicId: "unit_g", code: "g", label: "g" });
const plan: PatientPortalPlanV1 = Object.freeze({
  publicationPublicId: "pub_001", planPublicId: "plan_001", planVersionPublicId: "version_001", title: "Estratégia alimentar", versionNumber: 3, contentHash: "hash", publishedAt: "2026-08-08T12:00:00.000Z", notes: "Objetivo: redução de gordura corporal.", patientNotes: Object.freeze(["Mantenha uma boa hidratação ao longo do dia."]), macros: Object.freeze({ energyKcal: 2100, protein: 160, carbohydrate: 220, fat: 65, fiber: 30 }),
  days: Object.freeze([{ publicId: "strategy_1", label: "Estratégia para dias de treino", dayIndex: null, meals: Object.freeze([{ publicId: "meal_1", title: "Café da manhã", scheduledTime: "07:30", instructions: "Ajuste o horário conforme sua rotina.", nutritionComplete: true, macros: Object.freeze({ energyKcal: 420, protein: 28, carbohydrate: 48, fat: 14, fiber: 7 }), items: Object.freeze([]), substitutions: Object.freeze([]), options: Object.freeze([{ publicId: "option_1", label: "Opção 1", sortOrder: 0, items: Object.freeze([{ publicId: "item_1", kind: "food", displayName: "Pão integral", quantityMilli: 50000, unit, preparation: "tostado", notes: null, recipe: null }]), substitutions: Object.freeze([{ publicId: "sub_1", mealItemPublicId: "item_1", title: "Trocar o carboidrato", notes: null, options: Object.freeze([{ publicId: "sub_item_1", displayName: "Tapioca", quantityMilli: 60000, unit, notes: null }]) }]) }]) }]) }]),
});

const assessment = (id: string, capturedAt: string, weightKg: number, bodyFatPct: number, leanMassKg: number) => Object.freeze({ publicId: id, capturedAt, protocolCode: "pollock_7", protocolVersion: "1.0.0", weightKg, heightCm: 172, bmi: weightKg / (1.72 ** 2), bodyFatPct, fatMassKg: weightKg * bodyFatPct / 100, leanMassKg, circumferencesCm: Object.freeze({ arm: 36, waist: id === "a1" ? 92 : 87, abdomen: id === "a1" ? 96 : 90, hip: 101, thigh: 59 }) });

test("plano profissional gera um PDF A4 válido a partir do snapshot publicado", async () => {
  const bytes = await buildPlanReportPdf({ patientName: "Paciente Exemplo", nutritionistName: "Ludgero Sangaletti", nutritionistRegistration: "CRN-8 11719", validFrom: "2026-08-08", validUntil: "2026-09-08", plan });
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "%PDF");
  const document = await PDFDocument.load(bytes);
  assert.ok(document.getPageCount() >= 1);
  assert.equal(reportFormatting.objectiveFrom(plan), "redução de gordura corporal");
});

test("comparativo clínico gera um PDF válido sem recalcular snapshots", async () => {
  const initial = assessment("a1", "2026-06-08T12:00:00.000Z", 86.4, 24.8, 60.4);
  const current = assessment("a2", "2026-08-08T12:00:00.000Z", 82.1, 20.6, 61.3);
  const bytes = await buildClinicalEvolutionReportPdf({ patientName: "Paciente Exemplo", nutritionistName: "Ludgero Sangaletti", nutritionistRegistration: "CRN-8 11719", initial, current, trajectory: [initial, current] });
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "%PDF");
  const document = await PDFDocument.load(bytes);
  assert.ok(document.getPageCount() >= 2);
  assert.match(reportFormatting.executiveSummary(initial, current), /reduziu/);
});
