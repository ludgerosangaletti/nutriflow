import assert from "node:assert/strict";
import test from "node:test";
import {
  activationTemplatePayload,
  normalizeActivationRecipient,
  sendActivationWhatsApp,
  validActivationPath,
} from "../app/whatsapp-activation.ts";

test("normaliza telefone brasileiro e valida somente caminhos de ativação", () => {
  assert.equal(normalizeActivationRecipient("(42) 99988-9176"), "5542999889176");
  assert.equal(normalizeActivationRecipient("+55 42 99988-9176"), "5542999889176");
  assert.equal(validActivationPath("/ativar-conta?token_hash=abc_123&type=magiclink"), true);
  assert.equal(validActivationPath("https://outro-site.test/token"), false);
});

test("monta template utilitário com primeiro nome e botão dinâmico", () => {
  const payload = activationTemplatePayload({
    accessToken: "token",
    phoneNumberId: "phone-id",
    templateName: "ativacao_conta_presencial_v1",
    recipient: "42999889176",
    patientName: "Maria da Silva",
    activationPath: "/ativar-conta?token_hash=abc_123&type=invite",
  });
  assert.equal(payload.to, "5542999889176");
  assert.equal(payload.template.components[0].parameters[0].text, "Maria");
  assert.equal(
    payload.template.components[1].parameters[0].text,
    "ativar-conta?token_hash=abc_123&type=invite",
  );
});

test("não chama a Meta quando o template ainda não está configurado", async () => {
  let called = false;
  const result = await sendActivationWhatsApp(
    {
      recipient: "42999889176",
      patientName: "Maria",
      activationPath: "/ativar-conta?token_hash=abc&type=magiclink",
    },
    async () => {
      called = true;
      return new Response();
    },
  );
  assert.equal(result.status, "not_configured");
  assert.equal(called, false);
});

test("registra o identificador devolvido pela Meta", async () => {
  const result = await sendActivationWhatsApp(
    {
      accessToken: "token",
      phoneNumberId: "phone-id",
      templateName: "ativacao_conta_presencial_v1",
      recipient: "42999889176",
      patientName: "Maria",
      activationPath: "/ativar-conta?token_hash=abc&type=magiclink",
    },
    async () =>
      Response.json({ messages: [{ id: "wamid.123" }] }, { status: 200 }),
  );
  assert.deepEqual(result, { status: "sent", providerId: "wamid.123", error: null });
});
