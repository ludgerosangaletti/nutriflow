export const NUTRIFLOW_FEATURE_FLAGS = {
  ADMIN_EDITOR: "nutriflow.admin-editor",
  PATIENT_STRUCTURED_PLAN: "nutriflow.patient-structured-plan",
  REALTIME_UPDATES: "nutriflow.realtime-updates",
  DOMAIN_EVENT_DISPATCH: "nutriflow.domain-event-dispatch",
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
});

export function isNutriFlowFeatureEnabled(
  flag: NutriFlowFeatureFlag,
  overrides: Readonly<Partial<Record<NutriFlowFeatureFlag, boolean>>> = {},
): boolean {
  return overrides[flag] ?? NUTRIFLOW_DEFAULT_FEATURE_FLAGS[flag];
}
