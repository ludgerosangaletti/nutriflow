import assert from "node:assert/strict";
import test from "node:test";
import { isWeeklyCheckInAvailable, nextCheckInDateLabel } from "../app/check-in/availability.ts";

test("check-in semanal abre somente na segunda-feira de São Paulo", () => {
  assert.equal(isWeeklyCheckInAvailable(new Date("2026-08-10T15:00:00Z")), true);
  assert.equal(isWeeklyCheckInAvailable(new Date("2026-08-11T15:00:00Z")), false);
  assert.match(nextCheckInDateLabel(new Date("2026-08-08T15:00:00Z")), /segunda-feira/i);
});
