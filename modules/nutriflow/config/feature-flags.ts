export const NUTRIFLOW_FEATURE_FLAGS = {
  ADMIN_EDITOR: "nutriflow.editor.enabled",
  PATIENT_STRUCTURED_PLAN: "nutriflow.patient_view.enabled",
  REALTIME_UPDATES: "nutriflow.realtime_updates.enabled",
  DOMAIN_EVENT_DISPATCH: "nutriflow.domain_events.enabled",
  GLOBAL_CATALOG: "nutriflow.catalog.global.enabled",
  RECIPES: "nutriflow.recipes.enabled",
  MEAL_TEMPLATES: "nutriflow.meal_templates.enabled",
} as const;

export type NutriFlowFeatureFlag =
  (typeof NUTRIFLOW_FEATURE_FLAGS)[keyof typeof NUTRIFLOW_FEATURE_FLAGS];

export const NUTRIFLOW_DEFAULT_FEATURE_FLAGS: Readonly<
  Record<NutriFlowFeatureFlag, boolean>
> = Object.freeze({
  [NUTRIFLOW_FEATURE_FLAGS.ADMIN_EDITOR]: false,
  [NUTRIFLOW_FEATURE_FLAGS.PATIENT_STRUCTURED_PLAN]: false,
  [NUTRIFLOW_FEATURE_FLAGS.REALTIME_UPDATES]: false,
  [NUTRIFLOW_FEATURE_FLAGS.DOMAIN_EVENT_DISPATCH]: false,
  [NUTRIFLOW_FEATURE_FLAGS.GLOBAL_CATALOG]: false,
  [NUTRIFLOW_FEATURE_FLAGS.RECIPES]: false,
  [NUTRIFLOW_FEATURE_FLAGS.MEAL_TEMPLATES]: false,
});

export const NUTRIFLOW_FEATURE_FLAG_GOVERNANCE = Object.freeze({
  owner: "nutriflow-core",
  reviewAfter: "2026-10-31",
  removalCondition:
    "Remove only after controlled clinical rollout, migration of both paths and regression approval.",
});

export function isNutriFlowFeatureEnabled(
  flag: NutriFlowFeatureFlag,
  overrides: Readonly<Partial<Record<NutriFlowFeatureFlag, boolean>>> = {},
): boolean {
  return overrides[flag] ?? NUTRIFLOW_DEFAULT_FEATURE_FLAGS[flag];
}
