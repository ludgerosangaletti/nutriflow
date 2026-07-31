import assert from "node:assert/strict";
import test from "node:test";
import { NutriFlowOperationRunner } from "../modules/nutriflow/application/operations/run-nutriflow-operation.ts";
import type {
  BeginIdempotentOperationInput,
  IdempotencyRecord,
  IdempotencyRepository,
} from "../modules/nutriflow/application/ports/idempotency-repository.ts";
import type { NutriFlowOperationMetric } from "../modules/nutriflow/application/observability/operation-telemetry.ts";
import { NUTRIFLOW_ACTIONS } from "../modules/nutriflow/application/security/authorization.ts";
import { NUTRIFLOW_FEATURE_FLAGS } from "../modules/nutriflow/config/feature-flags.ts";

class MemoryIdempotencyRepository implements IdempotencyRepository {
  readonly records = new Map<string, IdempotencyRecord>();
  async begin(input: BeginIdempotentOperationInput) {
    const key = `${input.organizationId}:${input.operation}:${input.idempotencyKey}`;
    const existing = this.records.get(key);
    if (existing) return { outcome: "existing" as const, record: existing };
    this.records.set(key, {
      requestHash: input.requestHash,
      status: "processing",
      responseJson: null,
      errorCode: null,
      correlationId: input.correlationId,
      expiresAt: input.expiresAt,
    });
    return { outcome: "acquired" as const };
  }
  async complete(input: Parameters<IdempotencyRepository["complete"]>[0]) {
    const key = `${input.organizationId}:${input.operation}:${input.idempotencyKey}`;
    const current = this.records.get(key);
    if (!current) throw new Error("missing idempotency record");
    this.records.set(key, { ...current, status: "completed", responseJson: input.responseJson });
  }
  async fail(input: Parameters<IdempotencyRepository["fail"]>[0]) {
    const key = `${input.organizationId}:${input.operation}:${input.idempotencyKey}`;
    const current = this.records.get(key);
    if (!current) throw new Error("missing idempotency record");
    this.records.set(key, { ...current, status: "failed", errorCode: input.errorCode });
  }
}

const staff = Object.freeze({
  kind: "staff" as const,
  authUserId: "auth_01",
  organizationPublicId: "org_01",
  role: "nutritionist" as const,
  membershipStatus: "active" as const,
});

const resource = Object.freeze({ organizationPublicId: "org_01", clientId: 1 });

function createRunner(enabled: boolean) {
  const metrics: NutriFlowOperationMetric[] = [];
  const idempotency = new MemoryIdempotencyRepository();
  const runner = new NutriFlowOperationRunner({
    flags: {
      findOverride: async () => ({
        enabled,
        variant: enabled ? "test-account" : "off",
        scope: "client",
        expiresAt: null,
      }),
    },
    idempotency,
    telemetry: { record: (metric) => { metrics.push(metric); } },
    generateCorrelationId: () => "corr_generated_01",
    clock: () => new Date("2026-07-31T15:00:00.000Z"),
  });
  return { runner, metrics, idempotency };
}

test("the application boundary blocks a disabled feature before executing", async () => {
  const { runner, metrics } = createRunner(false);
  let executed = false;
  await assert.rejects(
    runner.run({
      operation: "plan.create",
      flag: NUTRIFLOW_FEATURE_FLAGS.ADMIN_EDITOR,
      actor: staff,
      action: NUTRIFLOW_ACTIONS.CREATE_PLAN,
      resource,
      organizationId: 1,
      execute: async () => {
        executed = true;
        return { ok: true };
      },
    }),
    (error: unknown) => error instanceof Error && error.message === "Recurso indisponível.",
  );
  assert.equal(executed, false);
  assert.equal(metrics[0]?.errorCode, "NF_FEATURE_DISABLED");
});

test("the application boundary checks object authorization before execution", async () => {
  const { runner, metrics } = createRunner(true);
  let executed = false;
  await assert.rejects(
    runner.run({
      operation: "plan.create",
      flag: NUTRIFLOW_FEATURE_FLAGS.ADMIN_EDITOR,
      actor: staff,
      action: NUTRIFLOW_ACTIONS.CREATE_PLAN,
      resource: { ...resource, organizationPublicId: "org_other" },
      organizationId: 1,
      execute: async () => {
        executed = true;
        return { ok: true };
      },
    }),
  );
  assert.equal(executed, false);
  assert.equal(metrics[0]?.errorCode, "NF_FORBIDDEN");
});

test("the application boundary composes correlation, idempotency and telemetry", async () => {
  const { runner, metrics } = createRunner(true);
  let executions = 0;
  const command = {
    operation: "plan.create",
    suppliedCorrelationId: "corr_request_05",
    flag: NUTRIFLOW_FEATURE_FLAGS.ADMIN_EDITOR,
    actor: staff,
    action: NUTRIFLOW_ACTIONS.CREATE_PLAN,
    resource,
    organizationId: 1,
    idempotency: {
      key: "idem_runner_01",
      requestHash: "hash_runner_01",
      deserialize: (value: string) => JSON.parse(value) as { planPublicId: string },
    },
    execute: async ({ correlationId }: { correlationId: string }) => ({
      planPublicId: `plan_${++executions}_${correlationId}`,
    }),
  };
  const first = await runner.run(command);
  const replay = await runner.run(command);
  assert.deepEqual(replay, first);
  assert.equal(executions, 1);
  assert.equal(first.correlationId, "corr_request_05");
  assert.equal(metrics.length, 2);
  assert.equal(metrics.every(({ result }) => result === "success"), true);
});

test("nutritionists cannot configure rollout flags", async () => {
  const { runner } = createRunner(true);
  await assert.rejects(
    runner.run({
      operation: "feature-flag.configure",
      flag: NUTRIFLOW_FEATURE_FLAGS.ADMIN_EDITOR,
      actor: staff,
      action: NUTRIFLOW_ACTIONS.CONFIGURE_FEATURE_FLAG,
      resource,
      organizationId: 1,
      execute: async () => ({ ok: true }),
    }),
  );
});
