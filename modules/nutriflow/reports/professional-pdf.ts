import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import type {
  PatientPortalItemV1,
  PatientPortalPlanV1,
  PatientPortalSubstitutionV1,
} from "../contracts/v1/patient-portal.ts";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BRAND_YELLOW = rgb(1, 0.91, 0);
const INK = rgb(0.06, 0.06, 0.06);
const MUTED = rgb(0.38, 0.38, 0.35);
const BORDER = rgb(0.84, 0.83, 0.78);
const PAPER = rgb(0.97, 0.97, 0.94);
const PALE_YELLOW = rgb(1, 0.98, 0.82);

export type ReportRecipeSnapshot = Readonly<{
  name: string;
  versionNumber: number;
  instructions: string | null;
  yieldQuantityMilli: number;
  yieldUnit: Readonly<{ label: string }>;
  ingredients: readonly Readonly<{
    displayName: string;
    quantityMilli: number;
    unit: Readonly<{ label: string }>;
    preparation: string | null;
  }>[];
}>;

export type PlanReportInput = Readonly<{
  patientName: string;
  nutritionistName: string;
  nutritionistRegistration: string;
  validFrom: string | null;
  validUntil: string | null;
  plan: PatientPortalPlanV1;
  recipes?: Readonly<Record<string, ReportRecipeSnapshot>>;
  logoBytes?: Uint8Array | null;
}>;

export type ClinicalAssessmentReportPoint = Readonly<{
  publicId: string;
  capturedAt: string;
  protocolCode: string;
  protocolVersion: string;
  weightKg: number;
  heightCm: number;
  bmi: number;
  bodyFatPct: number;
  fatMassKg: number;
  leanMassKg: number;
  sumSkinfoldsMm: number | null;
  skinfoldsMm: Readonly<Record<string, number>>;
  circumferencesCm: Readonly<Record<string, number>>;
  measurementSide: "left" | "right" | null;
}>;

export type ClinicalReportPhoto = Readonly<{
  angle: "front" | "side" | "back";
  period: string;
  contentType: string;
  bytes: Uint8Array;
}>;

export type ClinicalEvolutionReportInput = Readonly<{
  patientName: string;
  nutritionistName: string;
  nutritionistRegistration: string;
  initial: ClinicalAssessmentReportPoint;
  current: ClinicalAssessmentReportPoint;
  trajectory: readonly ClinicalAssessmentReportPoint[];
  initialPhotos?: readonly ClinicalReportPhoto[];
  currentPhotos?: readonly ClinicalReportPhoto[];
  logoBytes?: Uint8Array | null;
}>;

export type ClinicalAssessmentReportInput = Readonly<{
  patientName: string;
  nutritionistName: string;
  nutritionistRegistration: string;
  assessments: readonly ClinicalAssessmentReportPoint[];
  targetAssessmentPublicId: string;
  logoBytes?: Uint8Array | null;
}>;

export function clinicalAssessmentPoint(row: Readonly<{
  publicId: string;
  protocolCode: string;
  protocolVersion: string;
  capturedAt: string;
  weightKg: string;
  heightCm: string;
  bmi: string;
  bodyFatPct: string;
  fatMassKg: string;
  leanMassKg: string;
  snapshotJson: string;
}>): ClinicalAssessmentReportPoint {
  let circumferencesCm: Record<string, number> = {};
  let skinfoldsMm: Record<string, number> = {};
  let sumSkinfoldsMm: number | null = null;
  let measurementSide: "left" | "right" | null = null;
  try {
    const snapshot = JSON.parse(row.snapshotJson) as { input?: { circumferencesCm?: Record<string, number>; skinfoldsMm?: Record<string, number>; measurementSide?: "left" | "right" }; result?: { sumSkinfoldsMm?: number } };
    circumferencesCm = Object.fromEntries(Object.entries(snapshot.input?.circumferencesCm ?? {}).filter(([, value]) => Number(value) > 0).map(([key, value]) => [key, Number(value)]));
    skinfoldsMm = Object.fromEntries(Object.entries(snapshot.input?.skinfoldsMm ?? {}).filter(([, value]) => Number(value) > 0).map(([key, value]) => [key, Number(value)]));
    sumSkinfoldsMm = Number.isFinite(Number(snapshot.result?.sumSkinfoldsMm)) ? Number(snapshot.result?.sumSkinfoldsMm) : null;
    measurementSide = snapshot.input?.measurementSide === "left" || snapshot.input?.measurementSide === "right" ? snapshot.input.measurementSide : null;
  } catch { /* os resultados escalares persistidos continuam válidos para o relatório */ }
  return Object.freeze({
    publicId: row.publicId,
    capturedAt: row.capturedAt,
    protocolCode: row.protocolCode,
    protocolVersion: row.protocolVersion,
    weightKg: Number(row.weightKg),
    heightCm: Number(row.heightCm),
    bmi: Number(row.bmi),
    bodyFatPct: Number(row.bodyFatPct),
    fatMassKg: Number(row.fatMassKg),
    leanMassKg: Number(row.leanMassKg),
    sumSkinfoldsMm,
    skinfoldsMm: Object.freeze(skinfoldsMm),
    circumferencesCm: Object.freeze(circumferencesCm),
    measurementSide,
  });
}

