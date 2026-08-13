import { normalizeMetaBrazilRecipient } from "./appointment-scheduling.ts";

export type ContentReadyKind = "diet" | "training";

export type ContentReadyWhatsAppResult = Readonly<{
  status: "accepted" | "failed" | "not_configured" | "not_authorized";
  providerId?: string | null;
  error?: string | null;
}>;

type Input = Readonly<{
  accessToken?: string;
  phoneNumberId?: string;
  templateName?: string;
  recipient: string;
  patientName: string;
  kind: ContentReadyKind;
  authorized: boolean;
}>;

export function contentReadyTemplatePayload(input: Input) {
  const recipient = normalizeMetaBrazilRecipient(input.recipient);
  if (!recipient) throw new Error("Destinatário inválido.");
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "template",
    template: {
      name: input.templateName,
      language: { code: "pt_BR" },
      components: [{
        type: "body",
        parameters: [{ type: "text", text: input.patientName.trim().split(/\s+/)[0] || "Paciente" }],
      }],
    },
  };
}

export async function sendContentReadyWhatsApp(
  input: Input,
  fetcher: typeof fetch = fetch,
): Promise<ContentReadyWhatsAppResult> {
  if (!input.authorized) return { status: "not_authorized", error: null };
  if (!input.accessToken || !input.phoneNumberId || !input.templateName) {
    return { status: "not_configured", error: "Template não configurado." };
  }
  try {
    const response = await fetcher(`https://graph.facebook.com/v25.0/${input.phoneNumberId}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${input.accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(contentReadyTemplatePayload(input)),
    });
    const result = await response.json().catch(() => ({})) as { error?: { message?: string }; messages?: Array<{ id?: string }> };
    if (!response.ok) return { status: "failed", error: String(result.error?.message || `A Meta recusou o envio (${response.status}).`).slice(0, 500) };
    return { status: "accepted", providerId: result.messages?.[0]?.id || null, error: null };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message.slice(0, 500) : "Falha de rede." };
  }
}
