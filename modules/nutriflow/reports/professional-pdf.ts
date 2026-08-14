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
  PatientPortalMealV1,
  PatientPortalPlanV1,
  PatientPortalSubstitutionV1,
} from "../contracts/v1/patient-portal.ts";
import { embeddedReportLogoBytes } from "./report-logo.ts";

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
  onTiming?: (timing: PdfRenderTiming) => void;
}>;

export type PdfRenderTiming = Readonly<{
  assetsMs: number;
  renderMs: number;
  pdfMs: number;
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
  onTiming?: (timing: PdfRenderTiming) => void;
}>;

export type ClinicalAssessmentReportInput = Readonly<{
  patientName: string;
  nutritionistName: string;
  nutritionistRegistration: string;
  assessments: readonly ClinicalAssessmentReportPoint[];
  targetAssessmentPublicId: string;
  professionalReading?: string | null;
  logoBytes?: Uint8Array | null;
  onTiming?: (timing: PdfRenderTiming) => void;
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
  readonly assetsMs: number;
  page!: PDFPage;
  y = 0;

  private constructor(input: { doc: PDFDocument; fonts: FontSet; reportName: string; versionLabel: string; issuedAt: string; logo: PDFImage | null; assetsMs: number }) {
    this.doc = input.doc;
    this.fonts = input.fonts;
    this.reportName = input.reportName;
    this.versionLabel = input.versionLabel;
    this.issuedAt = input.issuedAt;
    this.logo = input.logo;
    this.assetsMs = input.assetsMs;
  }

  static async create(input: { reportName: string; versionLabel: string; issuedAt: string; logoBytes?: Uint8Array | null }) {
    const assetsStartedAt = performance.now();
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
    const logoCandidates = [input.logoBytes, embeddedReportLogoBytes()];
    for (const candidate of logoCandidates) {
      if (!candidate?.length) continue;
      try {
        logo = await doc.embedPng(candidate);
        break;
      } catch { /* tenta a marca incorporada quando a imagem externa está indisponível */ }
    }
    const report = new ProfessionalPdf({ doc, fonts, reportName: input.reportName, versionLabel: input.versionLabel, issuedAt: input.issuedAt, logo, assetsMs: performance.now() - assetsStartedAt });
    report.addPage();
    return report;
  }

  addPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const iconSize = 46;
    const iconY = PAGE_HEIGHT - MARGIN - iconSize;
    if (this.logo) {
      const scale = Math.min(iconSize / this.logo.width, iconSize / this.logo.height);
      const width = this.logo.width * scale;
      const height = this.logo.height * scale;
      this.page.drawImage(this.logo, {
        x: MARGIN + (iconSize - width) / 2,
        y: iconY + (iconSize - height) / 2,
        width,
        height,
      });
    } else {
      this.page.drawRectangle({ x: MARGIN, y: iconY, width: 4, height: iconSize, color: BRAND_YELLOW });
    }
    const brandX = MARGIN + (this.logo ? iconSize + 14 : 14);
    this.page.drawText("NUTRIFLOW", { x: brandX, y: PAGE_HEIGHT - 57, size: 13.4, font: this.fonts.bold, color: INK });
    this.page.drawText("LUDGERO SANGALETTI", { x: brandX, y: PAGE_HEIGHT - 72, size: 7.6, font: this.fonts.bold, color: MUTED });

    const reportLabel = this.reportName.toUpperCase();
    const reportWidth = this.fonts.bold.widthOfTextAtSize(reportLabel, 8.4);
    const reportX = PAGE_WIDTH - MARGIN - reportWidth;
    this.page.drawText(reportLabel, { x: reportX, y: PAGE_HEIGHT - 56, size: 8.4, font: this.fonts.bold, color: INK });
    const versionWidth = this.fonts.regular.widthOfTextAtSize(this.versionLabel, 7.2);
    this.page.drawText(this.versionLabel, { x: PAGE_WIDTH - MARGIN - versionWidth, y: PAGE_HEIGHT - 71, size: 7.2, font: this.fonts.regular, color: MUTED });

    const dividerY = PAGE_HEIGHT - 91;
    this.page.drawRectangle({ x: MARGIN, y: dividerY, width: 42, height: 2.2, color: BRAND_YELLOW });
    this.page.drawLine({ start: { x: MARGIN + 42, y: dividerY + 1.1 }, end: { x: PAGE_WIDTH - MARGIN, y: dividerY + 1.1 }, thickness: 0.55, color: BORDER });
    this.y = PAGE_HEIGHT - 116;
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

  prepareForSave() {
    const pages = this.doc.getPages();
    pages.forEach((page, index) => {
      page.drawLine({ start: { x: MARGIN, y: 39 }, end: { x: PAGE_WIDTH - MARGIN, y: 39 }, thickness: 0.55, color: BORDER });
      page.drawText(`Emitido em ${ptDate(this.issuedAt)}  |  ${this.versionLabel}`, { x: MARGIN, y: 24, size: 7.1, font: this.fonts.regular, color: MUTED });
      const pageLabel = `Página ${index + 1} de ${pages.length}`;
      page.drawText(pageLabel, { x: PAGE_WIDTH - MARGIN - this.fonts.regular.widthOfTextAtSize(pageLabel, 7.1), y: 24, size: 7.1, font: this.fonts.regular, color: MUTED });
    });
  }

  save() { return this.doc.save(); }
}

function printablePlanMacros(plan: PatientPortalPlanV1) {
  const meals = plan.days.flatMap((day) => day.meals);
  const published = plan.macros;
  if (meals.length && meals.every((meal) => meal.nutritionComplete) && published?.energyKcal != null && published.protein != null && published.carbohydrate != null && published.fat != null) {
    return Object.freeze({ energyKcal: Math.round(published.energyKcal), protein: Math.round(published.protein), carbohydrate: Math.round(published.carbohydrate), fat: Math.round(published.fat) });
  }
  const selections = meals.map((meal) => meal.options.length === 1 ? meal.options[0].items : null);
  if (!selections.length || selections.some((items) => items == null || items.some((item) => item.macros?.energyKcal == null || item.macros?.protein == null || item.macros?.carbohydrate == null || item.macros?.fat == null))) return null;
  const items = selections.flatMap((selection) => selection ?? []);
  return Object.freeze({
    energyKcal: Math.round(items.reduce((sum, item) => sum + Number(item.macros?.energyKcal), 0)),
    protein: Math.round(items.reduce((sum, item) => sum + Number(item.macros?.protein), 0)),
    carbohydrate: Math.round(items.reduce((sum, item) => sum + Number(item.macros?.carbohydrate), 0)),
    fat: Math.round(items.reduce((sum, item) => sum + Number(item.macros?.fat), 0)),
  });
}

