import type { NutriFlowFeatureFlag } from "../../config/feature-flags.ts";

export type FeatureFlagEvaluationContext = Readonly<{
  organizationId?: number;
  clientId?: number;
  correlationId: string;
  now: Date;
}>;

export type FeatureFlagOverride = Readonly<{
  enabled: boolean;
  variant: string | null;
  scope: "client" | "organization" | "global";
  expiresAt: string | null;
}>;

export interface FeatureFlagRepository {
  findOverride(
    flag: NutriFlowFeatureFlag,
    context: FeatureFlagEvaluationContext,
  ): Promise<FeatureFlagOverride | null>;
}

export type NewFeatureFlagOverride = Readonly<{
  publicId: string;
  flag: NutriFlowFeatureFlag;
  clientId: number | null;
  enabled: boolean;
  variant: string | null;
  reason: string;
  expiresAt: string | null;
  createdByAuthUserId: string;
  createdAt: string;
}>;

export interface FeatureFlagWriteRepository {
  insertOverride(override: NewFeatureFlagOverride): void;
}

export interface FeatureFlagTelemetry {
  record(input: Readonly<{
    flag: NutriFlowFeatureFlag;
    enabled: boolean;
    variant: string;
    source: "override" | "default";
    correlationId: string;
  }>): void;
}
