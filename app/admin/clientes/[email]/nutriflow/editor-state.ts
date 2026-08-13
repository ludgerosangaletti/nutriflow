import type { FoodPlanContentV1, FoodPlanDraftV1, FoodPlanMealV1 } from "../../../../../modules/nutriflow/contracts/v1/plans.ts";
import type { FoodCatalogItemV1 } from "../../../../../modules/nutriflow/contracts/v1/catalog.ts";
import type { MealTemplateVersionV1, RecipeVersionV1 } from "../../../../../modules/nutriflow/contracts/v1/reusable-content.ts";

export const NUTRIFLOW_UNITS = Object.freeze([
  { publicId: "unit_gram", code: "g", label: "grama" },
  { publicId: "unit_milliliter", code: "ml", label: "mililitro" },
  { publicId: "unit_piece", code: "piece", label: "unidade" },
  { publicId: "unit_portion", code: "portion", label: "porção" },
  { publicId: "unit_tablespoon", code: "tbsp", label: "colher de sopa" },
  { publicId: "unit_teaspoon", code: "tsp", label: "colher de chá" },
  { publicId: "unit_cup", code: "cup", label: "xícara" },
  { publicId: "unit_slice", code: "slice", label: "fatia" },
  { publicId: "unit_as_desired", code: "as_desired", label: "à vontade" },
]);

export function editorId(kind: "day" | "meal" | "meal_option" | "item" | "note") {
  return `${kind}_${crypto.randomUUID()}`;
}

type MealOption = NonNullable<FoodPlanMealV1["options"]>[number];
type ItemMacros = NonNullable<FoodPlanMealV1["items"][number]["macros"]>;

const MACRO_KEYS = Object.freeze(["energyKcal", "protein", "carbohydrate", "fat"] as const);
const NUTRITION_TOTAL_KEYS = Object.freeze([...MACRO_KEYS, "fiber"] as const);

function scaleItemMacros(macros: ItemMacros | null | undefined, previousQuantityMilli: number, nextQuantityMilli: number) {
  if (!macros || previousQuantityMilli <= 0 || nextQuantityMilli <= 0) return macros ?? null;
  return Object.freeze(Object.fromEntries(Object.entries(macros).map(([key, value]) => [
    key,
    value == null ? null : Number(value) * nextQuantityMilli / previousQuantityMilli,
  ]))) as ItemMacros;
}

export type EditorMacroSummary = Readonly<{
  totals: Readonly<Record<(typeof NUTRITION_TOTAL_KEYS)[number], number | null>>;
  itemCount: number;
  completeItemCount: number;
  complete: boolean;
}>;

/** Totals the exact meal-option configuration currently selected in the editor. */
export function calculateEditorMacroSummary(meals: readonly FoodPlanMealV1[], selectedOptionIds: Readonly<Record<string, string>>): EditorMacroSummary {
  const items = meals.flatMap((meal) => {
    const options = mealOptions(meal);
    const selected = options.find((option) => option.publicId === selectedOptionIds[meal.publicId]) ?? options[0];
    return selected?.items ?? [];
  });
  const completeItemCount = items.filter((item) => MACRO_KEYS.every((key) => item.macros?.[key] != null)).length;
  const complete = items.length > 0 && completeItemCount === items.length;
  const totals = Object.freeze(Object.fromEntries(NUTRITION_TOTAL_KEYS.map((key) => [
    key,
    complete && items.every((item) => item.macros?.[key] != null)
      ? items.reduce((sum, item) => sum + Number(item.macros?.[key] ?? 0), 0)
      : null,
  ]))) as EditorMacroSummary["totals"];
  return Object.freeze({ totals, itemCount: items.length, completeItemCount, complete });
}

export function mealOptions(meal: FoodPlanMealV1): readonly MealOption[] {
  if (meal.options?.length) return meal.options.toSorted((left, right) => left.sortOrder - right.sortOrder);
  return [{ publicId: `${meal.publicId}_option_1`, label: "Opção 1", sortOrder: 0, items: meal.items, substitutions: meal.substitutions ?? [] }];
}

