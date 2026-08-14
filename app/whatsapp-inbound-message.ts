export type WhatsAppInboundMessage = Readonly<{
  type?: string;
  text?: Readonly<{ body?: string }>;
  button?: Readonly<{ payload?: string; text?: string }>;
  interactive?: Readonly<{
    button_reply?: Readonly<{ id?: string; title?: string }>;
    list_reply?: Readonly<{ id?: string; title?: string }>;
  }>;
}>;

function firstNonEmpty(values: Array<string | undefined>) {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) return normalized;
  }
  return null;
}

export function extractWhatsAppInboundMessageBody(
  message: WhatsAppInboundMessage,
) {
  return firstNonEmpty([
    message.text?.body,
    message.button?.payload,
    message.button?.text,
    message.interactive?.list_reply?.id,
    message.interactive?.list_reply?.title,
    message.interactive?.button_reply?.id,
    message.interactive?.button_reply?.title,
  ]);
}
