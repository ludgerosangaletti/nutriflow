import type { NutriFlowFeatureFlag } from "../../config/feature-flags.ts";
import { NUTRIFLOW_ERROR_CODES } from "../../contracts/v1/errors.ts";
import { NutriFlowApplicationError } from "../errors/nutriflow-application-error.ts";
import { evaluateFeatureFlag } from "../feature-flags/evaluate-feature-flag.ts";
import { executeIdempotently } from "../idempotency/execute-idempotently.ts";
import {
  observeNutriFlowOperation,
  resolveCorrelationId,
  type NutriFlowTelemetry,
} from "../observability/operation-telemetry.ts";
import type {
  FeatureFlagRepository,
  FeatureFlagTelemetry,
} from "../ports/feature-flag-repository.ts";
import type { IdempotencyRepository } from "../ports/idempotency-repository.ts";
import {
  assertNutriFlowAuthorized,
  type NutriFlowAction,
  type NutriFlowActor,
  type NutriFlowResource,
} from "../security/authorization.ts";

export type NutriFlowIdempotencyInput<T> = Readonly<{
  key: string;
  requestHash: string;
  deserialize: (value: string) => T;
  ttlMilliseconds?: number;
}>;

export type RunNutriFlowOperationInput<T> = Readonly<{
  operation: string;
  suppliedCorrelationId?: string | null;
  flag: NutriFlowFeatureFlag;
  actor: NutriFlowActor;
  action: NutriFlowAction;
  resource: NutriFlowResource;
  organizationId: number;
  idempotency?: NutriFlowIdempotencyInput<T>;
  execute: (context: Readonly<{ correlationId: string; now: Date }>) => Promise<T>;
}>;

export type NutriFlowOperationResult<T> = Readonly<{
  correlationId: string;
  data: T;
}>;

export class NutriFlowOperationRunner {
  private readonly flags: FeatureFlagRepository;
  private readonly idempotency: IdempotencyRepository;
  private readonly telemetry: NutriFlowTelemetry;
  private readonly flagTelemetry?: FeatureFlagTelemetry;
  private readonly generateCorrelationId: () => string;
  private readonly clock: () => Date;

  constructor(dependencies: Readonly<{
    flags: FeatureFlagRepository;
    idempotency: IdempotencyRepository;
    telemetry: NutriFlowTelemetry;
    flagTelemetry?: FeatureFlagTelemetry;
    generateCorrelationId: () => string;
    clock?: () => Date;
  }>) {
    this.flags = dependencies.flags;
    this.idempotency = dependencies.idempotency;
    this.telemetry = dependencies.telemetry;
    this.flagTelemetry = dependencies.flagTelemetry;
    this.generateCorrelationId = dependencies.generateCorrelationId;
    this.clock = dependencies.clock ?? (() => new Date());
  }

  async run<T>(input: RunNutriFlowOperationInput<T>): Promise<NutriFlowOperationResult<T>> {
    const correlationId = resolveCorrelationId(
      input.suppliedCorrelationId,
      this.generateCorrelationId,
    );
    const now = this.clock();
    const data = await observeNutriFlowOperation({
      operation: input.operation,
      correlationId,
      telemetry: this.telemetry,
      execute: async () => {
        const evaluation = await evaluateFeatureFlag({
          flag: input.flag,
          context: {
            organizationId: input.organizationId,
            clientId: input.resource.clientId,
            correlationId,
            now,
          },
          repository: this.flags,
          telemetry: this.flagTelemetry,
        });
        if (!evaluation.enabled) {
          throw new NutriFlowApplicationError(
            NUTRIFLOW_ERROR_CODES.FEATURE_DISABLED,
            "Recurso indisponível.",
            404,
          );
        }

        assertNutriFlowAuthorized(input.actor, input.action, input.resource, now);
        const execute = () => input.execute(Object.freeze({ correlationId, now }));
        if (!input.idempotency) return execute();
        return executeIdempotently({
          repository: this.idempotency,
          organizationId: input.organizationId,
          operation: input.operation,
          idempotencyKey: input.idempotency.key,
          requestHash: input.idempotency.requestHash,
          correlationId,
          now,
          ttlMilliseconds: input.idempotency.ttlMilliseconds,
          deserialize: input.idempotency.deserialize,
          execute,
        });
      },
    });
    return Object.freeze({ correlationId, data });
  }
}