function replaceMealOptions(meal: FoodPlanMealV1, options: readonly MealOption[]): FoodPlanMealV1 {
  const normalized = options.map((option, index) => ({
    ...option,
    label: option.label.trim() || `Opção ${index + 1}`,
    sortOrder: index,
    items: option.items.map((item, itemIndex) => ({ ...item, sortOrder: itemIndex })),
    substitutions: (option.substitutions ?? []).map((group, groupIndex) => ({ ...group, sortOrder: groupIndex })),
  }));
  const primary = normalized[0];
  return { ...meal, options: normalized, items: primary?.items ?? [], substitutions: primary?.substitutions ?? [] };
}

function updateMealOption(meal: FoodPlanMealV1, optionPublicId: string | undefined, updater: (option: MealOption) => MealOption): FoodPlanMealV1 {
  if (!optionPublicId && !meal.options?.length) {
    const updated = updater({ publicId: `${meal.publicId}_option_1`, label: "Opção 1", sortOrder: 0, items: meal.items, substitutions: meal.substitutions ?? [] });
    return { ...meal, items: updated.items, substitutions: updated.substitutions ?? [] };
  }
  const options = mealOptions(meal).map((option) => option.publicId === (optionPublicId ?? mealOptions(meal)[0]?.publicId) ? updater(option) : option);
  return replaceMealOptions(meal, options);
}

function cloneOption(option: MealOption, suppliedItemIds: readonly string[] = []): MealOption {
  const itemIds = new Map(option.items.map((item, index) => [item.publicId, suppliedItemIds[index] ?? editorId("item")]));
  return {
    ...option,
    publicId: editorId("meal_option"),
    items: option.items.map((item) => ({ ...item, publicId: itemIds.get(item.publicId)! })),
    substitutions: (option.substitutions ?? []).map((group) => ({
      ...group,
      publicId: editorId("item"),
      mealItemPublicId: group.mealItemPublicId ? itemIds.get(group.mealItemPublicId) ?? null : null,
      options: group.options.map((candidate) => ({ ...candidate, publicId: editorId("item") })),
    })),
  };
}

export function addMealOption(draft: FoodPlanDraftV1, mealPublicId: string, optionPublicId = editorId("meal_option")) {
  return updateContent(draft, { ...draft.content, meals: draft.content.meals.map((meal) => {
    if (meal.publicId !== mealPublicId) return meal;
    const options = mealOptions(meal);
    if (options.length >= 3) return meal;
    const newOption: MealOption = { publicId: optionPublicId, label: `Opção ${options.length + 1}`, sortOrder: options.length, items: [], substitutions: [] };
    const materialized = meal.options?.length ? options : [{ ...options[0], publicId: editorId("meal_option") }];
    return replaceMealOptions(meal, [...materialized, newOption]);
  }) });
}

export function updateMealOptionLabel(draft: FoodPlanDraftV1, mealPublicId: string, optionPublicId: string, label: string) {
  return updateContent(draft, { ...draft.content, meals: draft.content.meals.map((meal) => meal.publicId === mealPublicId ? updateMealOption(meal, optionPublicId, (option) => ({ ...option, label })) : meal) });
}

export function removeMealOption(draft: FoodPlanDraftV1, mealPublicId: string, optionPublicId: string) {
  return updateContent(draft, { ...draft.content, meals: draft.content.meals.map((meal) => {
    if (meal.publicId !== mealPublicId || !meal.options?.length || meal.options.length <= 1) return meal;
    return replaceMealOptions(meal, meal.options.filter((option) => option.publicId !== optionPublicId));
  }) });
}

function normalizeContent(content: FoodPlanContentV1): FoodPlanContentV1 {
  const days = content.days.map((day, index) => ({ ...day, dayIndex: index + 1, sortOrder: index }));
  const mealPositions = new Map<string, number>();
  for (const day of days) {
    content.meals
      .filter((meal) => meal.planDayPublicId === day.publicId)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .forEach((meal, index) => mealPositions.set(meal.publicId, index));
  }
  const meals = content.meals
    .map((meal) => {
      const normalized = replaceMealOptions(meal, mealOptions(meal));
      return { ...normalized, sortOrder: mealPositions.get(meal.publicId) ?? meal.sortOrder };
    })
    .sort((left, right) => {
      const leftDay = days.findIndex((day) => day.publicId === left.planDayPublicId);
      const rightDay = days.findIndex((day) => day.publicId === right.planDayPublicId);
      return leftDay === rightDay ? left.sortOrder - right.sortOrder : leftDay - rightDay;
    });
  const notes = content.notes.map((note, index) => ({ ...note, sortOrder: index }));
  return { schemaVersion: 1, days, meals, notes };
}