type PrintableOption = Readonly<{
  publicId: string;
  label: string;
  items: readonly PatientPortalItemV1[];
  substitutions: readonly PatientPortalSubstitutionV1[];
}>;

function printableOptions(meal: PatientPortalMealV1): readonly PrintableOption[] {
  return meal.options.length ? meal.options : [Object.freeze({ publicId: `${meal.publicId}_option_1`, label: "Opção 1", items: meal.items, substitutions: meal.substitutions })];
}

function mealMacrosLabel(meal: PatientPortalMealV1) {
  const macros = meal.macros;
  if (!meal.nutritionComplete || macros?.energyKcal == null || macros.protein == null || macros.carbohydrate == null || macros.fat == null) return null;
  return `${Math.round(macros.energyKcal)} kcal | P ${Math.round(macros.protein)} g | C ${Math.round(macros.carbohydrate)} g | G ${Math.round(macros.fat)} g`;
}

function planGeneralNotes(plan: PatientPortalPlanV1) {
  const objective = objectiveFrom(plan).toLocaleLowerCase("pt-BR");
  return [...plan.patientNotes, plan.notes].filter((value): value is string => Boolean(value)).map((note) => {
    const explicit = note.match(/objetivo\s*:\s*([^.;\n]+)[.;]?/i);
    if (!explicit || explicit[1].trim().toLocaleLowerCase("pt-BR") !== objective) return note.trim();
    return note.replace(explicit[0], "").trim();
  }).filter(Boolean);
}

function drawPlanIntro(report: ProfessionalPdf, input: PlanReportInput) {
  report.label(`Plano alimentar | versão ${input.plan.versionNumber}`, { color: rgb(0.55, 0.5, 0) });
  report.move(7);
  const title = input.plan.title.trim() || "Plano alimentar";
  report.text(title, { size: 24, lineHeight: 27, bold: true });
  report.text(`Plano de ${input.patientName}`, { size: 11.5, lineHeight: 16, color: MUTED });
  report.move(9);

  const metaHeight = 52;
  const metaTop = report.y;
  const metaItems = [
    { label: "Prescritor", value: `${input.nutritionistName} - ${input.nutritionistRegistration}` },
    { label: "Publicado", value: `${ptDate(input.plan.publishedAt)} - v${input.plan.versionNumber}` },
    { label: "Vigência", value: input.validFrom || input.validUntil ? `${ptDate(input.validFrom)} a ${ptDate(input.validUntil)}` : "Período de acompanhamento" },
  ];
  const metaWidths = [205, 128, CONTENT_WIDTH - 333];
  report.page.drawRectangle({ x: MARGIN, y: metaTop - metaHeight, width: CONTENT_WIDTH, height: metaHeight, color: PAPER, borderColor: BORDER, borderWidth: 0.55 });
  let metaX = MARGIN;
  metaItems.forEach((item, index) => {
    if (index) report.page.drawLine({ start: { x: metaX, y: metaTop - metaHeight }, end: { x: metaX, y: metaTop }, thickness: 0.45, color: BORDER });
    report.page.drawText(item.label.toUpperCase(), { x: metaX + 11, y: metaTop - 15, size: 6.4, font: report.fonts.bold, color: MUTED });
    wrap(report.fonts.bold, item.value, 8.7, metaWidths[index] - 22).slice(0, 2).forEach((line, lineIndex) => report.page.drawText(line, { x: metaX + 11, y: metaTop - 32 - lineIndex * 10, size: 8.7, font: report.fonts.bold, color: INK }));
    metaX += metaWidths[index];
  });
  report.y = metaTop - metaHeight - 10;

  const objective = objectiveFrom(input.plan);
  const objectiveWidth = 338;
  const objectiveLines = wrap(report.fonts.bold, objective, 10.2, objectiveWidth - 24).slice(0, 3);
  const summaryHeight = Math.max(58, 34 + objectiveLines.length * 11);
  const summaryTop = report.y;
  report.page.drawRectangle({ x: MARGIN, y: summaryTop - summaryHeight, width: CONTENT_WIDTH, height: summaryHeight, color: rgb(1, 1, 1), borderColor: BORDER, borderWidth: 0.55 });
  report.page.drawRectangle({ x: MARGIN, y: summaryTop - summaryHeight, width: 4, height: summaryHeight, color: BRAND_YELLOW });
  report.page.drawText("OBJETIVO", { x: MARGIN + 15, y: summaryTop - 16, size: 6.5, font: report.fonts.bold, color: MUTED });
  objectiveLines.forEach((line, index) => report.page.drawText(line, { x: MARGIN + 15, y: summaryTop - 34 - index * 11, size: 10.2, font: report.fonts.bold, color: INK }));
  const splitX = MARGIN + objectiveWidth;
  report.page.drawLine({ start: { x: splitX, y: summaryTop - summaryHeight }, end: { x: splitX, y: summaryTop }, thickness: 0.45, color: BORDER });
  report.page.drawText("RESUMO NUTRICIONAL", { x: splitX + 13, y: summaryTop - 16, size: 6.5, font: report.fonts.bold, color: MUTED });
  const macros = printablePlanMacros(input.plan);
  report.page.drawText(macros ? `${macros.energyKcal} kcal` : "Cálculo em revisão", { x: splitX + 13, y: summaryTop - 36, size: macros ? 13.5 : 9.3, font: report.fonts.bold, color: INK });
  if (macros) report.page.drawText(`P ${macros.protein} g | C ${macros.carbohydrate} g | G ${macros.fat} g`, { x: splitX + 13, y: summaryTop - 51, size: 7.2, font: report.fonts.regular, color: MUTED });
  report.y = summaryTop - summaryHeight - 18;
}

function drawStrategyHeading(report: ProfessionalPdf, label: string) {
  report.page.drawText("ESTRATÉGIA", { x: MARGIN, y: report.y, size: 6.8, font: report.fonts.bold, color: MUTED });
  report.y -= 17;
  const lines = wrap(report.fonts.bold, label, 16, CONTENT_WIDTH - 46).slice(0, 2);
  lines.forEach((line, index) => report.page.drawText(line, { x: MARGIN, y: report.y - index * 19, size: 16, font: report.fonts.bold, color: INK }));
  report.y -= lines.length * 19 + 7;
  report.page.drawRectangle({ x: MARGIN, y: report.y, width: 36, height: 2.4, color: BRAND_YELLOW });
  report.page.drawLine({ start: { x: MARGIN + 36, y: report.y + 1.2 }, end: { x: PAGE_WIDTH - MARGIN, y: report.y + 1.2 }, thickness: 0.45, color: BORDER });
  report.y -= 17;
}

