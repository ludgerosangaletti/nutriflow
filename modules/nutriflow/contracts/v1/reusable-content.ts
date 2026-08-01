import { NUTRIFLOW_API_VERSION } from "./errors.ts";
import type { FoodCatalogUnitV1 } from "./catalog.ts";

export type ReusableContentStateV1 = "draft" | "released" | "superseded";

export type ReusableContentItemV1 = Readonly<{
  publicId: string;
  source: Readonly<{
    type: "manual" | "food" | "recipe";
    publicId: string | null;
    revisionNumber: number | null;
  }>;
  displayName: string;
  quantityMilli: number;
  unit: FoodCatalogUnitV1;
  preparation: string | null;
  notes: string | null;
  sortOrder: number;
}>;

export type MealTemplateVersionV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  templatePublicId: string;
  versionPublicId: string;
  versionNumber: number;
  state: ReusableContentStateV1;
  name: string;
  suggestedTime: string | null;
  instructions: string | null;
  items: readonly ReusableContentItemV1[];
  createdAt: string;
}>;

export type RecipeVersionV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  recipePublicId: string;
  versionPublicId: string;
  versionNumber: number;
  state: ReusableContentStateV1;
  name: string;
  instructions: string | null;
  yieldQuantityMilli: number;
  yieldUnit: FoodCatalogUnitV1;
  ingredients: readonly ReusableContentItemV1[];
  createdAt: string;
}>;

export type ReusableContentSearchResultV1<T> = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  query: string;
  items: readonly T[];
  hasMore: boolean;
}>;

export type SearchReusableContentQueryV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  query: string;
  limit: number;
  correlationId: string;
}>;

export type SaveMealTemplateCommandV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  templatePublicId: string | null;
  name: string;
  suggestedTime: string | null;
  instructions: string | null;
  items: readonly ReusableContentItemV1[];
  release: boolean;
  correlationId: string;
}>;

export type SaveRecipeCommandV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  recipePublicId: string | null;
  name: string;
  instructions: string | null;
  yieldQuantityMilli: number;
  yieldUnit: FoodCatalogUnitV1;
  ingredients: readonly ReusableContentItemV1[];
  release: boolean;
  correlationId: string;
}>;

export type ArchiveReusableContentCommandV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  publicId: string;
  correlationId: string;
}>;