export function updateContent(draft: FoodPlanDraftV1, content: FoodPlanContentV1): FoodPlanDraftV1 {
  return { ...draft, content: normalizeContent(content) };
}

export function addDay(draft: FoodPlanDraftV1, publicId = editorId("day")) {
  const index = draft.content.days.length;
  return updateContent(draft, {
    ...draft.content,
    days: [...draft.content.days, { publicId, label: `Estratégia ${index + 1}`, dayIndex: index + 1, sortOrder: index }],
  });
}

export function removeDay(draft: FoodPlanDraftV1, dayPublicId: string) {
  const removedMealIds = new Set(draft.content.meals.filter((meal) => meal.planDayPublicId === dayPublicId).map((meal) => meal.publicId));
  return updateContent(draft, {
    ...draft.content,
    days: draft.content.days.filter((day) => day.publicId !== dayPublicId),
    meals: draft.content.meals.filter((meal) => meal.planDayPublicId !== dayPublicId),
    notes: draft.content.notes.filter((note) => !note.mealPublicId || !removedMealIds.has(note.mealPublicId)),
  });
}

export function moveDay(draft: FoodPlanDraftV1, dayPublicId: string, direction: -1 | 1) {
  const days = [...draft.content.days];
  const index = days.findIndex((day) => day.publicId === dayPublicId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= days.length) return draft;
  [days[index], days[target]] = [days[target], days[index]];
  return updateContent(draft, { ...draft.content, days });
}

export function duplicateDay(
  draft: FoodPlanDraftV1,
  dayPublicId: string,
  ids: Readonly<{ day: string; meals: readonly Readonly<{ meal: string; items: readonly string[] }>[] }> = { day: editorId("day"), meals: [] },
) {
  const sourceDay = draft.content.days.find((day) => day.publicId === dayPublicId);
  if (!sourceDay) return draft;
  const sourceMeals = draft.content.meals.filter((meal) => meal.planDayPublicId === dayPublicId).sort((a, b) => a.sortOrder - b.sortOrder);
  const dayIndex = draft.content.days.findIndex((day) => day.publicId === dayPublicId);
  const days = [...draft.content.days];
  days.splice(dayIndex + 1, 0, { ...sourceDay, publicId: ids.day, label: `${sourceDay.label} — cópia` });
  const mealIdMap = new Map<string, string>();
  const copies = sourceMeals.map((meal, mealIndex) => {
    const generated = ids.meals[mealIndex];
    const mealPublicId = generated?.meal ?? editorId("meal");
    mealIdMap.set(meal.publicId, mealPublicId);
    const options = mealOptions(meal).map((option, optionIndex) => cloneOption(option, optionIndex === 0 ? generated?.items ?? [] : []));
    return replaceMealOptions({ ...meal, publicId: mealPublicId, planDayPublicId: ids.day }, options);
  });
  const notes = [...draft.content.notes, ...draft.content.notes.filter((note) => note.mealPublicId && mealIdMap.has(note.mealPublicId)).map((note) => ({ ...note, publicId: editorId("note"), mealPublicId: mealIdMap.get(note.mealPublicId!) ?? null }))];
  return updateContent(draft, { ...draft.content, days, meals: [...draft.content.meals, ...copies], notes });
}

export function addMeal(draft: FoodPlanDraftV1, dayPublicId: string, publicId = editorId("meal")) {
  const siblings = draft.content.meals.filter((meal) => meal.planDayPublicId === dayPublicId);
  const meal: FoodPlanMealV1 = { publicId, planDayPublicId: dayPublicId, title: "Nova refeição", scheduledTime: null, instructions: null, sourceTemplate: null, sortOrder: siblings.length, items: [] };
  return updateContent(draft, { ...draft.content, meals: [...draft.content.meals, meal] });
}

export function removeMeal(draft: FoodPlanDraftV1, mealPublicId: string) {
  return updateContent(draft, { ...draft.content, meals: draft.content.meals.filter((meal) => meal.publicId !== mealPublicId), notes: draft.content.notes.filter((note) => note.mealPublicId !== mealPublicId) });
}