function drawMealHeading(report: ProfessionalPdf, meal: PatientPortalMealV1, continuation = false) {
  const top = report.y;
  const time = meal.scheduledTime || "Flexível";
  const macros = mealMacrosLabel(meal);
  const title = `${safeText(meal.title)}${continuation ? " - continuação" : ""}`;
  const titleWidth = macros ? 275 : CONTENT_WIDTH - 78;
  const titleLines = wrap(report.fonts.bold, title, continuation ? 12.2 : 14.2, titleWidth).slice(0, 2);
  const headingHeight = Math.max(34, 15 + titleLines.length * 15);
  report.page.drawRectangle({ x: MARGIN, y: top - 25, width: 58, height: 25, color: BRAND_YELLOW });
  report.page.drawText(time, { x: MARGIN + 10, y: top - 17, size: time.length > 6 ? 7.5 : 9, font: report.fonts.bold, color: INK });
  titleLines.forEach((line, index) => report.page.drawText(line, { x: MARGIN + 72, y: top - 17 - index * 15, size: continuation ? 12.2 : 14.2, font: report.fonts.bold, color: INK }));
  if (macros) {
    const width = report.fonts.regular.widthOfTextAtSize(macros, 6.8);
    report.page.drawText(macros, { x: PAGE_WIDTH - MARGIN - width, y: top - 17, size: 6.8, font: report.fonts.regular, color: MUTED });
  }
  report.page.drawLine({ start: { x: MARGIN, y: top - headingHeight }, end: { x: PAGE_WIDTH - MARGIN, y: top - headingHeight }, thickness: 0.55, color: BORDER });
  report.y = top - headingHeight - 13;
}

function drawOptionHeading(report: ProfessionalPdf, option: PrintableOption, continuation = false) {
  const top = report.y;
  report.page.drawRectangle({ x: MARGIN, y: top - 31, width: CONTENT_WIDTH, height: 31, color: PAPER });
  report.page.drawRectangle({ x: MARGIN, y: top - 31, width: 5, height: 31, color: BRAND_YELLOW });
  report.page.drawText(`${safeText(option.label)}${continuation ? " - continuação" : ""}`, { x: MARGIN + 15, y: top - 19, size: 9.4, font: report.fonts.bold, color: INK });
  const hint = "Escolha uma das opções - elas se equivalem.";
  const width = report.fonts.regular.widthOfTextAtSize(hint, 7.2);
  report.page.drawText(hint, { x: PAGE_WIDTH - MARGIN - 12 - width, y: top - 18, size: 7.2, font: report.fonts.regular, color: MUTED });
  report.y = top - 40;
}

function itemCoreLayout(report: ProfessionalPdf, item: PatientPortalItemV1) {
  const nameLines = wrap(report.fonts.bold, item.displayName, 10, 350);
  const detail = [item.preparation, item.notes].filter(Boolean).join(" - ");
  const detailLines = detail ? wrap(report.fonts.regular, detail, 8, 400) : [];
  const height = Math.max(28, 11 + nameLines.length * 12 + detailLines.length * 10 + (detailLines.length ? 4 : 0));
  return { nameLines, detailLines, height };
}

function substitutionHeight(report: ProfessionalPdf, group: PatientPortalSubstitutionV1, item: PatientPortalItemV1) {
  const titleLines = wrap(report.fonts.bold, group.title, 8.3, CONTENT_WIDTH - 52);
  const noteLines = group.notes ? wrap(report.fonts.regular, group.notes, 7.6, CONTENT_WIDTH - 60) : [];
  const optionLines = group.options.flatMap((candidate) => wrap(report.fonts.regular, `${candidate.displayName} - ${quantity(candidate.quantityMilli, candidate.unit)}${candidate.notes ? ` - ${candidate.notes}` : ""}`, 8, CONTENT_WIDTH - 82));
  return 35 + titleLines.length * 10 + noteLines.length * 9 + optionLines.length * 11 + (item.displayName ? 0 : 0);
}

function drawItemCore(report: ProfessionalPdf, item: PatientPortalItemV1, layout: ReturnType<typeof itemCoreLayout>) {
  const top = report.y;
  layout.nameLines.forEach((line, index) => report.page.drawText(line, { x: MARGIN + 2, y: top - 12 - index * 12, size: 10, font: report.fonts.bold, color: INK }));
  const amount = quantity(item.quantityMilli, item.unit);
  report.page.drawText(amount, { x: PAGE_WIDTH - MARGIN - report.fonts.bold.widthOfTextAtSize(amount, 9.4), y: top - 12, size: 9.4, font: report.fonts.bold, color: INK });
  if (layout.detailLines.length) {
    report.page.drawText("PREPARO / OBSERVAÇÃO", { x: MARGIN + 2, y: top - 14 - layout.nameLines.length * 12, size: 6.2, font: report.fonts.bold, color: MUTED });
    layout.detailLines.forEach((line, index) => report.page.drawText(line, { x: MARGIN + 105, y: top - 14 - layout.nameLines.length * 12 - index * 10, size: 8, font: report.fonts.regular, color: MUTED }));
  }
  report.page.drawLine({ start: { x: MARGIN, y: top - layout.height + 3 }, end: { x: PAGE_WIDTH - MARGIN, y: top - layout.height + 3 }, thickness: 0.4, color: BORDER });
  report.y = top - layout.height;
}

function drawSubstitution(report: ProfessionalPdf, group: PatientPortalSubstitutionV1, item: PatientPortalItemV1) {
  const height = substitutionHeight(report, group, item);
  const top = report.y;
  report.page.drawRectangle({ x: MARGIN + 15, y: top - height, width: CONTENT_WIDTH - 15, height, color: PALE_YELLOW });
  report.page.drawRectangle({ x: MARGIN + 15, y: top - height, width: 3.5, height, color: BRAND_YELLOW });
  const titleLines = wrap(report.fonts.bold, group.title, 8.3, CONTENT_WIDTH - 52);
  titleLines.forEach((line, index) => report.page.drawText(line, { x: MARGIN + 29, y: top - 16 - index * 10, size: 8.3, font: report.fonts.bold, color: INK }));
  let y = top - 18 - titleLines.length * 10;
  report.page.drawText(`Alternativas para ${safeText(item.displayName)} - escolha uma:`, { x: MARGIN + 29, y, size: 7.2, font: report.fonts.regular, color: MUTED });
  y -= 13;
  for (const candidate of group.options) {
    report.page.drawRectangle({ x: MARGIN + 30, y: y + 2, width: 4, height: 4, color: INK });
    const lines = wrap(report.fonts.regular, `${candidate.displayName} - ${quantity(candidate.quantityMilli, candidate.unit)}${candidate.notes ? ` - ${candidate.notes}` : ""}`, 8, CONTENT_WIDTH - 82);
    lines.forEach((line, index) => report.page.drawText(line, { x: MARGIN + 41, y: y - index * 11, size: 8, font: report.fonts.regular, color: INK }));
    y -= lines.length * 11;
  }
  if (group.notes) {
    const lines = wrap(report.fonts.regular, group.notes, 7.6, CONTENT_WIDTH - 60);
    y -= 2;
    lines.forEach((line, index) => report.page.drawText(line, { x: MARGIN + 29, y: y - index * 9, size: 7.6, font: report.fonts.oblique, color: MUTED }));
  }
  report.y = top - height - 7;
}

