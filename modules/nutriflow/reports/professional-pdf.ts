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
const GREEN = rgb(0.12, 0.56, 0.34);

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
  circumferencesCm: Readonly<Record<string, number>>;
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

function deltaText(initial: number, current: number, unit: string, percentage = false) {
  const difference = current - initial;
  const signal = difference > 0 ? "+" : difference < 0 ? "-" : "";
  const absolute = `${signal}${ptNumber(Math.abs(difference))} ${unit}`;
  const percent = percentage && initial !== 0 ? ` (${difference >= 0 ? "+" : "-"}${ptNumber(Math.abs(difference / initial * 100))}%)` : "";
  return `${absolute}${percent}`;
}

function executiveSummary(initial: ClinicalAssessmentReportPoint, current: ClinicalAssessmentReportPoint) {
  const weight = current.weightKg - initial.weightKg;
  const fat = current.bodyFatPct - initial.bodyFatPct;
  const lean = current.leanMassKg - initial.leanMassKg;
  const sentence = (label: string, value: number, unit: string) => `${label} ${value === 0 ? "permaneceu estável" : value > 0 ? `aumentou ${ptNumber(value)} ${unit}` : `reduziu ${ptNumber(Math.abs(value))} ${unit}`}`;
  return `No período comparado, ${sentence("o peso", weight, "kg")}, ${sentence("o percentual de gordura", fat, "pontos percentuais")} e ${sentence("a massa livre de gordura", lean, "kg")}. Estes dados descrevem as mudanças observadas e devem ser interpretados em conjunto com o acompanhamento clínico.`;
}

function drawComparisonTable(report: ProfessionalPdf, rows: readonly Readonly<{ label: string; initial: number; current: number; unit: string; percentage?: boolean }>[]) {
  const widths = [185, 92, 92, 142];
  const headers = ["INDICADOR", "INICIAL", "ATUAL", "DIFERENÇA"];
  report.ensure(28 + rows.length * 28);
  let y = report.y;
  let x = MARGIN;
  headers.forEach((header, index) => {
    report.page.drawRectangle({ x, y: y - 22, width: widths[index], height: 22, color: INK });
    report.page.drawText(header, { x: x + 8, y: y - 14, size: 6.6, font: report.fonts.bold, color: rgb(1, 1, 1) });
    x += widths[index];
  });
  y -= 22;
  rows.forEach((row, rowIndex) => {
    x = MARGIN;
    const fill = rowIndex % 2 ? rgb(1, 1, 1) : PAPER;
    const values = [row.label, `${ptNumber(row.initial)} ${row.unit}`, `${ptNumber(row.current)} ${row.unit}`, deltaText(row.initial, row.current, row.unit, row.percentage)];
    values.forEach((value, index) => {
      report.page.drawRectangle({ x, y: y - 27, width: widths[index], height: 27, color: fill, borderColor: BORDER, borderWidth: 0.35 });
      report.page.drawText(safeText(value), { x: x + 8, y: y - 17, size: index === 0 ? 8.3 : 8, font: index === 0 || index === 3 ? report.fonts.bold : report.fonts.regular, color: INK });
      x += widths[index];
    });
    y -= 27;
  });
  report.y = y - 14;
}

function drawLineChart(report: ProfessionalPdf, label: string, values: readonly number[], dates: readonly string[], unit: string, x: number, y: number, width: number, height: number) {
  report.page.drawRectangle({ x, y: y - height, width, height, color: PAPER, borderColor: BORDER, borderWidth: 0.5 });
  report.page.drawText(label, { x: x + 12, y: y - 17, size: 8, font: report.fonts.bold, color: INK });
  const graphX = x + 14;
  const graphY = y - height + 26;
  const graphWidth = width - 28;
  const graphHeight = height - 54;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const points = values.map((value, index) => ({ x: graphX + (values.length === 1 ? graphWidth / 2 : index / (values.length - 1) * graphWidth), y: graphY + (value - min) / span * graphHeight }));
  report.page.drawLine({ start: { x: graphX, y: graphY }, end: { x: graphX + graphWidth, y: graphY }, thickness: 0.5, color: BORDER });
  points.forEach((point, index) => {
    if (index) report.page.drawLine({ start: points[index - 1], end: point, thickness: 1.5, color: INK });
    report.page.drawCircle({ x: point.x, y: point.y, size: 2.8, color: BRAND_YELLOW, borderColor: INK, borderWidth: 0.7 });
  });
  report.page.drawText(`${ptNumber(values[0])} ${unit}`, { x: graphX, y: y - height + 10, size: 6.8, font: report.fonts.regular, color: MUTED });
  const last = `${ptNumber(values.at(-1)!)} ${unit}`;
  report.page.drawText(last, { x: graphX + graphWidth - report.fonts.regular.widthOfTextAtSize(last, 6.8), y: y - height + 10, size: 6.8, font: report.fonts.regular, color: MUTED });
  void dates;
}

