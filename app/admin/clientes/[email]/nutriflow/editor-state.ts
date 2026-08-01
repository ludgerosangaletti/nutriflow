import type { FoodPlanContentV1, FoodPlanDraftV1, FoodPlanMealV1 } from "../../../../../modules/nutriflow/contracts/v1/plans.ts";

export const NUTRIFLOW_UNITS = Object.freeze([
  { publicId: "unit_gram", code: "g", label: "grama" },
  { publicId: "unit_milliliter", code: "ml", label: "mililitro" },
  { publicId: "unit_piece", code: "piece", label: "unidade" },
  { publicId: "unit_portion", code: "portion", label: "porção" },
  { publicId: "unit_tablespoon", code: "tbsp", label: "colher de sopa" },
  { publicId: "unit_teaspoon", code: "tsp", label: "colher de chá" },
  { publicId: "unit_cup", code: "cup", label: "xícara" },
  { publicId: "unit_slice", code: "slice", label: "fatia" },
]);

export function editorId(kind: "day" | "meal" | "item" | "note") {
  return `${kind}_${crypto.randomUUID()}`;
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
    .map((meal) => ({
      ...meal,
      sortOrder: mealPositions.get(meal.publicId) ?? meal.sortOrder,
      items: meal.items.map((item, index) => ({ ...item, sortOrder: index })),
    }))
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
    days: [...draft.content.days, { publicId, label: `Dia ${index + 1}`, dayIndex: index + 1, sortOrder: index }],
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

export function addMeal(draft: FoodPlanDraftV1, dayPublicId: string, publicId = editorId("meal")) {
  const siblings = draft.content.meals.filter((meal) => meal.planDayPublicId === dayPublicId);
  const meal: FoodPlanMealV1 = { publicId, planDayPublicId: dayPublicId, title: "Nova refeição", scheduledTime: null, instructions: null, sortOrder: siblings.length, items: [] };
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

export function updateMeal(draft: FoodPlanDraftV1, mealPublicId: string, patch: Partial<FoodPlanMealV1>) {
  return updateContent(draft, { ...draft.content, meals: draft.content.meals.map((meal) => meal.publicId === mealPublicId ? { ...meal, ...patch, publicId: meal.publicId, items: meal.items } : meal) });
}

export function addItem(draft: FoodPlanDraftV1, mealPublicId: string, publicId = editorId("item")) {
  const unit = NUTRIFLOW_UNITS[2];
  return updateContent(draft, { ...draft.content, meals: draft.content.meals.map((meal) => meal.publicId === mealPublicId ? { ...meal, items: [...meal.items, { publicId, source: { type: "manual", publicId: null, revisionNumber: null }, displayName: "Novo alimento", quantityMilli: 1000, unit, preparation: null, notes: null, sortOrder: meal.items.length }] } : meal) });
}

export function updateItem(draft: FoodPlanDraftV1, mealPublicId: string, itemPublicId: string, patch: Partial<FoodPlanMealV1["items"][number]>) {
  return updateContent(draft, { ...draft.content, meals: draft.content.meals.map((meal) => meal.publicId === mealPublicId ? { ...meal, items: meal.items.map((item) => item.publicId === itemPublicId ? { ...item, ...patch, publicId: item.publicId } : item) } : meal) });
}

export function removeItem(draft: FoodPlanDraftV1, mealPublicId: string, itemPublicId: string) {
  return updateContent(draft, { ...draft.content, meals: draft.content.meals.map((meal) => meal.publicId === mealPublicId ? { ...meal, items: meal.items.filter((item) => item.publicId !== itemPublicId) } : meal) });
}