export function moveMeal(draft: FoodPlanDraftV1, mealPublicId: string, direction: -1 | 1) {
  const current = draft.content.meals.find((meal) => meal.publicId === mealPublicId);
  if (!current) return draft;
  const siblings = draft.content.meals.filter((meal) => meal.planDayPublicId === current.planDayPublicId);
  const index = siblings.findIndex((meal) => meal.publicId === mealPublicId);
  const target = index + direction;
  if (target < 0 || target >= siblings.length) return draft;
  const ordered = [...siblings];
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  const replacement = new Map(ordered.map((meal, order) => [meal.publicId, { ...meal, sortOrder: order }]));
  return updateContent(draft, { ...draft.content, meals: draft.content.meals.map((meal) => replacement.get(meal.publicId) ?? meal) });
}

export function moveMealToDay(draft: FoodPlanDraftV1, mealPublicId: string, targetDayPublicId: string) {
  if (!draft.content.days.some((day) => day.publicId === targetDayPublicId)) return draft;
  const nextOrder = draft.content.meals.filter((meal) => meal.planDayPublicId === targetDayPublicId && meal.publicId !== mealPublicId).length;
  return updateContent(draft, { ...draft.content, meals: draft.content.meals.map((meal) => meal.publicId === mealPublicId ? { ...meal, planDayPublicId: targetDayPublicId, sortOrder: nextOrder } : meal) });
}

export function updateMeal(draft: FoodPlanDraftV1, mealPublicId: string, patch: Partial<FoodPlanMealV1>) {
  return updateContent(draft, { ...draft.content, meals: draft.content.meals.map((meal) => meal.publicId === mealPublicId ? { ...meal, ...patch, publicId: meal.publicId, items: meal.items } : meal) });
}

export function addItem(draft: FoodPlanDraftV1, mealPublicId: string, publicId = editorId("item"), optionPublicId?: string) {
  const unit = NUTRIFLOW_UNITS[2];
  return updateContent(draft, { ...draft.content, meals: draft.content.meals.map((meal) => meal.publicId === mealPublicId ? updateMealOption(meal, optionPublicId, (option) => ({ ...option, items: [...option.items, { publicId, source: { type: "manual", publicId: null, revisionNumber: null }, displayName: "Novo alimento", quantityMilli: 1000, unit, preparation: null, notes: null, sortOrder: option.items.length }] })) : meal) });
}

export function addCatalogItem(draft: FoodPlanDraftV1, mealPublicId: string, food: FoodCatalogItemV1, publicId = editorId("item"), optionPublicId?: string) {
  return updateContent(draft, { ...draft.content, meals: draft.content.meals.map((meal) => meal.publicId === mealPublicId ? updateMealOption(meal, optionPublicId, (option) => ({ ...option, items: [...option.items, { publicId, source: { type: "food", publicId: food.publicId, revisionNumber: food.revisionNumber }, displayName: food.name, quantityMilli: food.referenceQuantityMilli, unit: food.referenceUnit, preparation: null, notes: null, macros: food.nutrients ?? null, sortOrder: option.items.length }] })) : meal) });
}

export function addRecipeItem(draft: FoodPlanDraftV1, mealPublicId: string, recipe: RecipeVersionV1, publicId = editorId("item"), optionPublicId?: string) {
  return updateContent(draft, { ...draft.content, meals: draft.content.meals.map((meal) => meal.publicId === mealPublicId ? updateMealOption(meal, optionPublicId, (option) => ({ ...option, items: [...option.items, { publicId, source: { type: "recipe", publicId: recipe.recipePublicId, revisionNumber: recipe.versionNumber }, displayName: recipe.name, quantityMilli: recipe.yieldQuantityMilli, unit: recipe.yieldUnit, preparation: recipe.instructions, notes: `${recipe.ingredients.length} ingrediente(s)`, sortOrder: option.items.length }] })) : meal) });
}

export function applyMealTemplate(
  draft: FoodPlanDraftV1,
  dayPublicId: string,
  template: MealTemplateVersionV1,
  ids: Readonly<{ meal: string; items: readonly string[] }> = { meal: editorId("meal"), items: [] },
) {
  if (!draft.content.days.some((day) => day.publicId === dayPublicId)) return draft;
  const siblings = draft.content.meals.filter((meal) => meal.planDayPublicId === dayPublicId);
  const meal: FoodPlanMealV1 = { publicId: ids.meal, planDayPublicId: dayPublicId, title: template.name, scheduledTime: template.suggestedTime, instructions: template.instructions, sourceTemplate: { publicId: template.templatePublicId, versionNumber: template.versionNumber }, sortOrder: siblings.length, items: template.items.map((item, index) => ({ ...item, publicId: ids.items[index] ?? editorId("item"), sortOrder: index })) };
  return updateContent(draft, { ...draft.content, meals: [...draft.content.meals, meal] });
}

