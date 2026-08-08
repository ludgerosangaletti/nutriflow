import assert from "node:assert/strict";
import test from "node:test";
import type { FoodPlanDraftV1 } from "../modules/nutriflow/contracts/v1/plans.ts";
import { addCatalogItem, addDay, addItem, addMeal, addMealOption, addRecipeItem, addSubstitutionGroup, addSubstitutionOption, applyMealTemplate, duplicateDay, duplicateItem, duplicateMeal, mealOptions, moveDay, moveItem, moveMeal, moveMealToDay, removeDay, removeItem, removeMeal, removeMealOption, updateItem, updateMeal } from "../app/admin/clientes/[email]/nutriflow/editor-state.ts";

function emptyDraft(): FoodPlanDraftV1 {
  return { apiVersion: "v1", publicId: "version_editor_01", planPublicId: "plan_editor_01", clientId: 1, versionNumber: 1, revision: 1, state: "draft", title: "Plano", planNotes: null, content: { schemaVersion: 1, days: [], meals: [], notes: [] }, updatedAt: "2026-08-01T10:00:00.000Z" };
}

test("editor state builds and edits a complete visual draft without mutating prior state", () => {
  const original = emptyDraft();
  const withDays = addDay(addDay(original, "day_editor_01"), "day_editor_02");
  const withMeal = addMeal(withDays, "day_editor_01", "meal_editor_01");
  const withItem = addItem(withMeal, "meal_editor_01", "item_editor_01");
  const editedMeal = updateMeal(withItem, "meal_editor_01", { title: "Café da manhã", scheduledTime: "08:00" });
  const editedItem = updateItem(editedMeal, "meal_editor_01", "item_editor_01", { displayName: "Banana", quantityMilli: 2000 });
  assert.equal(original.content.days.length, 0);
  assert.equal(editedItem.content.days.length, 2);
  assert.equal(editedItem.content.meals[0].title, "Café da manhã");
  assert.equal(editedItem.content.meals[0].items[0].displayName, "Banana");
  assert.equal(editedItem.content.meals[0].items[0].quantityMilli, 2000);
});

test("editor state reorders days and meals with contiguous sort positions", () => {
  let draft = addDay(addDay(emptyDraft(), "day_editor_01"), "day_editor_02");
  draft = moveDay(draft, "day_editor_02", -1);
  assert.deepEqual(draft.content.days.map(({ publicId, sortOrder, dayIndex }) => [publicId, sortOrder, dayIndex]), [["day_editor_02", 0, 1], ["day_editor_01", 1, 2]]);
  draft = addMeal(addMeal(draft, "day_editor_01", "meal_editor_01"), "day_editor_01", "meal_editor_02");
  draft = moveMeal(draft, "meal_editor_02", -1);
  assert.deepEqual(draft.content.meals.filter((meal) => meal.planDayPublicId === "day_editor_01").map(({ publicId, sortOrder }) => [publicId, sortOrder]), [["meal_editor_02", 0], ["meal_editor_01", 1]]);
});

test("editor state removes dependent meals, items and notes safely", () => {
  let draft = addDay(emptyDraft(), "day_editor_01");
  draft = addMeal(draft, "day_editor_01", "meal_editor_01");
  draft = addItem(draft, "meal_editor_01", "item_editor_01");
  draft = { ...draft, content: { ...draft.content, notes: [{ publicId: "note_editor_01", mealPublicId: "meal_editor_01", kind: "patient", content: "Orientação", sortOrder: 0 }] } };
  const withoutItem = removeItem(draft, "meal_editor_01", "item_editor_01");
  assert.equal(withoutItem.content.meals[0].items.length, 0);
  const withoutMeal = removeMeal(draft, "meal_editor_01");
  assert.equal(withoutMeal.content.meals.length, 0);
  assert.equal(withoutMeal.content.notes.length, 0);
  const withoutDay = removeDay(draft, "day_editor_01");
  assert.equal(withoutDay.content.days.length, 0);
  assert.equal(withoutDay.content.meals.length, 0);
  assert.equal(withoutDay.content.notes.length, 0);
});

test("editor state inserts a versioned catalog snapshot and keeps every property editable", () => {
  let draft = addMeal(addDay(emptyDraft(), "day_editor_01"), "day_editor_01", "meal_editor_01");
  draft = addCatalogItem(draft, "meal_editor_01", {
    apiVersion: "v1", publicId: "food_global_banana", revisionPublicId: "foodrev_global_banana_1", revisionNumber: 1, name: "Banana", categoryCode: "fruits", aliases: ["banana prata"], referenceQuantityMilli: 100000, referenceUnit: { publicId: "unit_gram", code: "g", label: "grama" }, scope: "global",
  }, "item_catalog_01");
  draft = updateItem(draft, "meal_editor_01", "item_catalog_01", { displayName: "Banana prata", quantityMilli: 120000, preparation: "madura", notes: "Consumir antes do treino" });
  const item = draft.content.meals[0].items[0];
  assert.deepEqual(item.source, { type: "food", publicId: "food_global_banana", revisionNumber: 1 });
  assert.equal(item.displayName, "Banana prata");
  assert.equal(item.quantityMilli, 120000);
  assert.equal(item.preparation, "madura");
  assert.equal(item.notes, "Consumir antes do treino");
});

