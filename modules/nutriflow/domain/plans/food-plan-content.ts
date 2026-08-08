import type {
  PublicId,
  QuantityMilli,
  SortOrder,
  UnitCode,
  VersionNumber,
} from "../shared/value-objects.ts";

export type PlanVersionState =
  | "draft"
  | "in_review"
  | "published"
  | "superseded"
  | "revoked";

export type ItemSourceType = "manual" | "food" | "recipe";

export type SourceReference = Readonly<{
  type: ItemSourceType;
  publicId: PublicId | null;
  revisionNumber: VersionNumber | null;
}>;

export type PlanDay = Readonly<{
  publicId: PublicId;
  label: string;
  dayIndex: number | null;
  sortOrder: SortOrder;
}>;

export type MealItem = Readonly<{
  publicId: PublicId;
  source: SourceReference;
  displayName: string;
  quantityMilli: QuantityMilli;
  unitPublicId: PublicId;
  unitCode: UnitCode;
  unitLabel: string;
  preparation: string | null;
  notes: string | null;
  macros?: Readonly<{ energyKcal?: number | null; protein?: number | null; carbohydrate?: number | null; fat?: number | null }> | null;
  sortOrder: SortOrder;
}>;

export type SubstitutionOption = Readonly<{
  publicId: PublicId;
  source: SourceReference;
  displayName: string;
  quantityMilli: QuantityMilli;
  unitPublicId: PublicId;
  unitCode: UnitCode;
  unitLabel: string;
  notes: string | null;
  macros?: Readonly<{ energyKcal?: number | null; protein?: number | null; carbohydrate?: number | null; fat?: number | null }> | null;
  sortOrder: SortOrder;
}>;

export type SubstitutionGroup = Readonly<{
  publicId: PublicId;
  mealItemPublicId: PublicId | null;
  title: string;
  ruleCode: "choose_one";
  notes: string | null;
  sortOrder: SortOrder;
  options: readonly SubstitutionOption[];
}>;

export type MealOption = Readonly<{
  publicId: PublicId;
  label: string;
  sortOrder: SortOrder;
  items: readonly MealItem[];
  substitutions: readonly SubstitutionGroup[];
}>;

export type Meal = Readonly<{
  publicId: PublicId;
  planDayPublicId: PublicId | null;
  title: string;
  scheduledTime: string | null;
  instructions: string | null;
  sourceTemplatePublicId: PublicId | null;
  sourceTemplateVersionNumber: VersionNumber | null;
  sortOrder: SortOrder;
  items: readonly MealItem[];
  substitutions: readonly SubstitutionGroup[];
  options?: readonly MealOption[];
}>;

export type PlanNote = Readonly<{
  publicId: PublicId;
  mealPublicId: PublicId | null;
  kind: "general" | "preparation" | "clinical" | "patient";
  content: string;
  sortOrder: SortOrder;
}>;

export type PublishedFoodPlanSnapshotV1 = Readonly<{
  schemaVersion: 1;
  organizationPublicId: PublicId;
  clientId: number;
  planPublicId: PublicId;
  planVersionPublicId: PublicId;
  versionNumber: VersionNumber;
  title: string;
  notes: string | null;
  days: readonly PlanDay[];
  meals: readonly Meal[];
  planNotes: readonly PlanNote[];
}>;
