import assert from "node:assert/strict";
import test from "node:test";
import { contentReadyTemplatePayload, sendContentReadyWhatsApp } from "../app/whatsapp-content-ready.ts";

test("não envia conteúdo sem autorização do paciente", async () => {
  let called = false;
  const result = await sendContentReadyWhatsApp({ recipient: "42999889176", patientName: "Maria", kind: "diet", authorized: false }, async () => {
    called = true;
    return new Response();
  });
  assert.equal(result.status, "not_authorized");
  assert.equal(called, false);
});

test("monta o template aprovado com primeiro nome", () => {
  const payload = contentReadyTemplatePayload({ accessToken: "token", phoneNumberId: "phone", templateName: "plano_disponivel_v1", recipient: "42999889176", patientName: "Maria da Silva", kind: "diet", authorized: true });
  assert.equal(payload.to, "554299889176");
  assert.equal(payload.template.components[0].parameters[0].text, "Maria");
});

test("registra aceite da Meta", async () => {
  const result = await sendContentReadyWhatsApp({ accessToken: "token", phoneNumberId: "phone", templateName: "treino_disponivel_v1", recipient: "42999889176", patientName: "João", kind: "training", authorized: true }, async () => Response.json({ messages: [{ id: "wamid.456" }] }));
  assert.deepEqual(result, { status: "accepted", providerId: "wamid.456", error: null });
});
