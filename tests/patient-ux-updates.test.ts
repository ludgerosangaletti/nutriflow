import assert from "node:assert/strict";
import test from "node:test";
import { buildCheckInFormData, CHECKIN_QUESTIONS, validateNumberAnswer } from "../app/check-in/check-in-model.ts";
import { buildTrainingWhatsAppUrl } from "../app/patient-experience/training-offer.ts";

test("check-in validates the required numeric ranges", () => {
  const weight = CHECKIN_QUESTIONS.find((question) => question.id === "weightKg")!;
  const training = CHECKIN_QUESTIONS.find((question) => question.id === "trainingSessions")!;
  assert.equal(validateNumberAnswer(weight, ""), "Informe seu peso para continuar.");
  assert.equal(validateNumberAnswer(weight, "75,9"), null);
  assert.match(validateNumberAnswer(weight, "401"), /entre 20 e 400/);
  assert.equal(validateNumberAnswer(training, "2.5"), "Informe um número inteiro.");
  assert.equal(validateNumberAnswer(training, "0"), null);
});

test("check-in sends real API keys and omits an empty optional note", () => {
  const data = buildCheckInFormData({ weightKg: 75.9, trainingSessions: 0, adherence: 4, notes: "" });
  assert.equal(data.get("weightKg"), "75.9");
  assert.equal(data.get("trainingSessions"), "0");
  assert.equal(data.get("adherence"), "4");
  assert.equal(data.has("notes"), false);
});

test("training FAQ prepares an identified WhatsApp conversation", () => {
  const url = new URL(buildTrainingWhatsAppUrl({ phone: "+55 (42) 99984-6280", patientFirstName: "Marina", nutritionistName: "Ludgero" }));
  assert.equal(url.hostname, "wa.me");
  assert.equal(url.pathname, "/5542999846280");
  assert.match(url.searchParams.get("text") ?? "", /Sou Marina/);
  assert.match(url.searchParams.get("text") ?? "", /acompanhamento de treino/);
});
