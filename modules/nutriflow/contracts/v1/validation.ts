import {
  NUTRIFLOW_API_VERSION,
  NUTRIFLOW_ERROR_CODES,
  type NutriFlowApiError,
  type NutriFlowErrorCode,
} from "./errors.ts";
import type {
  CreateFoodPlanCommandV1,
  FoodPlanContentV1,
  FoodPlanDayV1,
  FoodPlanItemV1,
  FoodPlanMealV1,
  GetPublishedFoodPlanQueryV1,
  PublishedFoodPlanV1,
  PublishFoodPlanVersionCommandV1,
  SaveFoodPlanDraftCommandV1,
} from "./plans.ts";

const SAFE_ERROR_MESSAGES: Readonly<Record<NutriFlowErrorCode, string>> = Object.freeze({
  [NUTRIFLOW_ERROR_CODES.FEATURE_DISABLED]: "Recurso indisponível.",
  [NUTRIFLOW_ERROR_CODES.INVALID_INPUT]: "Os dados informados são inválidos.",
  [NUTRIFLOW_ERROR_CODES.UNAUTHENTICATED]: "Autenticação necessária.",
  [NUTRIFLOW_ERROR_CODES.NOT_FOUND]: "Recurso não encontrado.",
  [NUTRIFLOW_ERROR_CODES.VERSION_CONFLICT]: "O conteúdo foi atualizado em outro local.",
  [NUTRIFLOW_ERROR_CODES.FORBIDDEN]: "Acesso não autorizado.",
  [NUTRIFLOW_ERROR_CODES.ACCESS_EXPIRED]: "O acesso ao plano não está vigente.",
  [NUTRIFLOW_ERROR_CODES.IDEMPOTENCY_CONFLICT]: "A operação já foi processada com outros dados.",
  [NUTRIFLOW_ERROR_CODES.PUBLICATION_IMMUTABLE]: "Uma versão publicada não pode ser alterada.",
  [NUTRIFLOW_ERROR_CODES.INTERNAL_ERROR]: "Não foi possível concluir a operação.",
});

export class NutriFlowContractError extends Error {
  readonly errorCode = NUTRIFLOW_ERROR_CODES.INVALID_INPUT;
  readonly path: string;

  constructor(path: string) {
    super(`NUTRIFLOW_INVALID_CONTRACT:${path}`);
    this.name = "NutriFlowContractError";
    this.path = path;
  }
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new NutriFlowContractError(path);
  }
  return value as Record<string, unknown>;
}

function textValue(value: unknown, path: string, max = 200) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) {
    throw new NutriFlowContractError(path);
  }
  return value.trim();
}

function nullableText(value: unknown, path: string, max = 2000): string | null {
  if (value === null) return null;
  return textValue(value, path, max);
}

function integer(value: unknown, path: string, minimum = 0) {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new NutriFlowContractError(path);
  }
  return value as number;
}

function apiVersion(value: unknown) {
  if (value !== NUTRIFLOW_API_VERSION) {
    throw new NutriFlowContractError("apiVersion");
  }
  return NUTRIFLOW_API_VERSION;
}

function source(value: unknown, path: string): FoodPlanItemV1["source"] {
  const input = object(value, path);
  if (!(["manual", "food", "recipe"] as const).includes(input.type as never)) {
    throw new NutriFlowContractError(`${path}.type`);
  }
  return Object.freeze({
    type: input.type as "manual" | "food" | "recipe",
    publicId: input.publicId === null ? null : textValue(input.publicId, `${path}.publicId`),
    revisionNumber:
      input.revisionNumber === null
        ? null
        : integer(input.revisionNumber, `${path}.revisionNumber`, 1),
  });
}

function item(value: unknown, path: string): FoodPlanItemV1 {
  const input = object(value, path);
  const unit = object(input.unit, `${path}.unit`);
  return Object.freeze({
    publicId: textValue(input.publicId, `${path}.publicId`),
    source: source(input.source, `${path}.source`),
    displayName: textValue(input.displayName, `${path}.displayName`),
    quantityMilli: integer(input.quantityMilli, `${path}.quantityMilli`, 1),
    unit: Object.freeze({
      publicId: textValue(unit.publicId, `${path}.unit.publicId`),
      code: textValue(unit.code, `${path}.unit.code`, 32),
      label: textValue(unit.label, `${path}.unit.label`, 80),
    }),
    preparation: nullableText(input.preparation, `${path}.preparation`, 500),
    notes: nullableText(input.notes, `${path}.notes`, 1000),
    sortOrder: integer(input.sortOrder, `${path}.sortOrder`),
  });
}

function day(value: unknown, path: string): FoodPlanDayV1 {
  const input = object(value, path);
  return Object.freeze({
    publicId: textValue(input.publicId, `${path}.publicId`),
    label: textValue(input.label, `${path}.label`, 120),
    dayIndex: input.dayIndex === null ? null : integer(input.dayIndex, `${path}.dayIndex`),
    sortOrder: integer(input.sortOrder, `${path}.sortOrder`),
  });
}

function meal(value: unknown, path: string): FoodPlanMealV1 {
  const input = object(value, path);
  if (!Array.isArray(input.items)) throw new NutriFlowContractError(`${path}.items`);
  return Object.freeze({
    publicId: textValue(input.publicId, `${path}.publicId`),
    planDayPublicId:
      input.planDayPublicId === null
        ? null
        : textValue(input.planDayPublicId, `${path}.planDayPublicId`),
    title: textValue(input.title, `${path}.title`, 120),
    scheduledTime:
      input.scheduledTime === null
        ? null
        : textValue(input.scheduledTime, `${path}.scheduledTime`, 5),
    instructions: nullableText(input.instructions, `${path}.instructions`, 2000),
    sortOrder: integer(input.sortOrder, `${path}.sortOrder`),
    items: Object.freeze(input.items.map((entry, index) => item(entry, `${path}.items.${index}`))),
  });
}

