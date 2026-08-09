import {
  NUTRIFLOW_DEFAULT_FEATURE_FLAGS,
  type NutriFlowFeatureFlag,
} from "../../config/feature-flags.ts";
import type {
  FeatureFlagEvaluationContext,
  FeatureFlagRepository,
  FeatureFlagTelemetry,
} from "../ports/feature-flag-repository.ts";

export type FeatureFlagEvaluation = Readonly<{
  enabled: boolean;
  variant: string;
  source: "override" | "default";
  scope: "client" | "organization" | "global" | "default";
  expiresAt: string | null;
}>;

export async function evaluateFeatureFlag(input: Readonly<{
  flag: NutriFlowFeatureFlag;
  context: FeatureFlagEvaluationContext;
  repository: FeatureFlagRepository;
  telemetry?: FeatureFlagTelemetry;
}>): Promise<FeatureFlagEvaluation> {
  const override = await input.repository.findOverride(input.flag, input.context);
  const evaluation: FeatureFlagEvaluation = override
    ? Object.freeze({
        enabled: override.enabled,
        variant: override.variant ?? (override.enabled ? "on" : "off"),
        source: "override",
        scope: override.scope,
        expiresAt: override.expiresAt,
      })
    : Object.freeze({
        enabled: NUTRIFLOW_DEFAULT_FEATURE_FLAGS[input.flag],
        variant: NUTRIFLOW_DEFAULT_FEATURE_FLAGS[input.flag] ? "on" : "off",
        source: "default",
        scope: "default",
        expiresAt: null,
      });

  input.telemetry?.record({
    flag: input.flag,
    enabled: evaluation.enabled,
    variant: evaluation.variant,
    source: evaluation.source,
    correlationId: input.context.correlationId,
  });
  return evaluation;
}
