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
import type { SearchFoodCatalogQueryV1 } from "./catalog.ts";
import { TRAINING_EXERCISE_LIBRARY_MAX_RESULTS, type SearchTrainingExerciseLibraryQueryV1 } from "./training.ts";
import type {
  ConfigureTrainingEntitlementCommandV1,
  PublishTrainingRoutineCommandV1,
  SaveTrainingRoutineDraftCommandV1,
  TrainingPrescriptionMetricV1,
  TrainingRoutineContentV1,
  TrainingWeekday,
} from "./training.ts";
import type {
  ArchiveReusableContentCommandV1,
  ReusableContentItemV1,
  SaveMealTemplateCommandV1,
  SaveRecipeCommandV1,
  SearchReusableContentQueryV1,
} from "./reusable-content.ts";
import type { RecordPatientPortalViewCommandV1 } from "./patient-portal.ts";

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

function optionalSearchText(value: unknown, path: string, max: number) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string" || value.length > max) throw new NutriFlowContractError(path);
  return value.trim();
}

function integer(value: unknown, path: string, minimum = 0) {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new NutriFlowContractError(path);
  }
  return value as number;
}

function boundedInteger(value: unknown, path: string, minimum: number, maximum: number) {
  const parsed = integer(value, path, minimum);
  if (parsed > maximum) throw new NutriFlowContractError(path);
  return parsed;
}