type RecipeRow = Readonly<{ text: string; bold: boolean; indent: number }>;

function recipeRows(report: ProfessionalPdf, recipe: ReportRecipeSnapshot) {
  const rows: RecipeRow[] = [{ text: "INGREDIENTES", bold: true, indent: 0 }];
  for (const ingredient of recipe.ingredients) {
    const text = `${ingredient.displayName} - ${quantity(ingredient.quantityMilli, ingredient.unit)}${ingredient.preparation ? ` (${ingredient.preparation})` : ""}`;
    wrap(report.fonts.regular, text, 8, CONTENT_WIDTH - 72).forEach((line) => rows.push({ text: line, bold: false, indent: 10 }));
  }
  rows.push({ text: "MODO DE PREPARO", bold: true, indent: 0 });
  wrap(report.fonts.regular, recipe.instructions || "Sem orientação de preparo registrada.", 8, CONTENT_WIDTH - 62).forEach((line) => rows.push({ text: line, bold: false, indent: 0 }));
  return rows;
}

function drawRecipe(report: ProfessionalPdf, recipe: ReportRecipeSnapshot, continuation: () => void) {
  const rows = recipeRows(report, recipe);
  const completeHeight = 42 + rows.length * 10;
  if (completeHeight <= 560 && report.y - completeHeight < 68) continuation();
  let cursor = 0;
  let segment = 0;
  while (cursor < rows.length) {
    if (report.y - 82 < 68) continuation();
    const capacity = Math.max(3, Math.floor((report.y - 68 - 42) / 10));
    const slice = rows.slice(cursor, cursor + capacity);
    const boxHeight = 42 + slice.length * 10;
    const top = report.y;
    report.page.drawRectangle({ x: MARGIN + 15, y: top - boxHeight, width: CONTENT_WIDTH - 15, height: boxHeight, color: PAPER, borderColor: BORDER, borderWidth: 0.5 });
    report.page.drawText(`RECEITA | ${safeText(recipe.name)}${segment ? " - continuação" : ""}`, { x: MARGIN + 29, y: top - 17, size: 8.2, font: report.fonts.bold, color: INK });
    report.page.drawText(`versão ${recipe.versionNumber}`, { x: PAGE_WIDTH - MARGIN - 48, y: top - 17, size: 6.7, font: report.fonts.regular, color: MUTED });
    let y = top - 34;
    slice.forEach((row) => {
      report.page.drawText(safeText(row.text), { x: MARGIN + 29 + row.indent, y, size: row.bold ? 6.7 : 8, font: row.bold ? report.fonts.bold : report.fonts.regular, color: row.bold ? MUTED : INK });
      y -= 10;
    });
    report.y = top - boxHeight - 8;
    cursor += slice.length;
    segment += 1;
  }
}

function mealInstructionLayout(report: ProfessionalPdf, text: string) {
  const lines = wrap(report.fonts.regular, text, 8.4, CONTENT_WIDTH - 38);
  return { lines, height: 31 + lines.length * 11 };
}

function drawMealInstruction(report: ProfessionalPdf, layout: ReturnType<typeof mealInstructionLayout>) {
  const top = report.y;
  report.page.drawRectangle({ x: MARGIN, y: top - layout.height, width: CONTENT_WIDTH, height: layout.height, color: PAPER });
  report.page.drawRectangle({ x: MARGIN, y: top - layout.height, width: 3.5, height: layout.height, color: BRAND_YELLOW });
  report.page.drawText("ORIENTAÇÃO DA REFEIÇÃO", { x: MARGIN + 14, y: top - 15, size: 6.5, font: report.fonts.bold, color: MUTED });
  layout.lines.forEach((line, index) => report.page.drawText(line, { x: MARGIN + 14, y: top - 31 - index * 11, size: 8.4, font: report.fonts.regular, color: INK }));
  report.y = top - layout.height - 14;
}

export async function buildPlanReportPdf(input: PlanReportInput) {
  const renderStartedAt = performance.now();
  const report = await ProfessionalPdf.create({ reportName: "Plano alimentar", versionLabel: `Plano v${input.plan.versionNumber}`, issuedAt: input.plan.publishedAt, logoBytes: input.logoBytes });
  drawPlanIntro(report, input);

  for (const strategy of input.plan.days) {
    report.ensure(150);
    drawStrategyHeading(report, strategy.label);
    for (const meal of strategy.meals) {
      const options = printableOptions(meal);
      report.ensure(options.length > 1 ? 124 : 94);
      drawMealHeading(report, meal);
      for (const option of options) {
        if (options.length > 1) {
          const firstItem = option.items[0];
          const firstItemHeight = firstItem ? itemCoreLayout(report, firstItem).height + groupsForItem(option.substitutions, firstItem, 0, option.items.length).reduce((sum, group) => sum + substitutionHeight(report, group, firstItem) + 7, 0) : 28;
          if (report.y - Math.min(190, 40 + firstItemHeight) < 68) {
            report.addPage();
            drawMealHeading(report, meal, true);
          }
          drawOptionHeading(report, option);
        }
        for (const [itemIndex, item] of option.items.entries()) {
          const substitutions = groupsForItem(option.substitutions, item, itemIndex, option.items.length);
          const recipe = item.recipe && input.recipes ? input.recipes[recipeKey(item)!] : undefined;
          const layout = itemCoreLayout(report, item);
          const linkedHeight = substitutions.reduce((sum, group) => sum + substitutionHeight(report, group, item) + 7, 0);
          if (report.y - Math.min(540, layout.height + linkedHeight) < 68) {
            report.addPage();
            drawMealHeading(report, meal, true);
            if (options.length > 1) drawOptionHeading(report, option, true);
          }
          drawItemCore(report, item, layout);
          substitutions.forEach((group) => drawSubstitution(report, group, item));
          if (recipe) drawRecipe(report, recipe, () => {
            report.addPage();
            drawMealHeading(report, meal, true);
            if (options.length > 1) drawOptionHeading(report, option, true);
          });
        }
        report.move(8);
      }
      if (meal.instructions) {
        const instructionLayout = mealInstructionLayout(report, meal.instructions);
        if (report.y - instructionLayout.height < 68) {
          report.addPage();
          drawMealHeading(report, meal, true);
        }
        drawMealInstruction(report, instructionLayout);
      }
    }
  }

  const notes = planGeneralNotes(input.plan);
  if (notes.length) {
    report.ensure(100);
    report.section("Orientações gerais", "Acompanhamento");
    for (const note of notes) {
      const lines = wrap(report.fonts.regular, note, 8.8, CONTENT_WIDTH - 38);
      const height = Math.max(25, 12 + lines.length * 12);
      if (report.y - height < 68) {
        report.addPage();
        report.section("Orientações gerais - continuação", "Acompanhamento");
      }
      const top = report.y;
      report.page.drawRectangle({ x: MARGIN, y: top - height, width: CONTENT_WIDTH, height, color: PAPER });
      report.page.drawRectangle({ x: MARGIN + 13, y: top - 16, width: 5, height: 5, color: BRAND_YELLOW });
      lines.forEach((line, index) => report.page.drawText(line, { x: MARGIN + 28, y: top - 18 - index * 12, size: 8.8, font: report.fonts.regular, color: INK }));
      report.y = top - height - 5;
    }
  }
  report.prepareForSave();
  const renderFinishedAt = performance.now();
  const pdfStartedAt = performance.now();
  const bytes = await report.save();
  input.onTiming?.(Object.freeze({
    assetsMs: report.assetsMs,
    renderMs: Math.max(0, renderFinishedAt - renderStartedAt - report.assetsMs),
    pdfMs: performance.now() - pdfStartedAt,
  }));
  return bytes;
}

