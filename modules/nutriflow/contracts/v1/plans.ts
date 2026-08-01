import { NUTRIFLOW_API_VERSION } from "./errors.ts";

export type FoodPlanState = "draft" | "published" | "archived";

export type FoodPlanSummaryV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  publicId: string;
  clientId: number;
  title: string;
  state: FoodPlanState;
  latestVersionNumber: number;
  updatedAt: string;
}>;

export type CreateFoodPlanCommandV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  clientId: number;
  title: string;
  correlationId: string;
}>;

export type PublishFoodPlanVersionCommandV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  planPublicId: string;
  planVersionPublicId: string;
  expectedRevision: number;
  correlationId: string;
}>;

export type FoodPlanItemV1 = Readonly<{
  publicId: string;
  source: Readonly<{
    type: "manual" | "food" | "recipe";
    publicId: string | null;
    revisionNumber: number | null;
  }>;
  displayName: string;
  quantityMilli: number;
  unit: Readonly<{
    publicId: string;
    code: string;
    label: string;
  }>;
  preparation: string | null;
  notes: string | null;
  sortOrder: number;
}>;

export type FoodPlanMealV1 = Readonly<{
  publicId: string;
  planDayPublicId: string | null;
  title: string;
  scheduledTime: string | null;
  instructions: string | null;
  sourceTemplate?: Readonly<{
    publicId: string;
    versionNumber: number;
  }> | null;
  sortOrder: number;
  items: readonly FoodPlanItemV1[];
}>;

export type FoodPlanDayV1 = Readonly<{
  publicId: string;
  label: string;
  dayIndex: number | null;
  sortOrder: number;
}>;

export type FoodPlanContentV1 = Readonly<{
  schemaVersion: 1;
  days: readonly FoodPlanDayV1[];
  meals: readonly FoodPlanMealV1[];
  notes: readonly Readonly<{
    publicId: string;
    mealPublicId: string | null;
    kind: "general" | "preparation" | "clinical" | "patient";
    content: string;
    sortOrder: number;
  }>[];
}>;

export type SaveFoodPlanDraftCommandV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  planPublicId: string;
  planVersionPublicId: string;
  expectedRevision: number;
  title: string;
  planNotes: string | null;
  content: FoodPlanContentV1;
  correlationId: string;
}>;

export type FoodPlanDraftV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  publicId: string;
  planPublicId: string;
  clientId: number;
  versionNumber: number;
  revision: number;
  state: "draft" | "in_review";
  title: string;
  planNotes: string | null;
  content: FoodPlanContentV1;
  updatedAt: string;
}>;

export type PublishedFoodPlanV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  publicationPublicId: string;
  planPublicId: string;
  planVersionPublicId: string;
  clientId: number;
  versionNumber: number;
  contentHash: string;
  publishedAt: string;
  content: FoodPlanContentV1;
}>;

export type GetPublishedFoodPlanQueryV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  publicationPublicId: string;
  correlationId: string;
}>;

export type NutriFlowApiSuccessV1<T> = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  correlationId: string;
  data: T;
}>;
