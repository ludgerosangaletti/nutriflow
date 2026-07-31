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
