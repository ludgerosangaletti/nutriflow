import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("../app/notification-opt-in.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("../app/patient-experience/PatientHomeExperience.tsx", import.meta.url), "utf8");
const unsubscribe = readFileSync(new URL("../app/api/push/unsubscribe/route.ts", import.meta.url), "utf8");

test("área do paciente expõe ativação e desativação no mesmo dispositivo", () => {
  assert.match(home, /<NotificationOptIn \/>/);
  assert.match(component, /Ativar notificações/);
  assert.match(component, /Desativar/);
  assert.match(component, /pushManager\.getSubscription\(\)/);
  assert.match(component, /subscription\.unsubscribe\(\)/);
});

test("desativação remove somente a inscrição pertencente ao paciente autenticado", () => {
  assert.match(unsubscribe, /removeSubscriptionForClient\(user\.email, body\.endpoint\)/);
  assert.doesNotMatch(unsubscribe, /removeSubscription\(body\.endpoint\)/);
});
