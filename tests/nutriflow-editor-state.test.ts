import assert from "node:assert/strict";
import test from "node:test";
import type { FoodPlanDraftV1 } from "../modules/nutriflow/contracts/v1/plans.ts";
import { addCatalogItem, addDay, addItem, addMeal, duplicateItem, duplicateMeal, moveDay, moveItem, moveMeal, removeDay, removeItem, removeMeal, updateItem, updateMeal } from "../app/admin/clientes/[email]/nutriflow/editor-state.ts";

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
