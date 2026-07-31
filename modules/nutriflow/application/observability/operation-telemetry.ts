import {
  NUTRIFLOW_ERROR_CODES,
  type NutriFlowErrorCode,
} from "../../contracts/v1/errors.ts";
import { NutriFlowApplicationError } from "../errors/nutriflow-application-error.ts";

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export function resolveCorrelationId(
  supplied: string | null | undefined,
  generate: () => string,
) {
  const value = supplied?.trim() || generate().trim();
  if (!CORRELATION_ID_PATTERN.test(value)) {
    throw new NutriFlowApplicationError(
      NUTRIFLOW_ERROR_CODES.INVALID_INPUT,
      "Identificador de correlação inválido.",
      400,
    );
  }
  return value;
}

export type NutriFlowOperationMetric = Readonly<{
  operation: string;
  correlationId: string;
  result: "success" | "error";
  durationMs: number;
  errorCode: NutriFlowErrorCode | null;
}>;

export interface NutriFlowTelemetry {
  record(metric: NutriFlowOperationMetric): void | Promise<void>;
}

export async function observeNutriFlowOperation<T>(input: {
  operation: string;
  correlationId: string;
  telemetry: NutriFlowTelemetry;
  execute: () => Promise<T>;
  now?: () => number;
}): Promise<T> {
  const clock = input.now ?? Date.now;
  const startedAt = clock();
  try {
    const result = await input.execute();
    await input.telemetry.record(
      Object.freeze({
        operation: input.operation,
        correlationId: input.correlationId,
        result: "success",
        durationMs: Math.max(0, clock() - startedAt),
        errorCode: null,
      }),
    );
    return result;
  } catch (error) {
    await input.telemetry.record(
      Object.freeze({
        operation: input.operation,
        correlationId: input.correlationId,
        result: "error",
        durationMs: Math.max(0, clock() - startedAt),
        errorCode:
          error instanceof NutriFlowApplicationError
            ? error.code
            : NUTRIFLOW_ERROR_CODES.INTERNAL_ERROR,
      }),
    );
    throw error;
  }
}