const circumferenceLabels: Readonly<Record<string, string>> = Object.freeze({ arm: "Braço", waist: "Cintura", abdomen: "Abdômen", hip: "Quadril", thigh: "Coxa" });
const skinfoldLabels: Readonly<Record<string, string>> = Object.freeze({ triceps: "Tríceps", subscapular: "Subescapular", suprailiac: "Supra-ilíaca", abdominal: "Abdominal", midaxillary: "Axilar média", pectoral: "Peitoral", thigh: "Coxa" });
const circumferenceOrder = Object.freeze(["arm", "waist", "abdomen", "hip", "thigh"] as const);
const skinfoldOrder = Object.freeze(["triceps", "subscapular", "suprailiac", "abdominal", "midaxillary", "pectoral", "thigh"] as const);

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

function shortDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(value));
}

function metricValue(metric: Metric) {
  return `${ptNumber(metric.value)}${metric.unit === "%" ? "%" : ` ${metric.unit}`}`;
}

function drawRight(report: ProfessionalPdf, text: string, right: number, y: number, options: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {}) {
  const size = options.size ?? 9;
  const font = options.bold ? report.fonts.bold : report.fonts.regular;
  report.page.drawText(safeText(text), { x: right - font.widthOfTextAtSize(safeText(text), size), y, size, font, color: options.color ?? INK });
}

function drawSectionHeading(report: ProfessionalPdf, title: string, meta: string, y: number) {
  report.page.drawText(safeText(title), { x: MARGIN, y, size: 14.5, font: report.fonts.bold, color: INK });
  drawRight(report, meta, PAGE_WIDTH - MARGIN, y + 1, { size: 8.2, color: MUTED });
  report.page.drawLine({ start: { x: MARGIN, y: y - 8 }, end: { x: PAGE_WIDTH - MARGIN, y: y - 8 }, thickness: 0.55, color: BORDER });
  return y - 25;
}

function drawIdentityBar(report: ProfessionalPdf, input: ClinicalAssessmentReportInput, current: ClinicalAssessmentReportPoint, y: number) {
  const height = 49;
  const widths = [173, 164, CONTENT_WIDTH - 337];
  const items = [
    { label: "Profissional", value: input.nutritionistName },
    { label: "Registro", value: input.nutritionistRegistration },
    { label: "Protocolo", value: `${current.protocolCode === "pollock_7" ? "Pollock 7 dobras" : current.protocolCode} v${current.protocolVersion}` },
  ];
  report.page.drawRectangle({ x: MARGIN, y: y - height, width: CONTENT_WIDTH, height, color: PAPER, borderColor: BORDER, borderWidth: 0.55 });
  let x = MARGIN;
  items.forEach((item, index) => {
    if (index) report.page.drawLine({ start: { x, y: y - height }, end: { x, y }, thickness: 0.45, color: BORDER });
    report.page.drawText(item.label.toUpperCase(), { x: x + 11, y: y - 15, size: 6.5, font: report.fonts.bold, color: MUTED });
    const lines = wrap(report.fonts.bold, item.value, 9.2, widths[index] - 22).slice(0, 2);
    lines.forEach((line, lineIndex) => report.page.drawText(line, { x: x + 11, y: y - 32 - lineIndex * 10, size: 9.2, font: report.fonts.bold, color: INK }));
    x += widths[index];
  });
  return y - height - 20;
}

function drawCompositionHero(report: ProfessionalPdf, current: ClinicalAssessmentReportPoint, baseline: ClinicalAssessmentReportPoint, isFirst: boolean, y: number) {
  const height = 91;
  report.page.drawRectangle({ x: MARGIN, y: y - height, width: CONTENT_WIDTH, height, color: INK });
  report.page.drawText("GORDURA CORPORAL", { x: MARGIN + 19, y: y - 24, size: 7.2, font: report.fonts.bold, color: BRAND_YELLOW });
  const main = ptNumber(current.bodyFatPct);
  report.page.drawText(main, { x: MARGIN + 19, y: y - 67, size: 34, font: report.fonts.bold, color: rgb(1, 1, 1) });
  report.page.drawText("%", { x: MARGIN + 25 + report.fonts.bold.widthOfTextAtSize(main, 34), y: y - 62, size: 11, font: report.fonts.bold, color: BORDER });
  const items = isFirst ? [
    ["Peso", `${ptNumber(current.weightKg)} kg`],
    ["Massa gorda", `${ptNumber(current.fatMassKg)} kg`],
    ["Massa livre de gordura", `${ptNumber(current.leanMassKg)} kg`],
  ] : [
    [`No início (${ptDate(baseline.capturedAt)})`, `${ptNumber(baseline.bodyFatPct)}%`],
    ["Variação de gordura", changeLabel(baseline.bodyFatPct, current.bodyFatPct, "p.p.")],
    ["Variação de massa livre", changeLabel(baseline.leanMassKg, current.leanMassKg, "kg")],
  ];
  const startX = MARGIN + 235;
  items.forEach(([label, value], index) => {
    const rowY = y - 24 - index * 23;
    report.page.drawText(safeText(label), { x: startX, y: rowY, size: 8.4, font: report.fonts.regular, color: BORDER });
    drawRight(report, value, PAGE_WIDTH - MARGIN - 18, rowY, { size: 9.4, bold: true, color: rgb(1, 1, 1) });
    if (index < items.length - 1) report.page.drawLine({ start: { x: startX, y: rowY - 7 }, end: { x: PAGE_WIDTH - MARGIN - 18, y: rowY - 7 }, thickness: 0.35, color: rgb(0.24, 0.24, 0.24) });
  });
  return y - height - 15;
}

