import type { NutriFlowFeatureFlag } from "../../config/feature-flags.ts";

export type HomologationFlagStatusV1 = Readonly<{
  flag: NutriFlowFeatureFlag;
  label: string;
  enabled: boolean;
  variant: string;
  source: "override" | "default";
  scope: "global" | "organization" | "client";
  expiresAt: string | null;
}>;

export type HomologationStepV1 = Readonly<{
  key:
    | "consultation"
    | "anamnesis"
    | "plan"
    | "meal-template"
    | "recipe"
    | "publication"
    | "portal-view"
    | "physical-assessment"
    | "check-in";
  label: string;
  complete: boolean;
  description: string;
}>;

export type ControlledHomologationSnapshotV1 = Readonly<{
  mode: "inactive" | "active" | "partial";
  enabledCount: number;
  controlledCount: number;
  totalFlags: number;
  expiresAt: string | null;
  flags: readonly HomologationFlagStatusV1[];
  steps: readonly HomologationStepV1[];
  completedSteps: number;
  totalSteps: number;
}>;
