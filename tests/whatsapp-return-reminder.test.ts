import assert from "node:assert/strict";
import test from "node:test";
import { returnReminderTemplatePayload, sendReturnReminderWhatsApp } from "../app/whatsapp-return-reminder.ts";

const input = {
  accessToken: "token",
  phoneNumberId: "phone",
  templateName: "lembrete_retorno_presencial",
  recipient: "(42) 98867-4554",
  patientName: "Ludgero Sangaletti",
  appointmentAt: "2026-08-14T15:00:00.000Z",
};

test("modelo de retorno normaliza o destino e usa exatamente duas variáveis", () => {
  const payload = returnReminderTemplatePayload(input);
  assert.equal(payload.to, "5542988674554");
  assert.equal(payload.template.name, "lembrete_retorno_presencial");
  assert.deepEqual(payload.template.components[0].parameters.map((parameter) => parameter.text), ["Ludgero", "14/08/2026, 12:00"]);
});

test("envio de retorno registra somente o identificador aceito pela Meta", async () => {
  let calls = 0;
  const result = await sendReturnReminderWhatsApp(input, async () => {
    calls += 1;
    return Response.json({ messages: [{ id: "wamid.controlled" }] }, { status: 200 });
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, { status: "sent", providerId: "wamid.controlled", error: null });
});
