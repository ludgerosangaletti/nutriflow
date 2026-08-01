import { NUTRIFLOW_API_VERSION } from "./errors.ts";

export type FoodCatalogUnitV1 = Readonly<{
  publicId: string;
  code: string;
  label: string;
}>;

export type FoodCatalogItemV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  publicId: string;
  revisionPublicId: string;
  revisionNumber: number;
  name: string;
  categoryCode: string | null;
  aliases: readonly string[];
  referenceQuantityMilli: number;
  referenceUnit: FoodCatalogUnitV1;
  scope: "global" | "organization";
}>;

export type SearchFoodCatalogQueryV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  query: string;
  categoryCode: string | null;
  limit: number;
  correlationId: string;
}>;

export type FoodCatalogSearchResultV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  query: string;
  items: readonly FoodCatalogItemV1[];
  hasMore: boolean;
}>;

export type EditorCatalogToolV1 = Readonly<{
  id: "food-library" | "recipes" | "meal-templates";
  label: string;
  insertionTarget: "meal-item" | "meal";
  featureFlag: string;
  implementationState: "available" | "prepared";
}>;
