import { NUTRIFLOW_FEATURE_FLAGS } from "./feature-flags.ts";
import type { EditorCatalogToolV1 } from "../contracts/v1/catalog.ts";

export const NUTRIFLOW_EDITOR_TOOLS: readonly EditorCatalogToolV1[] = Object.freeze([
  Object.freeze({ id: "food-library", label: "Biblioteca de alimentos", insertionTarget: "meal-item", featureFlag: NUTRIFLOW_FEATURE_FLAGS.GLOBAL_CATALOG, implementationState: "available" }),
  Object.freeze({ id: "recipes", label: "Receitas", insertionTarget: "meal-item", featureFlag: NUTRIFLOW_FEATURE_FLAGS.RECIPES, implementationState: "prepared" }),
  Object.freeze({ id: "meal-templates", label: "Modelos de refeição", insertionTarget: "meal", featureFlag: NUTRIFLOW_FEATURE_FLAGS.MEAL_TEMPLATES, implementationState: "prepared" }),
]);