type FontSet = Readonly<{ regular: PDFFont; bold: PDFFont; oblique: PDFFont }>;

function safeText(value: unknown) {
  return String(value ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[✓✔]/g, "OK")
    .replace(/[^\u0009\u000A\u000D\u0020-\u007E\u00A0-\u00FF]/g, " ")
    .normalize("NFC");
}

function ptDate(value: string | null | undefined) {
  if (!value) return "Não informada";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function ptNumber(value: number, digits = 1) {
  return value.toFixed(digits).replace(".", ",");
}

function quantity(quantityMilli: number, unit: Readonly<{ label: string }>) {
  const value = quantityMilli / 1000;
  const formatted = Number.isInteger(value) ? String(value) : ptNumber(value, 2).replace(/,?0+$/, "");
  return `${formatted} ${unit.label}`;
}

function objectiveFrom(plan: PatientPortalPlanV1) {
  const notes = [plan.notes, ...plan.patientNotes].filter(Boolean).map(String);
  const explicit = notes.map((note) => note.match(/objetivo\s*:\s*([^.;\n]+)/i)?.[1]?.trim()).find(Boolean);
  if (explicit) return explicit;
  const all = notes.join(" ").toLowerCase();
  if (all.includes("redução de gordura") || all.includes("emagrec")) return "Redução de gordura corporal";
  if (all.includes("hipertrof") || all.includes("ganho de massa")) return "Hipertrofia muscular";
  if (all.includes("manutenção")) return "Manutenção do peso e da composição corporal";
  if (all.includes("performance")) return "Performance e organização alimentar";
  return "Estratégia nutricional individualizada";
}

function recipeKey(item: PatientPortalItemV1) {
  return item.recipe ? `${item.recipe.publicId}@${item.recipe.versionNumber}` : null;
}

function groupsForItem(
  substitutions: readonly PatientPortalSubstitutionV1[],
  item: PatientPortalItemV1,
  itemIndex: number,
  itemCount: number,
) {
  const available = substitutions.filter((group) => group.options.length > 0);
  const linked = available.filter((group) => group.mealItemPublicId === item.publicId);
  const unlinked = available.filter((group) => !group.mealItemPublicId);
  if (linked.length) return linked;
  if (itemCount === 1) return unlinked;
  return unlinked[itemIndex] ? [unlinked[itemIndex]] : [];
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number) {
  const paragraphs = safeText(text).split(/\n+/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(""); continue; }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
      else {
        if (line) lines.push(line);
        if (font.widthOfTextAtSize(word, size) <= maxWidth) line = word;
        else {
          let piece = "";
          for (const char of word) {
            if (font.widthOfTextAtSize(piece + char, size) > maxWidth && piece) { lines.push(piece); piece = char; }
            else piece += char;
          }
          line = piece;
        }
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

class ProfessionalPdf {
  readonly doc: PDFDocument;
  readonly fonts: FontSet;
  readonly reportName: string;
  readonly versionLabel: string;
  readonly issuedAt: string;
  readonly logo: PDFImage | null;
  page!: PDFPage;
  y = 0;

  private constructor(input: { doc: PDFDocument; fonts: FontSet; reportName: string; versionLabel: string; issuedAt: string; logo: PDFImage | null }) {
    this.doc = input.doc;
    this.fonts = input.fonts;
    this.reportName = input.reportName;
    this.versionLabel = input.versionLabel;
    this.issuedAt = input.issuedAt;
    this.logo = input.logo;
  }

  static async create(input: { reportName: string; versionLabel: string; issuedAt: string; logoBytes?: Uint8Array | null }) {
    const doc = await PDFDocument.create();
    const immutableDate = new Date(input.issuedAt);
    doc.setTitle(`${input.reportName} - ${input.versionLabel}`);
    doc.setAuthor("Ludgero Sangaletti - NutriFlow");
    doc.setCreator("NutriFlow");
    doc.setProducer("NutriFlow Professional Reports");
    doc.setCreationDate(immutableDate);
    doc.setModificationDate(immutableDate);
    const fonts = {
      regular: await doc.embedFont(StandardFonts.Helvetica),
      bold: await doc.embedFont(StandardFonts.HelveticaBold),
      oblique: await doc.embedFont(StandardFonts.HelveticaOblique),
    };
    let logo: PDFImage | null = null;
    if (input.logoBytes?.length) {
      try { logo = await doc.embedPng(input.logoBytes); } catch { logo = null; }
    }
    const report = new ProfessionalPdf({ doc, fonts, reportName: input.reportName, versionLabel: input.versionLabel, issuedAt: input.issuedAt, logo });
    report.addPage();
    return report;
  }

  addPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    if (this.logo) {
      const scale = Math.min(74 / this.logo.width, 58 / this.logo.height);
      this.page.drawImage(this.logo, { x: MARGIN, y: PAGE_HEIGHT - MARGIN - this.logo.height * scale + 4, width: this.logo.width * scale, height: this.logo.height * scale });
    } else {
      this.page.drawRectangle({ x: MARGIN, y: PAGE_HEIGHT - 78, width: 42, height: 42, color: INK });
      this.page.drawText("NF", { x: MARGIN + 11, y: PAGE_HEIGHT - 63, size: 12, font: this.fonts.bold, color: BRAND_YELLOW });
    }
    const brandX = this.logo ? MARGIN + 84 : MARGIN + 52;
    this.page.drawText("NUTRIFLOW", { x: brandX, y: PAGE_HEIGHT - 54, size: 13, font: this.fonts.bold, color: INK });
    this.page.drawText("LUDGERO SANGALETTI", { x: brandX, y: PAGE_HEIGHT - 69, size: 8.2, font: this.fonts.bold, color: MUTED });
    const reportWidth = this.fonts.bold.widthOfTextAtSize(this.reportName.toUpperCase(), 8.2);
    this.page.drawText(this.reportName.toUpperCase(), { x: PAGE_WIDTH - MARGIN - reportWidth, y: PAGE_HEIGHT - 58, size: 8.2, font: this.fonts.bold, color: MUTED });
    this.page.drawRectangle({ x: MARGIN, y: PAGE_HEIGHT - 87, width: CONTENT_WIDTH, height: 2.5, color: BRAND_YELLOW });
    this.y = PAGE_HEIGHT - 112;
  }

  ensure(height: number) {
    if (this.y - height < 68) this.addPage();
  }

  move(amount: number) { this.y -= amount; }

  text(text: string, options: { x?: number; width?: number; size?: number; lineHeight?: number; bold?: boolean; oblique?: boolean; color?: ReturnType<typeof rgb> } = {}) {
    const x = options.x ?? MARGIN;
    const width = options.width ?? CONTENT_WIDTH;
    const size = options.size ?? 10;
    const lineHeight = options.lineHeight ?? size * 1.35;
    const font = options.bold ? this.fonts.bold : options.oblique ? this.fonts.oblique : this.fonts.regular;
    const lines = wrap(font, text, size, width);
    this.ensure(lines.length * lineHeight + 2);
    for (const line of lines) {
      this.page.drawText(line, { x, y: this.y, size, font, color: options.color ?? INK });
      this.y -= lineHeight;
    }
    return lines.length * lineHeight;
  }

  label(text: string, options: { x?: number; color?: ReturnType<typeof rgb> } = {}) {
    this.ensure(16);
    this.page.drawText(safeText(text).toUpperCase(), { x: options.x ?? MARGIN, y: this.y, size: 7.2, font: this.fonts.bold, color: options.color ?? MUTED });
    this.y -= 12;
  }

  section(title: string, eyebrow?: string) {
    this.ensure(44);
    if (eyebrow) { this.label(eyebrow); this.move(5); }
    this.text(title, { size: 18, lineHeight: 21, bold: true });
    this.page.drawRectangle({ x: MARGIN, y: this.y - 4, width: 38, height: 2.2, color: BRAND_YELLOW });
    this.y -= 15;
  }

  infoGrid(items: readonly Readonly<{ label: string; value: string }>[]) {
    const columns = 2;
    const gap = 9;
    const width = (CONTENT_WIDTH - gap) / columns;
    for (let index = 0; index < items.length; index += columns) {
      this.ensure(58);
      const row = items.slice(index, index + columns);
      const top = this.y;
      row.forEach((item, column) => {
        const x = MARGIN + column * (width + gap);
        this.page.drawRectangle({ x, y: top - 48, width, height: 48, color: PAPER, borderColor: BORDER, borderWidth: 0.5 });
        this.page.drawText(safeText(item.label).toUpperCase(), { x: x + 11, y: top - 15, size: 6.7, font: this.fonts.bold, color: MUTED });
        const lines = wrap(this.fonts.bold, item.value, 10, width - 22).slice(0, 2);
        lines.forEach((line, lineIndex) => this.page.drawText(line, { x: x + 11, y: top - 31 - lineIndex * 11, size: 10, font: this.fonts.bold, color: INK }));
      });
      this.y = top - 57;
    }
  }

  card(height: number, color = PAPER) {
    this.ensure(height + 8);
    const top = this.y;
    this.page.drawRectangle({ x: MARGIN, y: top - height, width: CONTENT_WIDTH, height, color, borderColor: BORDER, borderWidth: 0.65 });
    return { x: MARGIN + 14, top: top - 14, width: CONTENT_WIDTH - 28, bottom: top - height + 14 };
  }

  finalize() {
    const pages = this.doc.getPages();
    pages.forEach((page, index) => {
      page.drawLine({ start: { x: MARGIN, y: 39 }, end: { x: PAGE_WIDTH - MARGIN, y: 39 }, thickness: 0.55, color: BORDER });
      page.drawText(`Emitido em ${ptDate(this.issuedAt)}  |  ${this.versionLabel}`, { x: MARGIN, y: 24, size: 7.1, font: this.fonts.regular, color: MUTED });
      const pageLabel = `Página ${index + 1} de ${pages.length}`;
      page.drawText(pageLabel, { x: PAGE_WIDTH - MARGIN - this.fonts.regular.widthOfTextAtSize(pageLabel, 7.1), y: 24, size: 7.1, font: this.fonts.regular, color: MUTED });
    });
    return this.doc.save();
  }
}

function macrosEnergy(plan: PatientPortalPlanV1) {
  const value = plan.macros?.energyKcal;
  return value == null ? "Em atualização" : `${Math.round(value)} kcal`;
}

export async function buildPlanReportPdf(input: PlanReportInput) {
  const report = await ProfessionalPdf.create({ reportName: "Plano alimentar", versionLabel: `Plano v${input.plan.versionNumber}`, issuedAt: input.plan.publishedAt, logoBytes: input.logoBytes });
  report.label("Prescrição nutricional", { color: rgb(0.55, 0.5, 0) });
  report.move(7);
  report.text("Plano alimentar", { size: 31, lineHeight: 34, bold: true });
  report.text(input.patientName, { size: 15, lineHeight: 20, color: MUTED });
  report.move(10);
  report.infoGrid([
    { label: "Paciente", value: input.patientName },
    { label: "Nutricionista", value: `${input.nutritionistName} - ${input.nutritionistRegistration}` },
    { label: "Publicação", value: `${ptDate(input.plan.publishedAt)} - versão ${input.plan.versionNumber}` },
    { label: "Vigência", value: input.validFrom || input.validUntil ? `${ptDate(input.validFrom)} a ${ptDate(input.validUntil)}` : "Conforme período de acompanhamento" },
    { label: "Objetivo atual", value: objectiveFrom(input.plan) },
    { label: "Valor energético total", value: macrosEnergy(input.plan) },
  ]);
  report.move(10);

  for (const strategy of input.plan.days) {
    report.section(strategy.label, "Estratégia alimentar");
    for (const meal of strategy.meals) {
      const options = meal.options.length ? meal.options : [{ publicId: `${meal.publicId}_option_1`, label: "Opção 1", sortOrder: 0, items: meal.items, substitutions: meal.substitutions }];
      const mealEstimate = 72 + options.reduce((total, option) => total + option.items.length * 34 + option.substitutions.reduce((sum, group) => sum + 24 + group.options.length * 12, 0), 0);
      report.ensure(Math.min(mealEstimate, 580));
      report.label(meal.scheduledTime || "Horário flexível");
      report.text(meal.title, { size: 15, lineHeight: 18, bold: true });
      report.move(4);
      for (const option of options) {
        if (options.length > 1) {
          report.ensure(30);
          report.page.drawRectangle({ x: MARGIN, y: report.y - 4, width: 7, height: 7, color: BRAND_YELLOW });
          report.text(option.label, { x: MARGIN + 14, width: CONTENT_WIDTH - 14, size: 10, lineHeight: 14, bold: true });
          report.move(2);
        }
        for (const [itemIndex, item] of option.items.entries()) {
          const substitutions = groupsForItem(option.substitutions, item, itemIndex, option.items.length);
          const recipe = item.recipe && input.recipes ? input.recipes[recipeKey(item)!] : undefined;
          const preparation = [item.preparation, item.notes].filter(Boolean).join(" - ");
          const estimated = 40 + Math.max(0, wrap(report.fonts.regular, preparation, 8, 225).length - 1) * 10 + substitutions.reduce((sum, group) => sum + 18 + group.options.length * 12, 0) + (recipe ? 34 + recipe.ingredients.length * 12 + wrap(report.fonts.regular, recipe.instructions || "", 8, 460).length * 10 : 0);
          report.ensure(Math.min(estimated, 250));
          const top = report.y;
          report.page.drawLine({ start: { x: MARGIN, y: top + 4 }, end: { x: PAGE_WIDTH - MARGIN, y: top + 4 }, thickness: 0.45, color: BORDER });
          const nameLines = wrap(report.fonts.bold, item.displayName, 9.6, 190);
          nameLines.forEach((line, index) => report.page.drawText(line, { x: MARGIN, y: top - index * 12, size: 9.6, font: report.fonts.bold, color: INK }));
          const qty = quantity(item.quantityMilli, item.unit);
          report.page.drawText(qty, { x: MARGIN + 204, y: top, size: 9, font: report.fonts.bold, color: INK });
          const prepLines = wrap(report.fonts.regular, preparation || "Conforme orientação do plano", 8, 225);
          prepLines.forEach((line, index) => report.page.drawText(line, { x: MARGIN + 286, y: top - index * 10, size: 8, font: report.fonts.regular, color: MUTED }));
          report.y = top - Math.max(nameLines.length * 12, prepLines.length * 10, 16) - 6;
          for (const group of substitutions) {
            report.ensure(26 + group.options.length * 12);
            report.page.drawRectangle({ x: MARGIN + 12, y: report.y - (21 + group.options.length * 12), width: CONTENT_WIDTH - 12, height: 21 + group.options.length * 12, color: PALE_YELLOW });
            report.page.drawText(safeText(group.title), { x: MARGIN + 22, y: report.y - 13, size: 7.7, font: report.fonts.bold, color: INK });
            let sy = report.y - 25;
            group.options.forEach((candidate) => {
              report.page.drawText(`${safeText(candidate.displayName)} - ${safeText(quantity(candidate.quantityMilli, candidate.unit))}`, { x: MARGIN + 28, y: sy, size: 7.8, font: report.fonts.regular, color: MUTED });
              sy -= 12;
            });
            report.y -= 27 + group.options.length * 12;
            report.move(4);
          }
          if (recipe) {
            const ingredientHeight = recipe.ingredients.length * 12;
            const instructionLines = wrap(report.fonts.regular, recipe.instructions || "Sem orientação de preparo registrada.", 8, CONTENT_WIDTH - 48);
            const boxHeight = 47 + ingredientHeight + instructionLines.length * 10;
            report.ensure(boxHeight + 6);
            const boxTop = report.y;
            report.page.drawRectangle({ x: MARGIN + 12, y: boxTop - boxHeight, width: CONTENT_WIDTH - 12, height: boxHeight, color: PAPER, borderColor: BORDER, borderWidth: 0.5 });
            report.page.drawText(`RECEITA - ${safeText(recipe.name)}`, { x: MARGIN + 24, y: boxTop - 16, size: 7.5, font: report.fonts.bold, color: INK });
            let ry = boxTop - 31;
            recipe.ingredients.forEach((ingredient) => {
              report.page.drawText(`${safeText(ingredient.displayName)} - ${safeText(quantity(ingredient.quantityMilli, ingredient.unit))}${ingredient.preparation ? ` (${safeText(ingredient.preparation)})` : ""}`, { x: MARGIN + 28, y: ry, size: 7.8, font: report.fonts.regular, color: MUTED });
              ry -= 12;
            });
            report.page.drawText("Modo de preparo", { x: MARGIN + 24, y: ry - 2, size: 7.4, font: report.fonts.bold, color: INK });
            ry -= 14;
            instructionLines.forEach((line) => { report.page.drawText(line, { x: MARGIN + 24, y: ry, size: 8, font: report.fonts.regular, color: MUTED }); ry -= 10; });
            report.y = boxTop - boxHeight - 8;
          }
        }
        report.move(6);
      }
      if (meal.instructions) {
        report.ensure(52);
        report.label("Orientação da refeição");
        report.text(meal.instructions, { size: 8.6, lineHeight: 12, color: MUTED });
        report.move(8);
      }
    }
  }

  if (input.plan.patientNotes.length || input.plan.notes) {
    report.section("Orientações gerais", "Acompanhamento");
    for (const note of [...input.plan.patientNotes, input.plan.notes].filter((value): value is string => Boolean(value))) {
      report.ensure(30);
      report.page.drawRectangle({ x: MARGIN, y: report.y - 5, width: 5, height: 5, color: BRAND_YELLOW });
      report.text(note, { x: MARGIN + 14, width: CONTENT_WIDTH - 14, size: 9.2, lineHeight: 13, color: MUTED });
      report.move(6);
    }
  }
  return report.finalize();
}

const circumferenceLabels: Readonly<Record<string, string>> = Object.freeze({ arm: "Braço", waist: "Cintura", abdomen: "Abdômen", hip: "Quadril", thigh: "Coxa" });
const skinfoldLabels: Readonly<Record<string, string>> = Object.freeze({ triceps: "Tríceps", subscapular: "Subescapular", suprailiac: "Supra-ilíaca", abdominal: "Abdominal", midaxillary: "Axilar média", pectoral: "Peitoral", thigh: "Coxa" });

type Metric = Readonly<{ label: string; value: number; unit: string }>;

function orderedAssessmentHistory(points: readonly ClinicalAssessmentReportPoint[], targetPublicId: string) {
  const ordered = [...points].toSorted((a, b) => a.capturedAt.localeCompare(b.capturedAt) || a.publicId.localeCompare(b.publicId));
  const targetIndex = ordered.findIndex((point) => point.publicId === targetPublicId);
  if (targetIndex < 0) throw new Error("NUTRIFLOW_CLINICAL_REPORT_TARGET_NOT_FOUND");
  return Object.freeze(ordered.slice(0, targetIndex + 1));
}

function roundedDelta(initial: number, current: number) {
  return Number((current - initial).toFixed(1));
}

function changeLabel(initial: number, current: number, unit: string) {
  const raw = current - initial;
  const difference = roundedDelta(initial, current);
  if (raw === 0) return "Sem alteração";
  if (difference === 0) return "Praticamente estável";
  return `${difference > 0 ? "+" : "-"}${ptNumber(Math.abs(difference))} ${unit}`;
}

function bodyMetrics(point: ClinicalAssessmentReportPoint): readonly Metric[] {
  return Object.freeze([
    { label: "Peso", value: point.weightKg, unit: "kg" },
    { label: "IMC", value: point.bmi, unit: "kg/m²" },
    { label: "Gordura corporal", value: point.bodyFatPct, unit: "%" },
    { label: "Massa gorda", value: point.fatMassKg, unit: "kg" },
    { label: "Massa livre de gordura", value: point.leanMassKg, unit: "kg" },
  ]);
}

function drawOverviewCards(report: ProfessionalPdf, metrics: readonly Metric[]) {
  const gap = 10;
  const width = (CONTENT_WIDTH - gap) / 2;
  for (let index = 0; index < metrics.length; index += 2) {
    report.ensure(82);
    const top = report.y;
    metrics.slice(index, index + 2).forEach((metric, column) => {
      const x = MARGIN + column * (width + gap);
      report.page.drawRectangle({ x, y: top - 69, width, height: 69, color: column === 0 && index === 0 ? PALE_YELLOW : PAPER, borderColor: BORDER, borderWidth: 0.55 });
      report.page.drawText(metric.label.toUpperCase(), { x: x + 13, y: top - 17, size: 6.8, font: report.fonts.bold, color: MUTED });
      report.page.drawText(ptNumber(metric.value), { x: x + 13, y: top - 48, size: 23, font: report.fonts.bold, color: INK });
      const numberWidth = report.fonts.bold.widthOfTextAtSize(ptNumber(metric.value), 23);
      report.page.drawText(metric.unit, { x: x + 18 + numberWidth, y: top - 46, size: 8.5, font: report.fonts.bold, color: MUTED });
    });
    report.y = top - 79;
  }
}

function drawChangeCards(report: ProfessionalPdf, metrics: readonly Metric[], previous: ClinicalAssessmentReportPoint, baseline: ClinicalAssessmentReportPoint) {
  const previousValues = bodyMetrics(previous);
  const baselineValues = bodyMetrics(baseline);
  for (const [index, metric] of metrics.entries()) {
    report.ensure(70);
    const top = report.y;
    const prior = previousValues[index];
    const first = baselineValues[index];
    const deltaUnit = metric.label === "Gordura corporal" ? "p.p." : metric.unit;
    report.page.drawRectangle({ x: MARGIN, y: top - 59, width: CONTENT_WIDTH, height: 59, color: PAPER, borderColor: BORDER, borderWidth: 0.55 });
    report.page.drawText(metric.label.toUpperCase(), { x: MARGIN + 14, y: top - 17, size: 7, font: report.fonts.bold, color: MUTED });
    report.page.drawText(`${ptNumber(prior.value)} ${metric.unit}`, { x: MARGIN + 14, y: top - 43, size: 12, font: report.fonts.regular, color: MUTED });
    report.page.drawLine({ start: { x: MARGIN + 112, y: top - 39 }, end: { x: MARGIN + 144, y: top - 39 }, thickness: 1.1, color: INK });
    report.page.drawLine({ start: { x: MARGIN + 138, y: top - 35 }, end: { x: MARGIN + 144, y: top - 39 }, thickness: 1.1, color: INK });
    report.page.drawLine({ start: { x: MARGIN + 138, y: top - 43 }, end: { x: MARGIN + 144, y: top - 39 }, thickness: 1.1, color: INK });
    report.page.drawText(`${ptNumber(metric.value)} ${metric.unit}`, { x: MARGIN + 158, y: top - 46, size: 18, font: report.fonts.bold, color: INK });
    report.page.drawText(`DESDE A ÚLTIMA: ${changeLabel(prior.value, metric.value, deltaUnit)}`.toUpperCase(), { x: MARGIN + 320, y: top - 29, size: 7.2, font: report.fonts.bold, color: INK });
    if (previous.publicId !== baseline.publicId) report.page.drawText(`DESDE O INÍCIO: ${changeLabel(first.value, metric.value, deltaUnit)}`.toUpperCase(), { x: MARGIN + 320, y: top - 47, size: 7.2, font: report.fonts.bold, color: MUTED });
    report.y = top - 68;
  }
}

function drawMeasureCards(report: ProfessionalPdf, entries: readonly Readonly<{ key: string; value: number }>[], previous: ClinicalAssessmentReportPoint | null) {
  const gap = 9;
  const width = (CONTENT_WIDTH - gap) / 2;
  for (let index = 0; index < entries.length; index += 2) {
    report.ensure(62);
    const top = report.y;
    entries.slice(index, index + 2).forEach((entry, column) => {
      const x = MARGIN + column * (width + gap);
      report.page.drawRectangle({ x, y: top - 50, width, height: 50, color: PAPER, borderColor: BORDER, borderWidth: 0.45 });
      report.page.drawText((circumferenceLabels[entry.key] ?? entry.key).toUpperCase(), { x: x + 11, y: top - 14, size: 6.7, font: report.fonts.bold, color: MUTED });
      report.page.drawText(`${ptNumber(entry.value)} cm`, { x: x + 11, y: top - 33, size: 12, font: report.fonts.bold, color: INK });
      const prior = previous?.circumferencesCm[entry.key];
      if (prior != null) {
        const label = changeLabel(Number(prior), entry.value, "cm");
        const labelWidth = report.fonts.bold.widthOfTextAtSize(label, 7.2);
        report.page.drawText(label, { x: x + width - 11 - labelWidth, y: top - 31, size: 7.2, font: report.fonts.bold, color: MUTED });
      } else if (previous) {
        report.page.drawText("Sem comparação", { x: x + width - 79, y: top - 31, size: 7.2, font: report.fonts.regular, color: MUTED });
      }
    });
    report.y = top - 59;
  }
}

function drawSkinfolds(report: ProfessionalPdf, current: ClinicalAssessmentReportPoint) {
  const entries = Object.entries(current.skinfoldsMm).filter(([, value]) => Number(value) > 0);
  if (!entries.length) return;
  const rows = entries.map(([key, value]) => ({ label: skinfoldLabels[key] ?? key, value: `${ptNumber(Number(value))} mm` }));
  if (current.sumSkinfoldsMm != null) rows.push({ label: "Soma das 7 dobras", value: `${ptNumber(current.sumSkinfoldsMm)} mm` });
  report.ensure(55 + Math.ceil(rows.length / 2) * 46);
  report.section("Dobras cutâneas", "Dados do protocolo");
  const gap = 9;
  const width = (CONTENT_WIDTH - gap) / 2;
  for (let index = 0; index < rows.length; index += 2) {
    report.ensure(46);
    const top = report.y;
    rows.slice(index, index + 2).forEach((row, column) => {
      const x = MARGIN + column * (width + gap);
      report.page.drawRectangle({ x, y: top - 38, width, height: 38, color: PAPER, borderColor: BORDER, borderWidth: 0.45 });
      report.page.drawText(row.label.toUpperCase(), { x: x + 10, y: top - 13, size: 6.5, font: report.fonts.bold, color: MUTED });
      report.page.drawText(row.value, { x: x + 10, y: top - 30, size: 10, font: report.fonts.bold, color: INK });
    });
    report.y = top - 46;
  }
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(value));
}

function drawLineChart(report: ProfessionalPdf, label: string, values: readonly number[], dates: readonly string[], unit: string, x: number, y: number, width: number, height: number) {
  report.page.drawRectangle({ x, y: y - height, width, height, color: PAPER, borderColor: BORDER, borderWidth: 0.5 });
  report.page.drawText(label, { x: x + 12, y: y - 17, size: 8.2, font: report.fonts.bold, color: INK });
  const current = `${ptNumber(values.at(-1)!)} ${unit}`;
  report.page.drawText(current, { x: x + width - 12 - report.fonts.bold.widthOfTextAtSize(current, 8.2), y: y - 17, size: 8.2, font: report.fonts.bold, color: INK });
  const graphX = x + 16;
  const graphY = y - height + 32;
  const graphWidth = width - 32;
  const graphHeight = height - 61;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 0.5);
  const points = values.map((value, index) => ({ x: graphX + index / (values.length - 1) * graphWidth, y: graphY + (value - min) / span * graphHeight }));
  report.page.drawLine({ start: { x: graphX, y: graphY }, end: { x: graphX + graphWidth, y: graphY }, thickness: 0.45, color: BORDER });
  points.forEach((point, index) => {
    if (index) report.page.drawLine({ start: points[index - 1], end: point, thickness: 1.5, color: INK });
    report.page.drawCircle({ x: point.x, y: point.y, size: 2.7, color: BRAND_YELLOW, borderColor: INK, borderWidth: 0.65 });
  });
  const firstDate = shortDate(dates[0]);
  const lastDate = shortDate(dates.at(-1)!);
  report.page.drawText(firstDate, { x: graphX, y: y - height + 12, size: 6.8, font: report.fonts.regular, color: MUTED });
  report.page.drawText(lastDate, { x: graphX + graphWidth - report.fonts.regular.widthOfTextAtSize(lastDate, 6.8), y: y - height + 12, size: 6.8, font: report.fonts.regular, color: MUTED });
}

