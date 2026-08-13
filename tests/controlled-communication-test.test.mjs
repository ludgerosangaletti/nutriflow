import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/internal/communication-test/route.ts", import.meta.url), "utf8");

test("teste controlado exige segredo, faz claim atômico e não repete a entrega", () => {
  assert.match(route, /x-checkin-reminder-secret/);
  assert.match(route, /INSERT OR IGNORE INTO patient_activation_messages/);
  assert.match(route, /duplicate: true/);
  assert.match(route, /controlled-test:\$\{channel\}:\$\{testId\}/);
});

test("push controlado seleciona apenas a inscrição mais recentemente atualizada", () => {
  assert.match(route, /sort\(\(left, right\) => right\.updatedAt\.localeCompare\(left\.updatedAt\)\)\[0\]/);
  assert.doesNotMatch(route, /sendPushToClient\(/);
});