test("editor state duplicates and reorders items and meals without identifier collisions", () => {
  let draft = addMeal(addDay(emptyDraft(), "day_editor_01"), "day_editor_01", "meal_editor_01");
  draft = addItem(addItem(draft, "meal_editor_01", "item_editor_01"), "meal_editor_01", "item_editor_02");
  draft = moveItem(draft, "meal_editor_01", "item_editor_02", -1);
  assert.deepEqual(draft.content.meals[0].items.map((item) => item.publicId), ["item_editor_02", "item_editor_01"]);
  draft = duplicateItem(draft, "meal_editor_01", "item_editor_02", "item_editor_03");
  assert.deepEqual(draft.content.meals[0].items.map((item) => item.publicId), ["item_editor_02", "item_editor_03", "item_editor_01"]);
  draft = duplicateMeal(draft, "meal_editor_01", { meal: "meal_editor_02", items: ["item_editor_04", "item_editor_05", "item_editor_06"] });
  assert.equal(draft.content.meals.length, 2);
  assert.equal(draft.content.meals[1].title, "Nova refeição — cópia");
  assert.deepEqual(draft.content.meals[1].items.map((item) => item.publicId), ["item_editor_04", "item_editor_05", "item_editor_06"]);
});

test("editor duplicates a complete day and moves meals across days", () => {
  let draft = addDay(addDay(emptyDraft(), "day_editor_01"), "day_editor_02");
  draft = addMeal(draft, "day_editor_01", "meal_editor_01");
  draft = addItem(draft, "meal_editor_01", "item_editor_01");
  draft = duplicateDay(draft, "day_editor_01", { day: "day_editor_03", meals: [{ meal: "meal_editor_02", items: ["item_editor_02"] }] });
  assert.equal(draft.content.days[1].publicId, "day_editor_03");
  assert.equal(draft.content.meals.find((meal) => meal.publicId === "meal_editor_02")?.planDayPublicId, "day_editor_03");
  assert.equal(draft.content.meals.find((meal) => meal.publicId === "meal_editor_02")?.items[0].publicId, "item_editor_02");
  draft = moveMealToDay(draft, "meal_editor_01", "day_editor_02");
  assert.equal(draft.content.meals.find((meal) => meal.publicId === "meal_editor_01")?.planDayPublicId, "day_editor_02");
});

test("editor applies a versioned meal template and a recipe with provenance", () => {
  let draft = addMeal(addDay(emptyDraft(), "day_editor_01"), "day_editor_01", "meal_editor_01");
  draft = applyMealTemplate(draft, "day_editor_01", {
    apiVersion: "v1", templatePublicId: "template_01", versionPublicId: "template_version_01", versionNumber: 3, state: "released", name: "Café proteico", suggestedTime: "08:00", instructions: "Consumir com calma", createdAt: "2026-08-01T12:00:00.000Z",
    items: [{ publicId: "template_item_01", source: { type: "food", publicId: "food_01", revisionNumber: 1 }, displayName: "Ovos", quantityMilli: 2000, unit: { publicId: "unit_piece", code: "piece", label: "unidade" }, preparation: "mexidos", notes: null, sortOrder: 0 }],
  }, { meal: "meal_template_01", items: ["item_template_01"] });
  const templateMeal = draft.content.meals.find((meal) => meal.publicId === "meal_template_01")!;
  assert.deepEqual(templateMeal.sourceTemplate, { publicId: "template_01", versionNumber: 3 });
  assert.equal(templateMeal.items[0].publicId, "item_template_01");
  draft = addRecipeItem(draft, "meal_editor_01", {
    apiVersion: "v1", recipePublicId: "recipe_01", versionPublicId: "recipe_version_01", versionNumber: 2, state: "released", name: "Overnight oats", instructions: "Misturar e refrigerar", yieldQuantityMilli: 1000, yieldUnit: { publicId: "unit_portion", code: "portion", label: "porção" }, ingredients: [], createdAt: "2026-08-01T12:00:00.000Z",
  }, "item_recipe_01");
  const recipeItem = draft.content.meals.find((meal) => meal.publicId === "meal_editor_01")!.items[0];
  assert.deepEqual(recipeItem.source, { type: "recipe", publicId: "recipe_01", revisionNumber: 2 });
});

test("editor keeps up to three independent meal options and exposes swaps only after clinical registration", () => {
  let draft = addMeal(addDay(emptyDraft(), "day_options_01"), "day_options_01", "meal_options_01");
  draft = addItem(draft, "meal_options_01", "item_option_01");
  draft = addMealOption(draft, "meal_options_01", "meal_option_02");
  draft = addMealOption(draft, "meal_options_01", "meal_option_03");
  draft = addMealOption(draft, "meal_options_01", "meal_option_ignored");
  draft = addItem(draft, "meal_options_01", "item_option_02", "meal_option_02");
  draft = updateItem(draft, "meal_options_01", "item_option_02", { displayName: "Iogurte natural" }, "meal_option_02");

  let options = mealOptions(draft.content.meals[0]);
  assert.equal(options.length, 3);
  assert.equal(options[0].items[0].publicId, "item_option_01");
  assert.equal(options[1].items[0].displayName, "Iogurte natural");
  assert.equal(options[1].substitutions.length, 0);

  draft = addSubstitutionGroup(draft, "meal_options_01", "item_option_02", "meal_option_02");
  const groupId = mealOptions(draft.content.meals[0])[1].substitutions[0].publicId;
  draft = addSubstitutionOption(draft, "meal_options_01", groupId, "meal_option_02");
  options = mealOptions(draft.content.meals[0]);
  assert.equal(options[1].substitutions[0].mealItemPublicId, "item_option_02");
  assert.equal(options[1].substitutions[0].options.length, 1);
  assert.equal(options[0].substitutions.length, 0);

  draft = removeMealOption(draft, "meal_options_01", "meal_option_03");
  assert.equal(mealOptions(draft.content.meals[0]).length, 2);
  assert.deepEqual(draft.content.meals[0].items, mealOptions(draft.content.meals[0])[0].items);
});