async function embedPhoto(report: ProfessionalPdf, photo: ClinicalReportPhoto) {
  try {
    if (photo.contentType === "image/png") return await report.doc.embedPng(photo.bytes);
    if (photo.contentType === "image/jpeg" || photo.contentType === "image/jpg") return await report.doc.embedJpg(photo.bytes);
  } catch { /* invalid image is represented by a placeholder */ }
  return null;
}

export async function buildClinicalEvolutionReportPdf(input: ClinicalEvolutionReportInput) {
  const issuedAt = input.current.capturedAt;
  const report = await ProfessionalPdf.create({ reportName: "Evolução clínica", versionLabel: `Comparativo ${input.initial.publicId.slice(-6)}-${input.current.publicId.slice(-6)}`, issuedAt, logoBytes: input.logoBytes });
  report.label("Relatório comparativo", { color: rgb(0.55, 0.5, 0) });
  report.move(7);
  report.text("Evolução clínica", { size: 31, lineHeight: 34, bold: true });
  report.text(input.patientName, { size: 15, lineHeight: 20, color: MUTED });
  report.move(10);
  report.infoGrid([
    { label: "Paciente", value: input.patientName },
    { label: "Nutricionista", value: `${input.nutritionistName} - ${input.nutritionistRegistration}` },
    { label: "Avaliações comparadas", value: `${ptDate(input.initial.capturedAt)} a ${ptDate(input.current.capturedAt)}` },
    { label: "Protocolo", value: `${input.current.protocolCode === "pollock_7" ? "Pollock 7 dobras" : input.current.protocolCode} - versão ${input.current.protocolVersion}` },
  ]);
  report.move(10);

  report.section("Resumo executivo", "Principais resultados");
  const summary = executiveSummary(input.initial, input.current);
  const summaryLines = wrap(report.fonts.regular, summary, 10, CONTENT_WIDTH - 28);
  const summaryCard = report.card(30 + summaryLines.length * 14, PALE_YELLOW);
  report.y = summaryCard.top;
  report.text(summary, { x: summaryCard.x, width: summaryCard.width, size: 10, lineHeight: 14 });
  report.y = summaryCard.bottom - 12;

  report.section("Composição corporal", "Comparação");
  drawComparisonTable(report, [
    { label: "Peso", initial: input.initial.weightKg, current: input.current.weightKg, unit: "kg", percentage: true },
    { label: "IMC", initial: input.initial.bmi, current: input.current.bmi, unit: "kg/m2", percentage: true },
    { label: "Percentual de gordura", initial: input.initial.bodyFatPct, current: input.current.bodyFatPct, unit: "p.p." },
    { label: "Massa gorda", initial: input.initial.fatMassKg, current: input.current.fatMassKg, unit: "kg", percentage: true },
    { label: "Massa livre de gordura", initial: input.initial.leanMassKg, current: input.current.leanMassKg, unit: "kg", percentage: true },
    { label: "Massa muscular estimada", initial: input.initial.leanMassKg, current: input.current.leanMassKg, unit: "kg", percentage: true },
  ]);

  const circumferenceKeys = Object.keys(input.current.circumferencesCm).filter((key) => Number(input.current.circumferencesCm[key]) > 0 && Number(input.initial.circumferencesCm[key]) > 0);
  if (circumferenceKeys.length) {
    report.ensure(58 + circumferenceKeys.length * 28);
    report.section("Circunferências", "Medidas antropométricas");
    drawComparisonTable(report, circumferenceKeys.map((key) => ({ label: circumferenceLabels[key] ?? key, initial: Number(input.initial.circumferencesCm[key]), current: Number(input.current.circumferencesCm[key]), unit: "cm", percentage: true })));
  }

  const initialPhotos = input.initialPhotos ?? [];
  const currentPhotos = input.currentPhotos ?? [];
  if (initialPhotos.length && currentPhotos.length) {
    report.section("Comparativo fotográfico", "Registro evolutivo");
    for (const angle of ["front", "side", "back"] as const) {
      const before = initialPhotos.find((photo) => photo.angle === angle);
      const after = currentPhotos.find((photo) => photo.angle === angle);
      if (!before || !after) continue;
      report.ensure(230);
      const beforeImage = await embedPhoto(report, before);
      const afterImage = await embedPhoto(report, after);
      const label = ({ front: "Frente", side: "Lado", back: "Costas" } as const)[angle];
      report.text(label, { size: 11, lineHeight: 16, bold: true });
      const top = report.y;
      const boxWidth = (CONTENT_WIDTH - 12) / 2;
      const boxHeight = 190;
      [beforeImage, afterImage].forEach((image, index) => {
        const x = MARGIN + index * (boxWidth + 12);
        report.page.drawRectangle({ x, y: top - boxHeight, width: boxWidth, height: boxHeight, color: PAPER, borderColor: BORDER, borderWidth: 0.5 });
        if (image) {
          const scale = Math.min((boxWidth - 16) / image.width, (boxHeight - 30) / image.height);
          const width = image.width * scale;
          const height = image.height * scale;
          report.page.drawImage(image, { x: x + (boxWidth - width) / 2, y: top - 12 - height, width, height });
        } else {
          report.page.drawText("Imagem indisponível para este formato", { x: x + 18, y: top - boxHeight / 2, size: 8, font: report.fonts.regular, color: MUTED });
        }
        report.page.drawText(index === 0 ? `Inicial - ${ptDate(input.initial.capturedAt)}` : `Atual - ${ptDate(input.current.capturedAt)}`, { x: x + 10, y: top - boxHeight + 9, size: 7.2, font: report.fonts.bold, color: MUTED });
      });
      report.y = top - boxHeight - 14;
    }
  }

  report.section("Gráficos de evolução", "Trajetória clínica");
  const trajectory = input.trajectory.length >= 2 ? input.trajectory : [input.initial, input.current];
  const dates = trajectory.map((point) => point.capturedAt);
  const graphHeight = 122;
  const graphWidth = (CONTENT_WIDTH - 10) / 2;
  report.ensure(graphHeight * 2 + 34);
  let chartTop = report.y;
  drawLineChart(report, "Peso", trajectory.map((point) => point.weightKg), dates, "kg", MARGIN, chartTop, graphWidth, graphHeight);
  drawLineChart(report, "% de gordura", trajectory.map((point) => point.bodyFatPct), dates, "%", MARGIN + graphWidth + 10, chartTop, graphWidth, graphHeight);
  chartTop -= graphHeight + 10;
  drawLineChart(report, "Massa livre de gordura", trajectory.map((point) => point.leanMassKg), dates, "kg", MARGIN, chartTop, graphWidth, graphHeight);
  if (circumferenceKeys.length) {
    const key = circumferenceKeys[0];
    const circumferenceTrajectory = trajectory.filter((point) => Number(point.circumferencesCm[key]) > 0);
    drawLineChart(report, `Circunferência - ${circumferenceLabels[key] ?? key}`, circumferenceTrajectory.map((point) => Number(point.circumferencesCm[key])), circumferenceTrajectory.map((point) => point.capturedAt), "cm", MARGIN + graphWidth + 10, chartTop, graphWidth, graphHeight);
  }
  report.y = chartTop - graphHeight - 16;

  report.ensure(155);
  report.section("Síntese do período", "Interpretação objetiva");
  const closingLines = wrap(report.fonts.regular, summary, 10, CONTENT_WIDTH - 28);
  const closingCard = report.card(31 + closingLines.length * 15, PALE_YELLOW);
  report.y = closingCard.top;
  report.text(summary, { x: closingCard.x, width: closingCard.width, size: 10, lineHeight: 15, color: INK });
  report.y = closingCard.bottom - 22;
  report.text("Este relatório apresenta uma comparação objetiva entre avaliações e não substitui a interpretação clínica individualizada realizada pelo nutricionista.", { size: 8.5, lineHeight: 12, oblique: true, color: MUTED });
  return report.finalize();
}

export const reportFormatting = Object.freeze({ ptDate, ptNumber, quantity, objectiveFrom, executiveSummary });