export function updateItem(draft: FoodPlanDraftV1, mealPublicId: string, itemPublicId: string, patch: Partial<FoodPlanMealV1["items"][number]>, optionPublicId?: string) {
  return updateContent(draft, { ...draft.content, meals: draft.content.meals.map((meal) => meal.publicId === mealPublicId ? updateMealOption(meal, optionPublicId, (option) => ({ ...option, items: option.items.map((item) => {
    if (item.publicId !== itemPublicId) return item;
    const becomesFreeQuantity = patch.unit?.publicId === "unit_as_desired";
    const macros = becomesFreeQuantity
      ? null
      : patch.quantityMilli != null && patch.quantityMilli !== item.quantityMilli
        ? scaleItemMacros(item.macros, item.quantityMilli, patch.quantityMilli)
        : item.macros;
    return { ...item, ...patch, macros, publicId: item.publicId };
  }) })) : meal) });
}

export function addSubstitutionGroup(draft: FoodPlanDraftV1, mealPublicId: string, itemPublicId: string, optionPublicId?: string) {
  return updateContent(draft, { ...draft.content, meals: draft.content.meals.map((meal) => {
    if (meal.publicId !== mealPublicId) return meal;
    return updateMealOption(meal, optionPublicId, (option) => {
      const item = option.items.find((candidate) => candidate.publicId === itemPublicId);
      if (!item) return option;
      const groups = option.substitutions ?? [];
      if (groups.some((group) => group.mealItemPublicId === itemPublicId)) return option;
      return { ...option, substitutions: [...groups, { publicId: editorId("item"), mealItemPublicId: itemPublicId, title: `Trocar ${item.displayName}`, ruleCode: "choose_one" as const, notes: null, sortOrder: groups.length, options: [] }] };
    });
  }) });
}

export function addSubstitutionOption(draft: FoodPlanDraftV1, mealPublicId: string, groupPublicId: string, optionPublicId?: string) {
  return updateContent(draft, { ...draft.content, meals: draft.content.meals.map((meal) => {
    if (meal.publicId !== mealPublicId) return meal;
    return updateMealOption(meal, optionPublicId, (mealOption) => ({ ...mealOption, substitutions: (mealOption.substitutions ?? []).map((group) => {
      if (group.publicId !== groupPublicId) return group;
      return { ...group, options: [...group.options, { publicId: editorId("item"), source: { type: "manual" as const, publicId: null, revisionNumber: null }, displayName: "Nova opção", quantityMilli: 1000, unit: NUTRIFLOW_UNITS[0], preparation: null, notes: null, sortOrder: group.options.length }] };
    }) }));
  }) });
}

export function removeSubstitutionOption(draft: FoodPlanDraftV1, mealPublicId: string, groupPublicId: string, substitutionOptionPublicId: string, mealOptionPublicId?: string) {
  return updateContent(draft, { ...draft.content, meals: draft.content.meals.map((meal) => {
    if (meal.publicId !== mealPublicId) return meal;
    return updateMealOption(meal, mealOptionPublicId, (option) => ({ ...option, substitutions: (option.substitutions ?? []).map((group) => group.publicId !== groupPublicId ? group : { ...group, options: group.options.filter((candidate) => candidate.publicId !== substitutionOptionPublicId) }) }));
  }) });
}

export function updateSubstitutionOption(draft: FoodPlanDraftV1, mealPublicId: string, groupPublicId: string, substitutionOptionPublicId: string, patch: Partial<FoodPlanMealV1["items"][number]>, mealOptionPublicId?: string) {
  return updateContent(draft, { ...draft.content, meals: draft.content.meals.map((meal) => {
    if (meal.publicId !== mealPublicId) return meal;
    return updateMealOption(meal, mealOptionPublicId, (option) => ({ ...option, substitutions: (option.substitutions ?? []).map((group) => {
      if (group.publicId !== groupPublicId) return group;
      return { ...group, options: group.options.map((candidate) => candidate.publicId === substitutionOptionPublicId ? { ...candidate, ...patch } : candidate) };
    }) }));
  }) });
}