function booleanValue(value: unknown, path: string) {
  if (typeof value !== "boolean") throw new NutriFlowContractError(path);
  return value;
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
  const rawMacros = input.macros;
  const macros = rawMacros && typeof rawMacros === "object" && !Array.isArray(rawMacros)
    ? Object.freeze(Object.fromEntries(["energyKcal", "protein", "carbohydrate", "fat", "fiber"].map((key) => [key, typeof (rawMacros as Record<string, unknown>)[key] === "number" ? (rawMacros as Record<string, number>)[key] : null])))
    : null;
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
    macros,
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

function substitutionGroup(value: unknown, path: string) {
  const group = object(value, path);
  if (!Array.isArray(group.options)) throw new NutriFlowContractError(`${path}.options`);
  return Object.freeze({
    publicId: textValue(group.publicId, `${path}.publicId`),
    mealItemPublicId: group.mealItemPublicId === null || group.mealItemPublicId === undefined ? null : textValue(group.mealItemPublicId, `${path}.mealItemPublicId`),
    title: textValue(group.title, `${path}.title`, 160),
    ruleCode: "choose_one" as const,
    notes: nullableText(group.notes, `${path}.notes`, 1000),
    sortOrder: integer(group.sortOrder, `${path}.sortOrder`),
    options: Object.freeze(group.options.map((option, optionIndex) => item(option, `${path}.options.${optionIndex}`))),
  });
}

function meal(value: unknown, path: string): FoodPlanMealV1 {
  const input = object(value, path);
  if (!Array.isArray(input.items)) throw new NutriFlowContractError(`${path}.items`);
  const sourceTemplate = input.sourceTemplate === undefined || input.sourceTemplate === null ? null : object(input.sourceTemplate, `${path}.sourceTemplate`);
  const substitutions = Array.isArray(input.substitutions) ? input.substitutions.map((entry, index) => substitutionGroup(entry, `${path}.substitutions.${index}`)) : [];
  const options = input.options === undefined ? undefined : (() => {
    if (!Array.isArray(input.options) || input.options.length < 1 || input.options.length > 3) throw new NutriFlowContractError(`${path}.options`);
    return Object.freeze(input.options.map((entry, optionIndex) => {
      const option = object(entry, `${path}.options.${optionIndex}`);
      if (!Array.isArray(option.items)) throw new NutriFlowContractError(`${path}.options.${optionIndex}.items`);
      const optionSubstitutions = Array.isArray(option.substitutions)
        ? option.substitutions.map((group, groupIndex) => substitutionGroup(group, `${path}.options.${optionIndex}.substitutions.${groupIndex}`))
        : [];
      return Object.freeze({
        publicId: textValue(option.publicId, `${path}.options.${optionIndex}.publicId`),
        label: textValue(option.label, `${path}.options.${optionIndex}.label`, 80),
        sortOrder: integer(option.sortOrder, `${path}.options.${optionIndex}.sortOrder`),
        items: Object.freeze(option.items.map((entryItem, itemIndex) => item(entryItem, `${path}.options.${optionIndex}.items.${itemIndex}`))),
        substitutions: Object.freeze(optionSubstitutions),
      });
    }));
  })();
  const primaryItems = options?.[0]?.items ?? Object.freeze(input.items.map((entry, index) => item(entry, `${path}.items.${index}`)));
  const primarySubstitutions = options?.[0]?.substitutions ?? Object.freeze(substitutions);
  const rawMacros = input.macros;
  const macros = rawMacros && typeof rawMacros === "object" && !Array.isArray(rawMacros)
    ? Object.freeze(Object.fromEntries(["energyKcal", "protein", "carbohydrate", "fat", "fiber"].map((key) => [key, typeof (rawMacros as Record<string, unknown>)[key] === "number" ? (rawMacros as Record<string, number>)[key] : null])))
    : null;
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
    sourceTemplate: sourceTemplate ? Object.freeze({
      publicId: textValue(sourceTemplate.publicId, `${path}.sourceTemplate.publicId`),
      versionNumber: integer(sourceTemplate.versionNumber, `${path}.sourceTemplate.versionNumber`, 1),
    }) : null,
    sortOrder: integer(input.sortOrder, `${path}.sortOrder`),
    items: Object.freeze(primaryItems),
    substitutions: Object.freeze(primarySubstitutions),
    ...(options ? { options } : {}),
    macros,
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

export function parseSearchFoodCatalogQueryV1(value: unknown): SearchFoodCatalogQueryV1 {
  const input = object(value, "query");
  return Object.freeze({
    apiVersion: apiVersion(input.apiVersion),
    query: optionalSearchText(input.query, "query", 120),
    categoryCode: input.categoryCode === undefined || input.categoryCode === null || input.categoryCode === "" ? null : textValue(input.categoryCode, "categoryCode", 80),
    limit: input.limit === undefined ? 12 : boundedInteger(input.limit, "limit", 1, 25),
    correlationId: textValue(input.correlationId, "correlationId", 128),
  });
}

/** Bounds training library queries before they reach D1. */
export function parseSearchTrainingExerciseLibraryQueryV1(value: unknown): SearchTrainingExerciseLibraryQueryV1 {
  const input = object(value, "query");
  return Object.freeze({
    apiVersion: apiVersion(input.apiVersion),
    query: optionalSearchText(input.query, "query", 120),
    muscleGroup: input.muscleGroup === undefined || input.muscleGroup === null || input.muscleGroup === ""
      ? null
      : textValue(input.muscleGroup, "muscleGroup", 80),
    limit: input.limit === undefined ? 12 : boundedInteger(input.limit, "limit", 1, TRAINING_EXERCISE_LIBRARY_MAX_RESULTS),
    correlationId: textValue(input.correlationId, "correlationId", 128),
  });
}

function nullableNonEmptyText(value: unknown, path: string, max = 2000) {
  return value === null || value === undefined || value === "" ? null : textValue(value, path, max);
}

function trainingMetric(value: unknown, path: string): TrainingPrescriptionMetricV1 {
  const input = object(value, path);
  const repetitions = input.repetitions === null || input.repetitions === undefined
    ? null
    : (() => {
      const range = object(input.repetitions, `${path}.repetitions`);
      return Object.freeze({
        min: boundedInteger(range.min, `${path}.repetitions.min`, 1, 999),
        max: boundedInteger(range.max, `${path}.repetitions.max`, 1, 999),
      });
    })();
  if (repetitions && repetitions.max < repetitions.min) throw new NutriFlowContractError(`${path}.repetitions.max`);
  const durationSeconds = input.durationSeconds === null || input.durationSeconds === undefined ? null : boundedInteger(input.durationSeconds, `${path}.durationSeconds`, 1, 7200);
  if (!repetitions && !durationSeconds) throw new NutriFlowContractError(`${path}.execution`);
  return Object.freeze({
    sets: input.sets === null || input.sets === undefined ? null : boundedInteger(input.sets, `${path}.sets`, 1, 99),
    repetitions,
    durationSeconds,
    restSeconds: input.restSeconds === null || input.restSeconds === undefined ? null : boundedInteger(input.restSeconds, `${path}.restSeconds`, 0, 3600),
    notes: nullableNonEmptyText(input.notes, `${path}.notes`, 1000),
  });
}

export function parseTrainingRoutineContentV1(value: unknown): TrainingRoutineContentV1 {
  const input = object(value, "content");
  if (input.schemaVersion !== 1 || !Array.isArray(input.days) || input.days.length > 7) throw new NutriFlowContractError("content.days");
  const weekdays = new Set<string>();
  const days = input.days.map((entry, dayIndex) => {
    const day = object(entry, `content.days.${dayIndex}`);
    if (!( ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).includes(day.weekday as never)) throw new NutriFlowContractError(`content.days.${dayIndex}.weekday`);
    const weekday = day.weekday as TrainingWeekday;
    if (weekdays.has(weekday)) throw new NutriFlowContractError(`content.days.${dayIndex}.weekday`);
    weekdays.add(weekday);
    if (!Array.isArray(day.muscleGroups) || day.muscleGroups.length > 8) throw new NutriFlowContractError(`content.days.${dayIndex}.muscleGroups`);
    const groups = day.muscleGroups.map((groupValue, groupIndex) => {
      const group = object(groupValue, `content.days.${dayIndex}.muscleGroups.${groupIndex}`);
      if (!Array.isArray(group.exercises) || group.exercises.length === 0 || group.exercises.length > 30) throw new NutriFlowContractError(`content.days.${dayIndex}.muscleGroups.${groupIndex}.exercises`);
      return Object.freeze({
        publicId: textValue(group.publicId, `content.days.${dayIndex}.muscleGroups.${groupIndex}.publicId`),
        name: textValue(group.name, `content.days.${dayIndex}.muscleGroups.${groupIndex}.name`, 80),
        sortOrder: boundedInteger(group.sortOrder, `content.days.${dayIndex}.muscleGroups.${groupIndex}.sortOrder`, 0, 99),
        exercises: Object.freeze(group.exercises.map((exerciseValue, exerciseIndex) => {
          const exercise = object(exerciseValue, `content.days.${dayIndex}.muscleGroups.${groupIndex}.exercises.${exerciseIndex}`);
          const snapshot = object(exercise.exercise, `content.days.${dayIndex}.muscleGroups.${groupIndex}.exercises.${exerciseIndex}.exercise`);
          const mediaKind = snapshot.mediaKind;
          if (mediaKind !== null && mediaKind !== "video" && mediaKind !== "gif") throw new NutriFlowContractError(`content.days.${dayIndex}.muscleGroups.${groupIndex}.exercises.${exerciseIndex}.exercise.mediaKind`);
          return Object.freeze({
            publicId: textValue(exercise.publicId, `content.days.${dayIndex}.muscleGroups.${groupIndex}.exercises.${exerciseIndex}.publicId`),
            exercise: Object.freeze({
              publicId: textValue(snapshot.publicId, `content.days.${dayIndex}.muscleGroups.${groupIndex}.exercises.${exerciseIndex}.exercise.publicId`),
              name: textValue(snapshot.name, `content.days.${dayIndex}.muscleGroups.${groupIndex}.exercises.${exerciseIndex}.exercise.name`, 160),
              primaryMuscleGroup: textValue(snapshot.primaryMuscleGroup, `content.days.${dayIndex}.muscleGroups.${groupIndex}.exercises.${exerciseIndex}.exercise.primaryMuscleGroup`, 80),
              instructions: nullableNonEmptyText(snapshot.instructions, `content.days.${dayIndex}.muscleGroups.${groupIndex}.exercises.${exerciseIndex}.exercise.instructions`, 2000),
              mediaPublicId: nullableNonEmptyText(snapshot.mediaPublicId, `content.days.${dayIndex}.muscleGroups.${groupIndex}.exercises.${exerciseIndex}.exercise.mediaPublicId`, 200),
              posterObjectKey: nullableNonEmptyText(snapshot.posterObjectKey, `content.days.${dayIndex}.muscleGroups.${groupIndex}.exercises.${exerciseIndex}.exercise.posterObjectKey`, 600),
              mediaObjectKey: nullableNonEmptyText(snapshot.mediaObjectKey, `content.days.${dayIndex}.muscleGroups.${groupIndex}.exercises.${exerciseIndex}.exercise.mediaObjectKey`, 600),
              mediaKind: mediaKind as "video" | "gif" | null,
            }),
            prescription: trainingMetric(exercise.prescription, `content.days.${dayIndex}.muscleGroups.${groupIndex}.exercises.${exerciseIndex}.prescription`),
            sortOrder: boundedInteger(exercise.sortOrder, `content.days.${dayIndex}.muscleGroups.${groupIndex}.exercises.${exerciseIndex}.sortOrder`, 0, 99),
          });
        })),
      });
    });
    return Object.freeze({ weekday, muscleGroups: Object.freeze(groups) });
  });
  return Object.freeze({ schemaVersion: 1, days: Object.freeze(days) });
}

export function parseConfigureTrainingEntitlementCommandV1(value: unknown): ConfigureTrainingEntitlementCommandV1 {
  const input = object(value, "command");
  return Object.freeze({ apiVersion: apiVersion(input.apiVersion), clientId: integer(input.clientId, "clientId", 1), active: booleanValue(input.active, "active"), reason: nullableNonEmptyText(input.reason, "reason", 1000), correlationId: textValue(input.correlationId, "correlationId", 128) });
}

export function parseSaveTrainingRoutineDraftCommandV1(value: unknown): SaveTrainingRoutineDraftCommandV1 {
  const input = object(value, "command");
  return Object.freeze({ apiVersion: apiVersion(input.apiVersion), routinePublicId: textValue(input.routinePublicId, "routinePublicId"), routineVersionPublicId: textValue(input.routineVersionPublicId, "routineVersionPublicId"), expectedRevision: integer(input.expectedRevision, "expectedRevision", 1), title: textValue(input.title, "title", 160), content: parseTrainingRoutineContentV1(input.content), correlationId: textValue(input.correlationId, "correlationId", 128) });
}

export function parsePublishTrainingRoutineCommandV1(value: unknown): PublishTrainingRoutineCommandV1 {
  const input = object(value, "command");
  return Object.freeze({ apiVersion: apiVersion(input.apiVersion), routinePublicId: textValue(input.routinePublicId, "routinePublicId"), routineVersionPublicId: textValue(input.routineVersionPublicId, "routineVersionPublicId"), expectedRevision: integer(input.expectedRevision, "expectedRevision", 1), correlationId: textValue(input.correlationId, "correlationId", 128) });
}

function reusableItem(value: unknown, path: string): ReusableContentItemV1 {
  return item(value, path);
}

export function parseSearchReusableContentQueryV1(value: unknown): SearchReusableContentQueryV1 {
  const input = object(value, "query");
  return Object.freeze({
    apiVersion: apiVersion(input.apiVersion),
    query: optionalSearchText(input.query, "query", 120),
    limit: input.limit === undefined ? 12 : boundedInteger(input.limit, "limit", 1, 25),
    correlationId: textValue(input.correlationId, "correlationId", 128),
  });
}

export function parseSaveMealTemplateCommandV1(value: unknown): SaveMealTemplateCommandV1 {
  const input = object(value, "command");
  if (!Array.isArray(input.items) || input.items.length > 80) throw new NutriFlowContractError("items");
  return Object.freeze({
    apiVersion: apiVersion(input.apiVersion),
    templatePublicId: input.templatePublicId === null || input.templatePublicId === undefined ? null : textValue(input.templatePublicId, "templatePublicId"),
    name: textValue(input.name, "name", 160),
    suggestedTime: input.suggestedTime === null || input.suggestedTime === "" ? null : textValue(input.suggestedTime, "suggestedTime", 5),
    instructions: nullableText(input.instructions, "instructions", 4000),
    items: Object.freeze(input.items.map((entry, index) => reusableItem(entry, `items.${index}`))),
    release: booleanValue(input.release, "release"),
    correlationId: textValue(input.correlationId, "correlationId", 128),
  });
}

export function parseSaveRecipeCommandV1(value: unknown): SaveRecipeCommandV1 {
  const input = object(value, "command");
  const yieldUnit = object(input.yieldUnit, "yieldUnit");
  if (!Array.isArray(input.ingredients) || input.ingredients.length === 0 || input.ingredients.length > 80) throw new NutriFlowContractError("ingredients");
  const ingredients = input.ingredients.map((entry, index) => reusableItem(entry, `ingredients.${index}`));
  if (ingredients.some((entry) => entry.source.type !== "food" || !entry.source.publicId || !entry.source.revisionNumber)) throw new NutriFlowContractError("ingredients.source");
  return Object.freeze({
    apiVersion: apiVersion(input.apiVersion),
    recipePublicId: input.recipePublicId === null || input.recipePublicId === undefined ? null : textValue(input.recipePublicId, "recipePublicId"),
    name: textValue(input.name, "name", 160),
    instructions: nullableText(input.instructions, "instructions", 6000),
    yieldQuantityMilli: boundedInteger(input.yieldQuantityMilli, "yieldQuantityMilli", 1, 100000000),
    yieldUnit: Object.freeze({
      publicId: textValue(yieldUnit.publicId, "yieldUnit.publicId"),
      code: textValue(yieldUnit.code, "yieldUnit.code", 32),
      label: textValue(yieldUnit.label, "yieldUnit.label", 80),
    }),
    ingredients: Object.freeze(ingredients),
    release: booleanValue(input.release, "release"),
    correlationId: textValue(input.correlationId, "correlationId", 128),
  });
}

export function parseArchiveReusableContentCommandV1(value: unknown): ArchiveReusableContentCommandV1 {
  const input = object(value, "command");
  return Object.freeze({
    apiVersion: apiVersion(input.apiVersion),
    publicId: textValue(input.publicId, "publicId"),
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

export function parseRecordPatientPortalViewCommandV1(
  value: unknown,
): RecordPatientPortalViewCommandV1 {
  const input = object(value, "command");
  return Object.freeze({
    apiVersion: apiVersion(input.apiVersion),
    publicationPublicId: textValue(
      input.publicationPublicId,
      "publicationPublicId",
      200,
    ),
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
