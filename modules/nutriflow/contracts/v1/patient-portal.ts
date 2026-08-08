import { NUTRIFLOW_API_VERSION } from "./errors.ts";

export type PatientPortalUnitV1 = Readonly<{
  publicId: string;
  code: string;
  label: string;
}>;

export type PatientPortalItemV1 = Readonly<{
  publicId: string;
  kind: "food" | "recipe" | "manual";
  displayName: string;
  quantityMilli: number;
  unit: PatientPortalUnitV1;
  preparation: string | null;
  notes: string | null;
  /** Optional nutrition snapshot. Older publications may not contain it. */
  macros?: Readonly<{
    energyKcal?: number | null;
    protein?: number | null;
    carbohydrate?: number | null;
    fat?: number | null;
    fiber?: number | null;
  }> | null;
  recipe: Readonly<{
    publicId: string;
    versionNumber: number;
    instructions: string | null;
  }> | null;
}>;

export type PatientPortalSubstitutionV1 = Readonly<{
  publicId: string;
  /** Item da refeição ao qual esta troca pertence. Campo aditivo do contrato v1. */
  mealItemPublicId: string | null;
  title: string;
  notes: string | null;
  options: readonly Readonly<{
    publicId: string;
    displayName: string;
    quantityMilli: number;
    unit: PatientPortalUnitV1;
    notes: string | null;
  }>[];
}>;

export type PatientPortalMealV1 = Readonly<{
  publicId: string;
  title: string;
  scheduledTime: string | null;
  instructions: string | null;
  items: readonly PatientPortalItemV1[];
  substitutions: readonly PatientPortalSubstitutionV1[];
  /** Uma única opção é retornada para publicações legadas. */
  options: readonly Readonly<{
    publicId: string;
    label: string;
    sortOrder: number;
    items: readonly PatientPortalItemV1[];
    substitutions: readonly PatientPortalSubstitutionV1[];
  }>[];
  /** Optional total calculated from the published snapshot. */
  macros?: PatientPortalItemV1["macros"];
  /** False when the total would represent only part of the prescribed items. */
  nutritionComplete: boolean;
}>;

export type PatientPortalDayV1 = Readonly<{
  publicId: string;
  label: string;
  dayIndex: number | null;
  meals: readonly PatientPortalMealV1[];
}>;

export type PatientPortalPlanV1 = Readonly<{
  publicationPublicId: string;
  planPublicId: string;
  planVersionPublicId: string;
  title: string;
  versionNumber: number;
  contentHash: string;
  publishedAt: string;
  notes: string | null;
  patientNotes: readonly string[];
  macros?: Readonly<{ energyKcal?: number | null; protein?: number | null; carbohydrate?: number | null; fat?: number | null; fiber?: number | null }> | null;
  days: readonly PatientPortalDayV1[];
}>;

export type PatientPortalV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  generatedAt: string;
  patient: Readonly<{
    firstName: string;
    modality: "online" | "in_person";
  }>;
  plan: PatientPortalPlanV1 | null;
  physicalAssessment: Readonly<{
    available: boolean;
    title: string | null;
    publishedAt: string | null;
    href: string | null;
  }>;
  weightEvolution: readonly Readonly<{
    recordedAt: string;
    weightKg: number;
    source: "check-in";
  }>[];
  checkIn: Readonly<{
    status: "available" | "completed-this-week" | "unavailable";
    latestSubmittedAt: string | null;
    href: string;
  }>;
}>;

export type RecordPatientPortalViewCommandV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  publicationPublicId: string;
}>;