export async function buildClinicalAssessmentReportPdf(input: ClinicalAssessmentReportInput) {
  const history = orderedAssessmentHistory(input.assessments, input.targetAssessmentPublicId);
  const current = history.at(-1)!;
  const baseline = history[0];
  const previous = history.length > 1 ? history.at(-2)! : null;
  const reportTitle = history.length === 1 ? "Relatório de Avaliação Física" : "Relatório de Evolução Física";
  const report = await ProfessionalPdf.create({ reportName: reportTitle, versionLabel: `Avaliação ${current.publicId.slice(-8)}`, issuedAt: current.capturedAt, logoBytes: input.logoBytes });
  report.label(history.length === 1 ? "Seu ponto de partida" : "Sua evolução até esta avaliação", { color: rgb(0.55, 0.5, 0) });
  report.move(7);
  report.text(reportTitle, { size: 29, lineHeight: 32, bold: true });
  report.text(input.patientName, { size: 15, lineHeight: 20, color: MUTED });
  report.move(10);
  report.infoGrid([
    { label: "Paciente", value: input.patientName },
    { label: "Profissional", value: `${input.nutritionistName} - ${input.nutritionistRegistration}` },
    { label: "Data da avaliação", value: ptDate(current.capturedAt) },
    { label: "Protocolo", value: `${current.protocolCode === "pollock_7" ? "Pollock 7 dobras" : current.protocolCode} - versão ${current.protocolVersion}` },
  ]);
  report.move(9);

  report.section("Visão geral", history.length === 1 ? "Como estou agora" : "Momento atual");
  drawOverviewCards(report, bodyMetrics(current));

  if (previous) {
    report.ensure(44 + bodyMetrics(current).length * 68);
    report.section("Composição corporal", history.length > 2 ? "Atual, anterior e início" : "Desde a primeira avaliação");
    drawChangeCards(report, bodyMetrics(current), previous, baseline);
    report.text("As diferenças indicam somente a direção matemática da mudança, sem julgamento clínico automático.", { size: 8.2, lineHeight: 11.5, color: MUTED });
    report.move(7);
  } else {
    report.ensure(44 + 3 * 57);
    report.section("Composição corporal", "Baseline físico");
    report.infoGrid([
      { label: "Peso", value: `${ptNumber(current.weightKg)} kg` },
      { label: "Altura", value: `${ptNumber(current.heightCm)} cm` },
      { label: "Gordura corporal", value: `${ptNumber(current.bodyFatPct)}%` },
      { label: "Massa gorda", value: `${ptNumber(current.fatMassKg)} kg` },
      { label: "Massa livre de gordura", value: `${ptNumber(current.leanMassKg)} kg` },
      { label: "Protocolo", value: current.protocolCode === "pollock_7" ? "Pollock 7 dobras" : current.protocolCode },
    ]);
  }

  const circumferences = Object.entries(current.circumferencesCm).filter(([, value]) => Number(value) > 0).map(([key, value]) => ({ key, value: Number(value) }));
  if (circumferences.length) {
    report.section("Circunferências", `Medidas ${current.measurementSide === "left" ? "do lado esquerdo" : current.measurementSide === "right" ? "do lado direito" : "registradas"}`);
    drawMeasureCards(report, circumferences, previous);
    report.move(4);
    report.text("A medida de coxa exibida nesta seção utiliza exclusivamente a circunferência registrada, distinta da dobra cutânea da coxa.", { size: 8.2, lineHeight: 11.5, color: MUTED });
    report.move(8);
  }

  drawSkinfolds(report, current);

  if (history.length >= 3) {
    report.section("Linha de evolução", "Histórico até esta avaliação");
    const dates = history.map((point) => point.capturedAt);
    const graphHeight = 126;
    const graphWidth = (CONTENT_WIDTH - 10) / 2;
    report.ensure(graphHeight * 2 + 12);
    let chartTop = report.y;
    drawLineChart(report, "Peso corporal", history.map((point) => point.weightKg), dates, "kg", MARGIN, chartTop, graphWidth, graphHeight);
    drawLineChart(report, "Gordura corporal", history.map((point) => point.bodyFatPct), dates, "%", MARGIN + graphWidth + 10, chartTop, graphWidth, graphHeight);
    chartTop -= graphHeight + 10;
    drawLineChart(report, "Massa gorda", history.map((point) => point.fatMassKg), dates, "kg", MARGIN, chartTop, graphWidth, graphHeight);
    drawLineChart(report, "Massa livre de gordura", history.map((point) => point.leanMassKg), dates, "kg", MARGIN + graphWidth + 10, chartTop, graphWidth, graphHeight);
    report.y = chartTop - graphHeight - 18;
  }

  return report.finalize();
}

/** Compatibilidade interna para consumidores anteriores; o conteúdo oficial é único. */
export async function buildClinicalEvolutionReportPdf(input: ClinicalEvolutionReportInput) {
  return buildClinicalAssessmentReportPdf({
    patientName: input.patientName,
    nutritionistName: input.nutritionistName,
    nutritionistRegistration: input.nutritionistRegistration,
    assessments: input.trajectory.length ? input.trajectory : [input.initial, input.current],
    targetAssessmentPublicId: input.current.publicId,
    logoBytes: input.logoBytes,
  });
}

export const reportFormatting = Object.freeze({ ptDate, ptNumber, quantity, objectiveFrom, roundedDelta, changeLabel, orderedAssessmentHistory });
