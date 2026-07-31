import assert from "node:assert/strict";
import test from "node:test";
import { NutriFlowApplicationError } from "../modules/nutriflow/application/errors/nutriflow-application-error.ts";
import {
  observeNutriFlowOperation,
  resolveCorrelationId,
  type NutriFlowOperationMetric,
} from "../modules/nutriflow/application/observability/operation-telemetry.ts";

test("correlation id is propagated or generated with a strict safe format", () => {
  assert.equal(resolveCorrelationId("corr_request_01", () => "unused_value"), "corr_request_01");
  assert.equal(resolveCorrelationId(null, () => "corr_generated_01"), "corr_generated_01");
  assert.throws(
    () => resolveCorrelationId("bad id", () => "unused_value"),
    (error) =>
      error instanceof NutriFlowApplicationError && error.code === "NF_INVALID_INPUT",
  );
});

test("telemetry records only operational fields on success", async () => {
  const metrics: NutriFlowOperationMetric[] = [];
  const times = [100, 112];
  const result = await observeNutriFlowOperation({
    operation: "plan.save-draft",
    correlationId: "corr_metric_01",
    telemetry: {
      record: (metric) => {
        metrics.push(metric);
      },
    },
    now: () => times.shift() ?? 112,
    execute: async () => "saved",
  });

  assert.equal(result, "saved");
  assert.deepEqual(metrics, [
    {
      operation: "plan.save-draft",
      correlationId: "corr_metric_01",
      result: "success",
      durationMs: 12,
      errorCode: null,
    },
  ]);
  assert.equal(JSON.stringify(metrics).includes("Banana"), false);
});

test("telemetry maps expected and unexpected failures to stable codes", async () => {
  const metrics: NutriFlowOperationMetric[] = [];
  await assert.rejects(
    observeNutriFlowOperation({
      operation: "plan.publish",
      correlationId: "corr_metric_02",
      telemetry: {
        record: (metric) => {
          metrics.push(metric);
        },
      },
      execute: async () => {
        throw new NutriFlowApplicationError("NF_VERSION_CONFLICT", "Conflito.", 409);
      },
    }),
  );
  await assert.rejects(
    observeNutriFlowOperation({
      operation: "plan.publish",
      correlationId: "corr_metric_03",
      telemetry: {
        record: (metric) => {
          metrics.push(metric);
        },
      },
      execute: async () => {
        throw new Error("database details must not be logged");
      },
    }),
  );

  assert.equal(metrics[0].errorCode, "NF_VERSION_CONFLICT");
  assert.equal(metrics[1].errorCode, "NF_INTERNAL_ERROR");
  assert.equal(JSON.stringify(metrics).includes("database details"), false);
});
