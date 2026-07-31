export type NewPlanRecord = Readonly<{
  publicId: string;
  clientId: number;
  title: string;
  status: "draft";
  createdByAuthUserId: string;
  createdAt: string;
}>;

export type NewPlanVersionRecord = Readonly<{
  publicId: string;
  planPublicId: string;
  versionNumber: number;
  revision: number;
  schemaVersion: number;
  state: "draft" | "in_review" | "published";
  title: string;
  notes: string | null;
  snapshotJson: string | null;
  contentHash: string | null;
  createdByAuthUserId: string;
  publishedByAuthUserId: string | null;
  publishedAt: string | null;
  createdAt: string;
}>;

export type NewPlanDayRecord = Readonly<{
  publicId: string;
  planVersionPublicId: string;
  label: string;
  dayIndex: number | null;
  sortOrder: number;
  createdAt: string;
}>;

export type NewMealRecord = Readonly<{
  publicId: string;
  planVersionPublicId: string;
  planDayPublicId: string | null;
  title: string;
  scheduledTime: string | null;
  instructions: string | null;
  sourceTemplatePublicId: string | null;
  sourceTemplateVersionNumber: number | null;
  sortOrder: number;
  createdAt: string;
}>;

export type NewMealItemRecord = Readonly<{
  publicId: string;
  mealPublicId: string;
  sourceType: "manual" | "food" | "recipe";
  sourcePublicId: string | null;
  sourceRevisionNumber: number | null;
  displayNameSnapshot: string;
  quantityMilli: number;
  unitPublicId: string;
  unitCodeSnapshot: string;
  unitLabelSnapshot: string;
  preparation: string | null;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
}>;

export type NewPlanNoteRecord = Readonly<{
  publicId: string;
  planVersionPublicId: string;
  mealPublicId: string | null;
  kind: string;
  content: string;
  sortOrder: number;
  createdAt: string;
}>;

export interface FoodPlanWriteRepository {
  insertPlan(record: NewPlanRecord): void;
  insertPlanVersion(record: NewPlanVersionRecord): void;
  insertPlanDay(record: NewPlanDayRecord): void;
  insertMeal(record: NewMealRecord): void;
  insertMealItem(record: NewMealItemRecord): void;
  insertPlanNote(record: NewPlanNoteRecord): void;
}

export type FoodPlanDraftRecord = Readonly<{
  publicId: string;
  planPublicId: string;
  clientId: number;
  versionNumber: number;
  revision: number;
  state: "draft" | "in_review";
  title: string;
  planNotes: string | null;
  updatedAt: string;
}>;

export interface FoodPlanReadRepository {
  findLatestDraft(input: Readonly<{
    organizationId: number;
    clientId: number;
  }>): Promise<FoodPlanDraftRecord | null>;
}