function comparisonLayout(historyLength: number) {
  return historyLength >= 3
    ? Object.freeze({ label: MARGIN, initial: MARGIN + 210, previous: MARGIN + 300, current: MARGIN + 385, delta: PAGE_WIDTH - MARGIN })
    : Object.freeze({ label: MARGIN, initial: MARGIN + 260, previous: null, current: MARGIN + 380, delta: PAGE_WIDTH - MARGIN });
}

function drawComparisonTable(report: ProfessionalPdf, history: readonly ClinicalAssessmentReportPoint[], y: number) {
  const current = history.at(-1)!;
  const baseline = history[0];
  const previous = history.length > 1 ? history.at(-2)! : null;
  const layout = comparisonLayout(history.length);
  const currentMetrics = bodyMetrics(current);
  const baselineMetrics = bodyMetrics(baseline);
  const previousMetrics = previous ? bodyMetrics(previous) : null;
  const headerY = y;
  report.page.drawText("INDICADOR", { x: layout.label, y: headerY, size: 6.6, font: report.fonts.bold, color: MUTED });
  if (history.length > 1) {
    drawRight(report, "INÍCIO", layout.initial, headerY, { size: 6.6, bold: true, color: MUTED });
    if (layout.previous) drawRight(report, "ANTERIOR", layout.previous, headerY, { size: 6.6, bold: true, color: MUTED });
    drawRight(report, "ATUAL", layout.current, headerY, { size: 6.6, bold: true, color: MUTED });
    drawRight(report, "DESDE O INÍCIO", layout.delta, headerY, { size: 6.6, bold: true, color: MUTED });
  } else {
    drawRight(report, "ATUAL", layout.delta, headerY, { size: 6.6, bold: true, color: MUTED });
  }
  report.page.drawLine({ start: { x: MARGIN, y: headerY - 7 }, end: { x: PAGE_WIDTH - MARGIN, y: headerY - 7 }, thickness: 0.6, color: BORDER });
  let rowY = headerY - 26;
  currentMetrics.forEach((metric, index) => {
    report.page.drawText(metric.label, { x: layout.label, y: rowY, size: 9.2, font: report.fonts.bold, color: INK });
    if (history.length > 1) {
      drawRight(report, metricValue(baselineMetrics[index]), layout.initial, rowY, { size: 8.7, color: MUTED });
      if (layout.previous && previousMetrics) drawRight(report, metricValue(previousMetrics[index]), layout.previous, rowY, { size: 8.7, color: MUTED });
      drawRight(report, metricValue(metric), layout.current, rowY, { size: 9.5, bold: true });
      const unit = metric.label === "Gordura corporal" ? "p.p." : metric.unit;
      drawRight(report, changeLabel(baselineMetrics[index].value, metric.value, unit), layout.delta, rowY, { size: 8.5, bold: true, color: MUTED });
    } else {
      drawRight(report, metricValue(metric), layout.delta, rowY, { size: 9.5, bold: true });
    }
    report.page.drawLine({ start: { x: MARGIN, y: rowY - 9 }, end: { x: PAGE_WIDTH - MARGIN, y: rowY - 9 }, thickness: 0.35, color: BORDER });
    rowY -= 27;
  });
  return rowY + 5;
}

function periodLabel(from: string, to: string) {
  const days = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000));
  if (days < 28) return `${days} dias de acompanhamento`;
  const months = Math.max(1, Math.round(days / 30.4));
  return `${months} ${months === 1 ? "mês" : "meses"} de acompanhamento`;
}

function professionalReading(history: readonly ClinicalAssessmentReportPoint[]) {
  const current = history.at(-1)!;
  if (history.length === 1) {
    return "Esta avaliação estabelece o ponto de partida do acompanhamento. Os indicadores de composição corporal, circunferências e dobras registrados aqui servirão como referência para as próximas avaliações, sempre em conjunto com a evolução clínica e a rotina do paciente.";
  }
  const baseline = history[0];
  const previous = history.at(-2)!;
  const fatDelta = roundedDelta(baseline.bodyFatPct, current.bodyFatPct);
  const leanDelta = roundedDelta(baseline.leanMassKg, current.leanMassKg);
  let reading: string;
  if (fatDelta <= -0.2 && leanDelta >= -0.5) {
    reading = `Desde o início, a gordura corporal reduziu ${ptNumber(Math.abs(fatDelta))} p.p., enquanto a massa livre de gordura ${leanDelta > 0.5 ? `aumentou ${ptNumber(leanDelta)} kg` : "permaneceu praticamente estável"}.`;
  } else if (fatDelta <= -0.2 && leanDelta < -0.5) {
    reading = `Desde o início, a gordura corporal reduziu ${ptNumber(Math.abs(fatDelta))} p.p., acompanhada por redução de ${ptNumber(Math.abs(leanDelta))} kg na massa livre de gordura. Os dois movimentos devem ser avaliados em conjunto no acompanhamento.`;
  } else if (fatDelta >= 0.2 && leanDelta > 0.5) {
    reading = `Desde o início, houve aumento de ${ptNumber(fatDelta)} p.p. na gordura corporal e de ${ptNumber(leanDelta)} kg na massa livre de gordura. A composição mudou em mais de uma direção e deve ser interpretada conforme o objetivo clínico.`;
  } else if (fatDelta >= 0.2) {
    reading = `Desde o início, a gordura corporal aumentou ${ptNumber(fatDelta)} p.p., enquanto a massa livre de gordura ${leanDelta < -0.5 ? `reduziu ${ptNumber(Math.abs(leanDelta))} kg` : "permaneceu praticamente estável"}.`;
  } else if (leanDelta > 0.5) {
    reading = `A gordura corporal permaneceu praticamente estável desde o início, com aumento de ${ptNumber(leanDelta)} kg na massa livre de gordura.`;
  } else if (leanDelta < -0.5) {
    reading = `A gordura corporal permaneceu praticamente estável desde o início, com redução de ${ptNumber(Math.abs(leanDelta))} kg na massa livre de gordura.`;
  } else {
    reading = "Os principais indicadores de composição corporal permaneceram praticamente estáveis desde o início do acompanhamento.";
  }
  const recentFat = roundedDelta(previous.bodyFatPct, current.bodyFatPct);
  const recentLean = roundedDelta(previous.leanMassKg, current.leanMassKg);
  const recent = recentFat === 0 && recentLean === 0
    ? "Na comparação com a avaliação anterior, não houve alteração nos dois indicadores."
    : `Na comparação mais recente, a gordura corporal ${recentFat === 0 ? "ficou estável" : `${recentFat > 0 ? "aumentou" : "reduziu"} ${ptNumber(Math.abs(recentFat))} p.p.`} e a massa livre ${recentLean === 0 ? "ficou estável" : `${recentLean > 0 ? "aumentou" : "reduziu"} ${ptNumber(Math.abs(recentLean))} kg`}.`;
  return `${reading} ${recent}`;
}

