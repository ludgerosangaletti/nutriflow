import type { TrainingPrescriptionMetricV1 } from "../../contracts/v1/training.ts";

export function assertTrainingPrescriptionMetric(metric: TrainingPrescriptionMetricV1) {
  const repetitions = metric.repetitions;
  const hasRepetitions = repetitions !== null && Number.isInteger(repetitions.min) && Number.isInteger(repetitions.max) && repetitions.min > 0 && repetitions.max >= repetitions.min;
  const hasDuration = metric.durationSeconds !== null && Number.isInteger(metric.durationSeconds) && metric.durationSeconds > 0;
  if (!hasRepetitions && !hasDuration) throw new Error("NUTRIFLOW_TRAINING_EXECUTION_METRIC_REQUIRED");
  if (metric.sets !== null && (!Number.isInteger(metric.sets) || metric.sets <= 0)) throw new Error("NUTRIFLOW_TRAINING_INVALID_SETS");
  if (metric.restSeconds !== null && (!Number.isInteger(metric.restSeconds) || metric.restSeconds < 0)) throw new Error("NUTRIFLOW_TRAINING_INVALID_REST");
  return Object.freeze(metric);
}