export function updateSubstitutionGroup(draft: FoodPlanDraftV1, mealPublicId: string, groupPublicId: string, patch: Readonly<{ title?: string; notes?: string | null }>, optionPublicId?: string) {
  return updateContent(draft, { ...draft.content, meals: draft.content.meals.map((meal) => meal.publicId === mealPublicId ? updateMealOption(meal, optionPublicId, (option) => ({ ...option, substitutions: (option.substitutions ?? []).map((group) => group.publicId === groupPublicId ? { ...group, ...patch } : group) })) : meal) });
}

export function removeSubstitutionGroup(draft: FoodPlanDraftV1, mealPublicId: string, groupPublicId: string, optionPublicId?: string) {
  return updateContent(draft, { ...draft.content, meals: draft.content.meals.map((meal) => meal.publicId === mealPublicId ? updateMealOption(meal, optionPublicId, (option) => ({ ...option, substitutions: (option.substitutions ?? []).filter((group) => group.publicId !== groupPublicId) })) : meal) });
}

export function removeItem(draft: FoodPlanDraftV1, mealPublicId: string, itemPublicId: string, optionPublicId?: string) {
  return updateContent(draft, { ...draft.content, meals: draft.content.meals.map((meal) => meal.publicId === mealPublicId ? updateMealOption(meal, optionPublicId, (option) => ({ ...option, items: option.items.filter((item) => item.publicId !== itemPublicId), substitutions: (option.substitutions ?? []).filter((group) => group.mealItemPublicId !== itemPublicId) })) : meal) });
}

export function moveItem(draft: FoodPlanDraftV1, mealPublicId: string, itemPublicId: string, direction: -1 | 1, optionPublicId?: string) {
  return updateContent(draft, { ...draft.content, meals: draft.content.meals.map((meal) => {
    if (meal.publicId !== mealPublicId) return meal;
    return updateMealOption(meal, optionPublicId, (option) => {
      const items = [...option.items];
      const index = items.findIndex((item) => item.publicId === itemPublicId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= items.length) return option;
      [items[index], items[target]] = [items[target], items[index]];
      return { ...option, items };
    });
  }) });
}

export function duplicateItem(draft: FoodPlanDraftV1, mealPublicId: string, itemPublicId: string, publicId = editorId("item"), optionPublicId?: string) {
  return updateContent(draft, { ...draft.content, meals: draft.content.meals.map((meal) => {
    if (meal.publicId !== mealPublicId) return meal;
    return updateMealOption(meal, optionPublicId, (option) => {
      const index = option.items.findIndex((item) => item.publicId === itemPublicId);
      if (index < 0) return option;
      const copy = { ...option.items[index], publicId };
      return { ...option, items: [...option.items.slice(0, index + 1), copy, ...option.items.slice(index + 1)] };
    });
  }) });
}

export function duplicateMeal(draft: FoodPlanDraftV1, mealPublicId: string, ids: Readonly<{ meal: string; items: readonly string[]; targetDayPublicId?: string }> = { meal: editorId("meal"), items: [] }) {
  const source = draft.content.meals.find((meal) => meal.publicId === mealPublicId);
  if (!source) return draft;
  const targetDay = ids.targetDayPublicId ?? source.planDayPublicId;
  const targetOrder = ids.targetDayPublicId ? draft.content.meals.filter((meal) => meal.planDayPublicId === targetDay).length : source.sortOrder + 1;
  const copy: FoodPlanMealV1 = {
    ...source,
    publicId: ids.meal,
    planDayPublicId: ids.targetDayPublicId ?? source.planDayPublicId,
    title: `${source.title} — cópia`,
    sortOrder: targetOrder,
    items: [],
  };
  const copied = replaceMealOptions(copy, mealOptions(source).map((option, optionIndex) => cloneOption(option, optionIndex === 0 ? ids.items : [])));
  const meals = draft.content.meals.map((meal) => !ids.targetDayPublicId && meal.planDayPublicId === source.planDayPublicId && meal.sortOrder > source.sortOrder ? { ...meal, sortOrder: meal.sortOrder + 1 } : meal);
  const sourcePosition = meals.findIndex((meal) => meal.publicId === source.publicId);
  meals.splice(ids.targetDayPublicId ? meals.length : sourcePosition + 1, 0, copied);
  return updateContent(draft, { ...draft.content, meals });
}
