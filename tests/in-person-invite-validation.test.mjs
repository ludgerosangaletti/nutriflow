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
    "Confirme a autorização para mensagens transacionais no WhatsApp.",
    "Selecione um plano válido.",
    "Informe o início da vigência.",
  ]) {
    assert.match(route, new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(route, /error: "Preencha os dados obrigatórios\."/);
});
