import assert from "node:assert/strict";
import test from "node:test";
import { extractWhatsAppInboundMessageBody } from "../app/whatsapp-inbound-message.ts";

test("lê a resposta rápida enviada por um modelo do WhatsApp", () => {
  assert.equal(
    extractWhatsAppInboundMessageBody({
      type: "button",
      button: {
        payload: "confirmar_retorno",
        text: "Confirmar retorno",
      },
    }),
    "confirmar_retorno",
  );
});

test("usa o texto visível quando o botão de modelo não traz payload", () => {
  assert.equal(
    extractWhatsAppInboundMessageBody({
      type: "button",
      button: { text: "Remarcar retorno" },
    }),
    "Remarcar retorno",
  );
});

test("continua lendo botões e listas interativas pelo identificador", () => {
  assert.equal(
    extractWhatsAppInboundMessageBody({
      type: "interactive",
      interactive: {
        button_reply: { id: "cancelar_retorno", title: "Cancelar retorno" },
      },
    }),
    "cancelar_retorno",
  );

  assert.equal(
    extractWhatsAppInboundMessageBody({
      type: "interactive",
      interactive: {
        list_reply: { id: "slot_2026-08-20", title: "20/08/2026" },
      },
    }),
    "slot_2026-08-20",
  );
});

test("não transforma mídia em mensagem de texto", () => {
  assert.equal(
    extractWhatsAppInboundMessageBody({ type: "image" }),
    null,
  );
});
