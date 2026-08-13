import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("../app/notification-opt-in.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("../app/patient-experience/PatientHomeExperience.tsx", import.meta.url), "utf8");
const unsubscribe = readFileSync(new URL("../app/api/push/unsubscribe/route.ts", import.meta.url), "utf8");
const publicKey = readFileSync(new URL("../app/api/push/public-key/route.ts", import.meta.url), "utf8");

test("área do paciente expõe ativação e desativação no mesmo dispositivo", () => {
  assert.match(home, /<NotificationOptIn \/>/);
  assert.match(component, /Ativar notificações/);
  assert.match(component, /Desativar/);
  assert.match(component, /pushManager\.getSubscription\(\)/);
  assert.match(component, /subscription\.unsubscribe\(\)/);
});

test("ativação lê a chave pública no runtime e orienta a instalação no iPhone", () => {
  assert.match(component, /fetch\("\/api\/push\/public-key"/);
  assert.doesNotMatch(component, /process\.env\.NEXT_PUBLIC_VAPID_PUBLIC_KEY/);
  assert.match(component, /isIosBrowser\(\) && !isStandaloneApp\(\)/);
  assert.match(component, /Adicionar à Tela de Início/);
  assert.match(publicKey, /process\.env\.VAPID_PUBLIC_KEY/);
  assert.doesNotMatch(publicKey, /VAPID_PRIVATE_KEY/);
});

test("desativação remove somente a inscrição pertencente ao paciente autenticado", () => {
  assert.match(unsubscribe, /removeSubscriptionForClient\(user\.email, body\.endpoint\)/);
  assert.doesNotMatch(unsubscribe, /removeSubscription\(body\.endpoint\)/);
});
