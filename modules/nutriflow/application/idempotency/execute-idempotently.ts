import { NUTRIFLOW_ERROR_CODES } from "../../contracts/v1/errors.ts";
import { NutriFlowApplicationError } from "../errors/nutriflow-application-error.ts";
import type { IdempotencyRepository } from "../ports/idempotency-repository.ts";

export type ExecuteIdempotentlyInput<T> = Readonly<{
  repository: IdempotencyRepository;
  organizationId: number;
  operation: string;
  idempotencyKey: string;
  requestHash: string;
  correlationId: string;
  now: Date;
  ttlMilliseconds?: number;
  deserialize: (value: string) => T;
  execute: () => Promise<T>;
}>;

export async function executeIdempotently<T>(input: ExecuteIdempotentlyInput<T>) {
  const now = input.now.toISOString();
  const expiresAt = new Date(
    input.now.getTime() + (input.ttlMilliseconds ?? 24 * 60 * 60 * 1000),
  ).toISOString();
  const claim = await input.repository.begin({
    organizationId: input.organizationId,
    operation: input.operation,
    idempotencyKey: input.idempotencyKey,
    requestHash: input.requestHash,
    correlationId: input.correlationId,
    expiresAt,
    now,
  });

  if (claim.outcome === "existing") {
    if (claim.record.requestHash !== input.requestHash) {
      throw conflict("A chave de idempotência já foi usada com outro conteúdo.");
    }
    if (claim.record.status === "completed" && claim.record.responseJson !== null) {
      return input.deserialize(claim.record.responseJson);
    }
    throw conflict("Esta operação já está em processamento.");
  }

  try {
    const result = await input.execute();
    await input.repository.complete({
      organizationId: input.organizationId,
      operation: input.operation,
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      responseJson: JSON.stringify(result),
      completedAt: new Date().toISOString(),
    });
    return result;
  } catch (error) {
    const errorCode =
      error instanceof NutriFlowApplicationError
        ? error.code
        : NUTRIFLOW_ERROR_CODES.INTERNAL_ERROR;
    await input.repository.fail({
      organizationId: input.organizationId,
      operation: input.operation,
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      errorCode,
      failedAt: new Date().toISOString(),
    });
    throw error;
  }
}

function conflict(message: string) {
  return new NutriFlowApplicationError(
    NUTRIFLOW_ERROR_CODES.IDEMPOTENCY_CONFLICT,
    message,
    409,
  );
}