function drawProfessionalReading(report: ProfessionalPdf, input: ClinicalAssessmentReportInput, reading: string, y: number) {
  const lines = wrap(report.fonts.regular, reading, 9.4, CONTENT_WIDTH - 34).slice(0, 7);
  const height = 54 + lines.length * 12;
  report.page.drawRectangle({ x: MARGIN, y: y - height, width: CONTENT_WIDTH, height, color: rgb(1, 1, 1), borderColor: INK, borderWidth: 0.8 });
  report.page.drawCircle({ x: MARGIN + 21, y: y - 22, size: 12, color: INK });
  report.page.drawText(safeText(input.nutritionistName.slice(0, 1).toUpperCase()), { x: MARGIN + 17.4, y: y - 25.5, size: 9, font: report.fonts.bold, color: BRAND_YELLOW });
  report.page.drawText("Leitura do profissional", { x: MARGIN + 42, y: y - 19, size: 10.3, font: report.fonts.bold, color: INK });
  report.page.drawText(`${safeText(input.nutritionistName)} - ${safeText(input.nutritionistRegistration)}`, { x: MARGIN + 42, y: y - 32, size: 7.6, font: report.fonts.regular, color: MUTED });
  lines.forEach((line, index) => report.page.drawText(line, { x: MARGIN + 17, y: y - 52 - index * 12, size: 9.4, font: report.fonts.regular, color: INK }));
  return y - height;
}

function drawLineChart(report: ProfessionalPdf, label: string, values: readonly number[], dates: readonly string[], unit: string, x: number, y: number, width: number, height: number) {
  report.page.drawRectangle({ x, y: y - height, width, height, color: PAPER, borderColor: BORDER, borderWidth: 0.5 });
  report.page.drawText(label, { x: x + 12, y: y - 17, size: 8.2, font: report.fonts.bold, color: INK });
  drawRight(report, `${ptNumber(values.at(-1)!)} ${unit}`, x + width - 12, y - 17, { size: 8.2, bold: true });
  const graphX = x + 18;
  const graphY = y - height + 28;
  const graphWidth = width - 36;
  const graphHeight = height - 57;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 0.5);
  const points = values.map((value, index) => ({ x: graphX + index / Math.max(1, values.length - 1) * graphWidth, y: graphY + (value - min) / span * graphHeight, value }));
  report.page.drawLine({ start: { x: graphX, y: graphY }, end: { x: graphX + graphWidth, y: graphY }, thickness: 0.4, color: BORDER });
  const labelEvery = Math.max(1, Math.ceil((points.length - 1) / 5));
  points.forEach((point, index) => {
    if (index) report.page.drawLine({ start: points[index - 1], end: point, thickness: 1.45, color: INK });
    report.page.drawCircle({ x: point.x, y: point.y, size: 2.8, color: index === points.length - 1 ? INK : BRAND_YELLOW, borderColor: INK, borderWidth: 0.65 });
    if (index === 0 || index === points.length - 1 || index % labelEvery === 0) {
      const value = ptNumber(point.value);
      report.page.drawText(value, { x: point.x - report.fonts.bold.widthOfTextAtSize(value, 6.4) / 2, y: point.y + 6, size: 6.4, font: report.fonts.bold, color: MUTED });
    }
  });
  report.page.drawText(shortDate(dates[0]), { x: graphX, y: y - height + 10, size: 6.2, font: report.fonts.regular, color: MUTED });
  drawRight(report, shortDate(dates.at(-1)!), graphX + graphWidth, y - height + 10, { size: 6.2, color: MUTED });
}

function drawCircumferenceTable(report: ProfessionalPdf, history: readonly ClinicalAssessmentReportPoint[], y: number) {
  const current = history.at(-1)!;
  const baseline = history[0];
  const previous = history.length > 1 ? history.at(-2)! : null;
  const entries = circumferenceOrder.filter((key) => Number(current.circumferencesCm[key]) > 0);
  if (!entries.length) return y;
  const layout = comparisonLayout(history.length);
  report.page.drawText("LOCAL", { x: MARGIN, y, size: 6.6, font: report.fonts.bold, color: MUTED });
  if (history.length > 1) {
    drawRight(report, "INÍCIO", layout.initial, y, { size: 6.6, bold: true, color: MUTED });
    if (layout.previous) drawRight(report, "ANTERIOR", layout.previous, y, { size: 6.6, bold: true, color: MUTED });
    drawRight(report, "ATUAL", layout.current, y, { size: 6.6, bold: true, color: MUTED });
    drawRight(report, "DESDE O INÍCIO", layout.delta, y, { size: 6.6, bold: true, color: MUTED });
  } else drawRight(report, "ATUAL", layout.delta, y, { size: 6.6, bold: true, color: MUTED });
  report.page.drawLine({ start: { x: MARGIN, y: y - 7 }, end: { x: PAGE_WIDTH - MARGIN, y: y - 7 }, thickness: 0.55, color: BORDER });
  let rowY = y - 25;
  entries.forEach((key) => {
    const currentValue = current.circumferencesCm[key];
    report.page.drawText(circumferenceLabels[key], { x: MARGIN, y: rowY, size: 9, font: report.fonts.bold, color: INK });
    if (history.length > 1) {
      const firstValue = baseline.circumferencesCm[key];
      const previousValue = previous?.circumferencesCm[key];
      drawRight(report, firstValue == null ? "-" : ptNumber(firstValue), layout.initial, rowY, { size: 8.7, color: MUTED });
      if (layout.previous) drawRight(report, previousValue == null ? "-" : ptNumber(previousValue), layout.previous, rowY, { size: 8.7, color: MUTED });
      drawRight(report, ptNumber(currentValue), layout.current, rowY, { size: 9.3, bold: true });
      drawRight(report, firstValue == null ? "-" : changeLabel(firstValue, currentValue, "cm"), layout.delta, rowY, { size: 8.3, bold: true, color: MUTED });
    } else drawRight(report, `${ptNumber(currentValue)} cm`, layout.delta, rowY, { size: 9.3, bold: true });
    report.page.drawLine({ start: { x: MARGIN, y: rowY - 8 }, end: { x: PAGE_WIDTH - MARGIN, y: rowY - 8 }, thickness: 0.35, color: BORDER });
    rowY -= 24;
  });
  return rowY + 3;
}

