import { mkdir, writeFile } from "node:fs/promises";
import type { PatientPortalPlanV1 } from "../modules/nutriflow/contracts/v1/patient-portal.ts";
import {
  buildClinicalAssessmentReportPdf,
  buildPlanReportPdf,
  type ClinicalAssessmentReportPoint,
  type PdfRenderTiming,
} from "../modules/nutriflow/reports/professional-pdf.ts";
import { embeddedReportLogoBytes } from "../modules/nutriflow/reports/report-logo.ts";

const scenario = process.argv[2];
if (!(["plan", "initial", "evolution"] as const).includes(scenario as "plan" | "initial" | "evolution")) {
  throw new Error("Use: plan, initial ou evolution");
}

const gram = Object.freeze({ publicId: "unit_g", code: "g", label: "g" });
const mealNames = ["Café da manhã", "Lanche da manhã", "Almoço", "Lanche da tarde", "Jantar", "Ceia"];
const plan: PatientPortalPlanV1 = Object.freeze({
  publicationPublicId: "pub_benchmark",
  planPublicId: "plan_benchmark",
  planVersionPublicId: "version_benchmark",
  title: "Estratégia alimentar individualizada",
  versionNumber: 7,
  contentHash: "benchmark",
  publishedAt: "2026-08-14T12:00:00.000Z",
  notes: "Objetivo: redução de gordura corporal com preservação de massa muscular.",
  patientNotes: Object.freeze(["Mantenha boa hidratação ao longo do dia."]),
  macros: Object.freeze({ energyKcal: 2100, protein: 160, carbohydrate: 220, fat: 65, fiber: 30 }),
  days: Object.freeze([{
    publicId: "strategy_benchmark",
    label: "Estratégia para dias de treino",
    dayIndex: null,
    meals: Object.freeze(mealNames.map((title, mealIndex) => Object.freeze({
      publicId: `meal_${mealIndex}`,
      title,
      scheduledTime: `${String(7 + mealIndex * 3).padStart(2, "0")}:30`,
      instructions: mealIndex === 2 ? "Tempere a salada com limão e ervas." : null,
      nutritionComplete: true,
      macros: Object.freeze({ energyKcal: 350, protein: 27, carbohydrate: 37, fat: 11, fiber: 5 }),
      items: Object.freeze([]),
      substitutions: Object.freeze([]),
      options: Object.freeze([{
        publicId: `option_${mealIndex}`,
        label: "Opção 1",
        sortOrder: 0,
        items: Object.freeze([
          Object.freeze({ publicId: `item_${mealIndex}_1`, kind: "food" as const, displayName: "Alimento principal", quantityMilli: 120_000, unit: gram, preparation: "preparado conforme orientação", notes: null, recipe: null }),
          Object.freeze({ publicId: `item_${mealIndex}_2`, kind: "food" as const, displayName: "Acompanhamento", quantityMilli: 100_000, unit: gram, preparation: null, notes: null, recipe: null }),
          Object.freeze({ publicId: `item_${mealIndex}_3`, kind: "food" as const, displayName: "Fruta fresca", quantityMilli: 150_000, unit: gram, preparation: null, notes: null, recipe: null }),
        ]),
        substitutions: Object.freeze([{
          publicId: `sub_${mealIndex}`,
          mealItemPublicId: `item_${mealIndex}_3`,
          title: "Trocar a fruta",
          notes: null,
          options: Object.freeze([{ publicId: `sub_item_${mealIndex}`, displayName: "Banana", quantityMilli: 100_000, unit: gram, notes: null }]),
        }]),
      }]),
    }))),
  }]),
});

function assessment(index: number): ClinicalAssessmentReportPoint {
  const weightKg = 86.4 - index * 0.9;
  const bodyFatPct = 24.8 - index * 0.8;
  return Object.freeze({
    publicId: `assessment_${index}`,
    capturedAt: new Date(Date.UTC(2026, 1 + index, 8, 12)).toISOString(),
    protocolCode: "pollock_7",
    protocolVersion: "1.0.0",
    weightKg,
    heightCm: 172,
    bmi: weightKg / (1.72 ** 2),
    bodyFatPct,
    fatMassKg: weightKg * bodyFatPct / 100,
    leanMassKg: weightKg * (1 - bodyFatPct / 100),
    sumSkinfoldsMm: 112 - index * 4,
    skinfoldsMm: Object.freeze({ triceps: 16 - index * 0.3, subscapular: 19 - index * 0.4, suprailiac: 17.5 - index * 0.4, abdominal: 23 - index * 0.6, midaxillary: 18 - index * 0.4, pectoral: 14 - index * 0.3, thigh: 19 - index * 0.4 }),
    circumferencesCm: Object.freeze({ arm: 37, waist: 92 - index, abdomen: 96 - index * 1.1, hip: 102 - index * 0.4, thigh: 61 - index * 0.2 }),
    measurementSide: "right",
  });
}

const history = Object.freeze(Array.from({ length: 6 }, (_, index) => assessment(index)));
const logoBytes = embeddedReportLogoBytes();

async function generate() {
  let stages: PdfRenderTiming = Object.freeze({ assetsMs: 0, renderMs: 0, pdfMs: 0 });
  const startedAt = performance.now();
  const bytes = scenario === "plan"
    ? await buildPlanReportPdf({ patientName: "Paciente Benchmark", nutritionistName: "Ludgero Sangaletti", nutritionistRegistration: "CRN-8 11719", validFrom: "2026-08-14", validUntil: "2026-10-14", plan, logoBytes, onTiming: (timing) => { stages = timing; } })
    : await buildClinicalAssessmentReportPdf({ patientName: "Paciente Benchmark", nutritionistName: "Ludgero Sangaletti", nutritionistRegistration: "CRN-8 11719", assessments: history, targetAssessmentPublicId: scenario === "initial" ? history[0].publicId : history.at(-1)!.publicId, logoBytes, onTiming: (timing) => { stages = timing; } });
  const responseStartedAt = performance.now();
  new Response(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), { headers: { "content-type": "application/pdf" } });
  const responseMs = performance.now() - responseStartedAt;
  return Object.freeze({ bytes, stages, responseMs, totalMs: performance.now() - startedAt });
}

const cold = await generate();
const warm = await generate();
const output = new URL("../tmp/pdfs/", import.meta.url);
await mkdir(output, { recursive: true });
await writeFile(new URL(`benchmark-${scenario}.pdf`, output), warm.bytes);
console.log(JSON.stringify({ scenario, coldMs: cold.totalMs, warmMs: warm.totalMs, warmStages: { ...warm.stages, responseMs: warm.responseMs }, bytes: warm.bytes.length }));
