import type { Pollock7Input } from "./pollock-7";

export type Pollock7Result = Readonly<{
  sumSkinfoldsMm: number;
  density: number;
  bodyFatPct: number;
  bmi: number;
  fatMassKg: number;
  leanMassKg: number;
}>;

export function pollock7AssessmentContent(input: Pollock7Input, result: Pollock7Result) {
  return { protocol: "pollock_7" as const, version: "1.0.0" as const, input, result };
}

export function pollock7AssessmentSnapshot(input: Pollock7Input, result: Pollock7Result, capturedAt: string) {
  return { ...pollock7AssessmentContent(input, result), capturedAt };
}