function drawSkinfoldGrid(report: ProfessionalPdf, current: ClinicalAssessmentReportPoint, y: number) {
  const entries = skinfoldOrder.filter((key) => Number(current.skinfoldsMm[key]) > 0).map((key) => ({ label: skinfoldLabels[key], value: current.skinfoldsMm[key] }));
  if (current.sumSkinfoldsMm != null) entries.push({ label: "Soma das 7", value: current.sumSkinfoldsMm });
  const columns = 4;
  const gap = 7;
  const width = (CONTENT_WIDTH - gap * (columns - 1)) / columns;
  entries.forEach((entry, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const x = MARGIN + column * (width + gap);
    const top = y - row * 50;
    report.page.drawRectangle({ x, y: top - 42, width, height: 42, color: entry.label === "Soma das 7" ? PAPER : rgb(1, 1, 1), borderColor: BORDER, borderWidth: 0.5 });
    report.page.drawText(entry.label.toUpperCase(), { x: x + 9, y: top - 14, size: 6.1, font: report.fonts.bold, color: MUTED });
    report.page.drawText(`${ptNumber(entry.value)} mm`, { x: x + 9, y: top - 32, size: 9.8, font: report.fonts.bold, color: INK });
  });
  return y - Math.ceil(entries.length / columns) * 50;
}

export async function buildClinicalAssessmentReportPdf(input: ClinicalAssessmentReportInput) {
  const renderStartedAt = performance.now();
  const history = orderedAssessmentHistory(input.assessments, input.targetAssessmentPublicId);
  const current = history.at(-1)!;
  const baseline = history[0];
  const isFirst = history.length === 1;
  const reportTitle = isFirst ? "Sua avaliação física" : "Sua evolução física";
  const report = await ProfessionalPdf.create({ reportName: isFirst ? "Relatório de Avaliação Física" : "Relatório de Evolução Física", versionLabel: `Avaliação ${ptDate(current.capturedAt)}`, issuedAt: current.capturedAt, logoBytes: input.logoBytes });

  report.label(isFirst ? "Seu ponto de partida" : periodLabel(baseline.capturedAt, current.capturedAt), { color: MUTED });
  report.move(22);
  report.text(reportTitle, { size: 29, lineHeight: 31, bold: true });
  report.text(`${input.patientName} - avaliação de ${ptDate(current.capturedAt)}`, { size: 11.5, lineHeight: 16, color: MUTED });
  report.move(10);
  report.y = drawIdentityBar(report, input, current, report.y);
  report.y = drawSectionHeading(report, isFirst ? "Composição corporal" : "O que mudou desde o início", isFirst ? ptDate(current.capturedAt) : `${ptDate(baseline.capturedAt)} a ${ptDate(current.capturedAt)}`, report.y);
  report.y = drawCompositionHero(report, current, baseline, isFirst, report.y);
  report.y = drawComparisonTable(report, history, report.y);
  report.page.drawText("As variações mostram somente a direção matemática. A interpretação clínica está na leitura abaixo.", { x: MARGIN, y: report.y, size: 7.4, font: report.fonts.regular, color: MUTED });
  report.y -= 17;
  drawProfessionalReading(report, input, input.professionalReading?.trim() || professionalReading(history), report.y);

  report.addPage();
  if (history.length > 1) {
    report.y = drawSectionHeading(report, "Linha de evolução", `${history.length} avaliações até ${ptDate(current.capturedAt)}`, report.y);
    const dates = history.map((point) => point.capturedAt);
    const chartHeight = 105;
    const chartWidth = (CONTENT_WIDTH - 9) / 2;
    const top = report.y;
    drawLineChart(report, "Peso corporal", history.map((point) => point.weightKg), dates, "kg", MARGIN, top, chartWidth, chartHeight);
    drawLineChart(report, "Gordura corporal", history.map((point) => point.bodyFatPct), dates, "%", MARGIN + chartWidth + 9, top, chartWidth, chartHeight);
    drawLineChart(report, "Massa gorda", history.map((point) => point.fatMassKg), dates, "kg", MARGIN, top - chartHeight - 9, chartWidth, chartHeight);
    drawLineChart(report, "Massa livre de gordura", history.map((point) => point.leanMassKg), dates, "kg", MARGIN + chartWidth + 9, top - chartHeight - 9, chartWidth, chartHeight);
    report.y = top - chartHeight * 2 - 25;
  }

  const side = current.measurementSide === "left" ? "lado esquerdo - centímetros" : current.measurementSide === "right" ? "lado direito - centímetros" : "centímetros";
  if (circumferenceOrder.some((key) => Number(current.circumferencesCm[key]) > 0)) {
    report.y = drawSectionHeading(report, "Circunferências", side, report.y);
    report.y = drawCircumferenceTable(report, history, report.y);
    report.page.drawText("Coxa nesta seção é circunferência; não é a dobra cutânea da coxa.", { x: MARGIN, y: report.y, size: 7.3, font: report.fonts.regular, color: MUTED });
    report.y -= 22;
  }

  if (skinfoldOrder.some((key) => Number(current.skinfoldsMm[key]) > 0)) {
    report.y = drawSectionHeading(report, "Dobras cutâneas", `milímetros - ${current.protocolCode === "pollock_7" ? "Pollock 7 dobras" : current.protocolCode}`, report.y);
    report.y = drawSkinfoldGrid(report, current, report.y);
  }
  const methodText = `Documento gerado pelo NutriFlow com os resultados estruturados da consulta. ${current.protocolCode === "pollock_7" ? "Pollock 7 dobras" : current.protocolCode}, versão ${current.protocolVersion}. Não há recálculo ou classificação clínica automática neste relatório.`;
  const methodLines = wrap(report.fonts.regular, methodText, 7.2, CONTENT_WIDTH);
  methodLines.forEach((line, index) => report.page.drawText(line, { x: MARGIN, y: 66 - index * 9, size: 7.2, font: report.fonts.regular, color: MUTED }));

  report.prepareForSave();
  const renderFinishedAt = performance.now();
  const pdfStartedAt = performance.now();
  const bytes = await report.save();
  input.onTiming?.(Object.freeze({
    assetsMs: report.assetsMs,
    renderMs: Math.max(0, renderFinishedAt - renderStartedAt - report.assetsMs),
    pdfMs: performance.now() - pdfStartedAt,
  }));
  return bytes;
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
    onTiming: input.onTiming,
  });
}

export const reportFormatting = Object.freeze({ ptDate, ptNumber, quantity, objectiveFrom, printablePlanMacros, mealMacrosLabel, planGeneralNotes, roundedDelta, changeLabel, orderedAssessmentHistory, professionalReading });
