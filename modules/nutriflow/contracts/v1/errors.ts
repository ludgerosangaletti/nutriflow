export const NUTRIFLOW_API_VERSION = "v1" as const;

export const NUTRIFLOW_ERROR_CODES = {
  FEATURE_DISABLED: "NF_FEATURE_DISABLED",
  INVALID_INPUT: "NF_INVALID_INPUT",
  UNAUTHENTICATED: "NF_UNAUTHENTICATED",
  NOT_FOUND: "NF_NOT_FOUND",
  VERSION_CONFLICT: "NF_VERSION_CONFLICT",
  FORBIDDEN: "NF_FORBIDDEN",
  ACCESS_EXPIRED: "NF_ACCESS_EXPIRED",
  IDEMPOTENCY_CONFLICT: "NF_IDEMPOTENCY_CONFLICT",
  PUBLICATION_IMMUTABLE: "NF_PUBLICATION_IMMUTABLE",
  INTERNAL_ERROR: "NF_INTERNAL_ERROR",
} as const;

export type NutriFlowErrorCode =
  (typeof NUTRIFLOW_ERROR_CODES)[keyof typeof NUTRIFLOW_ERROR_CODES];

export type NutriFlowApiError = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  errorCode: NutriFlowErrorCode;
  message: string;
  correlationId: string;
  details?: Readonly<Record<string, string | number | boolean | null>>;
}>;