export function parseFoodPlanContentV1(value: unknown): FoodPlanContentV1 {
  const input = object(value, "content");
  if (input.schemaVersion !== 1) throw new NutriFlowContractError("content.schemaVersion");
  if (!Array.isArray(input.days)) throw new NutriFlowContractError("content.days");
  if (!Array.isArray(input.meals)) throw new NutriFlowContractError("content.meals");
  if (!Array.isArray(input.notes)) throw new NutriFlowContractError("content.notes");
  return Object.freeze({
    schemaVersion: 1,
    days: Object.freeze(input.days.map((entry, index) => day(entry, `content.days.${index}`))),
    meals: Object.freeze(input.meals.map((entry, index) => meal(entry, `content.meals.${index}`))),
    notes: Object.freeze(
      input.notes.map((entry, index) => {
        const note = object(entry, `content.notes.${index}`);
        if (!(["general", "preparation", "clinical", "patient"] as const).includes(note.kind as never)) {
          throw new NutriFlowContractError(`content.notes.${index}.kind`);
        }
        return Object.freeze({
          publicId: textValue(note.publicId, `content.notes.${index}.publicId`),
          mealPublicId:
            note.mealPublicId === null
              ? null
              : textValue(note.mealPublicId, `content.notes.${index}.mealPublicId`),
          kind: note.kind as "general" | "preparation" | "clinical" | "patient",
          content: textValue(note.content, `content.notes.${index}.content`, 4000),
          sortOrder: integer(note.sortOrder, `content.notes.${index}.sortOrder`),
        });
      }),
    ),
  });
}

export function parseCreateFoodPlanCommandV1(value: unknown): CreateFoodPlanCommandV1 {
  const input = object(value, "command");
  return Object.freeze({
    apiVersion: apiVersion(input.apiVersion),
    clientId: integer(input.clientId, "clientId", 1),
    title: textValue(input.title, "title", 160),
    correlationId: textValue(input.correlationId, "correlationId", 128),
  });
}

export function parseSaveFoodPlanDraftCommandV1(value: unknown): SaveFoodPlanDraftCommandV1 {
  const input = object(value, "command");
  return Object.freeze({
    apiVersion: apiVersion(input.apiVersion),
    planPublicId: textValue(input.planPublicId, "planPublicId"),
    planVersionPublicId: textValue(input.planVersionPublicId, "planVersionPublicId"),
    expectedRevision: integer(input.expectedRevision, "expectedRevision", 1),
    title: textValue(input.title, "title", 160),
    planNotes: nullableText(input.planNotes, "planNotes", 4000),
    content: parseFoodPlanContentV1(input.content),
    correlationId: textValue(input.correlationId, "correlationId", 128),
  });
}

export function parsePublishFoodPlanVersionCommandV1(
  value: unknown,
): PublishFoodPlanVersionCommandV1 {
  const input = object(value, "command");
  return Object.freeze({
    apiVersion: apiVersion(input.apiVersion),
    planPublicId: textValue(input.planPublicId, "planPublicId"),
    planVersionPublicId: textValue(input.planVersionPublicId, "planVersionPublicId"),
    expectedRevision: integer(input.expectedRevision, "expectedRevision", 1),
    correlationId: textValue(input.correlationId, "correlationId", 128),
  });
}

export function parseGetPublishedFoodPlanQueryV1(value: unknown): GetPublishedFoodPlanQueryV1 {
  const input = object(value, "query");
  return Object.freeze({
    apiVersion: apiVersion(input.apiVersion),
    publicationPublicId: textValue(input.publicationPublicId, "publicationPublicId"),
    correlationId: textValue(input.correlationId, "correlationId", 128),
  });
}

export function parsePublishedFoodPlanV1(value: unknown): PublishedFoodPlanV1 {
  const input = object(value, "publishedPlan");
  return Object.freeze({
    apiVersion: apiVersion(input.apiVersion),
    publicationPublicId: textValue(input.publicationPublicId, "publicationPublicId"),
    planPublicId: textValue(input.planPublicId, "planPublicId"),
    planVersionPublicId: textValue(input.planVersionPublicId, "planVersionPublicId"),
    clientId: integer(input.clientId, "clientId", 1),
    versionNumber: integer(input.versionNumber, "versionNumber", 1),
    contentHash: textValue(input.contentHash, "contentHash", 200),
    publishedAt: textValue(input.publishedAt, "publishedAt", 40),
    content: parseFoodPlanContentV1(input.content),
  });
}

export function createNutriFlowApiErrorV1(
  errorCode: NutriFlowErrorCode,
  correlationId: string,
  details?: Readonly<Record<string, string | number | boolean | null>>,
): NutriFlowApiError {
  if (!(errorCode in SAFE_ERROR_MESSAGES)) throw new NutriFlowContractError("errorCode");
  return Object.freeze({
    apiVersion: NUTRIFLOW_API_VERSION,
    errorCode,
    message: SAFE_ERROR_MESSAGES[errorCode],
    correlationId: textValue(correlationId, "correlationId", 128),
    ...(details ? { details: Object.freeze({ ...details }) } : {}),
  });
}
