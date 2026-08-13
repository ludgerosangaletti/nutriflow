import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const form = readFileSync(
  new URL("../app/admin/clientes/in-person-invite-form.tsx", import.meta.url),
  "utf8",
);
const route = readFileSync(
  new URL("../app/api/admin/pacientes-presenciais/route.ts", import.meta.url),
  "utf8",
);

test("cadastro presencial valida o WhatsApp antes de enviar", () => {
  assert.match(form, /isValidBrazilPhone\(whatsapp\)/);
  assert.match(form, /Use DDD \+ número, com 10 ou 11 dígitos\./);
  assert.match(form, /maxLength=\{19\}/);
});

test("API informa precisamente qual dado do cadastro presencial é inválido", () => {
  for (const message of [
    "Informe um e-mail válido.",
    "Informe o nome do paciente.",
    "Informe um WhatsApp brasileiro válido com DDD e 10 ou 11 dígitos.",
    "Selecione um plano válido.",
    "Informe o início da vigência.",
  ]) {
    assert.match(route, new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(route, /error: "Preencha os dados obrigatórios\."/);
});

test("opt-in do WhatsApp é opcional, explícito e auditável", () => {
  assert.doesNotMatch(form, /name="whatsappOptIn" required/);
  assert.match(form, /Paciente autorizou o contato pelo WhatsApp/);
  assert.match(form, /enviar somente por e-mail/);
  assert.match(route, /whatsappActivationOptInPhone: whatsappOptIn \? whatsapp : null/);
  assert.match(route, /whatsappActivationOptInVersion: whatsappOptIn/);
  assert.match(route, /whatsappActivationOptInText: whatsappOptIn/);
  assert.match(route, /whatsappActivationOptInRecordedBy: whatsappOptIn \? admin\.user\.id : null/);
  assert.match(route, /status: "not_authorized" as const/);
});
