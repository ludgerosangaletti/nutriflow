export const ACTIVATION_TEMPLATE_LANGUAGE = "pt_BR";

export type ActivationWhatsAppStatus =
  | "sent"
  | "failed"
  | "not_configured";

export type ActivationWhatsAppResult = {
  status: ActivationWhatsAppStatus;
  providerId?: string | null;
  error?: string | null;
};

type SendActivationWhatsAppInput = {
  accessToken?: string;
  phoneNumberId?: string;
  templateName?: string;
  recipient: string;
  patientName: string;
  activationPath: string;
};

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || "Paciente";
}

export function normalizeActivationRecipient(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") || digits.length >= 12 ? digits : `55${digits}`;
}

export function validActivationPath(value: string) {
  return /^\/ativar-conta\?token_hash=[A-Za-z0-9_%.-]+&type=(invite|magiclink)$/.test(
    value,
  );
}

export function activationTemplatePayload(input: SendActivationWhatsAppInput) {
  const recipient = normalizeActivationRecipient(input.recipient);
  if (!recipient || !validActivationPath(input.activationPath)) {
    throw new Error("Destinatário ou link de ativação inválido.");
  }
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "template",
    template: {
      name: input.templateName,
      language: { code: ACTIVATION_TEMPLATE_LANGUAGE },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: firstName(input.patientName) }],
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [
            { type: "text", text: input.activationPath.replace(/^\//, "") },
          ],
        },
      ],
    },
  };
}

export async function sendActivationWhatsApp(
  input: SendActivationWhatsAppInput,
  fetcher: typeof fetch = fetch,
): Promise<ActivationWhatsAppResult> {
  if (!input.accessToken || !input.phoneNumberId || !input.templateName) {
    return { status: "not_configured", error: "Template não configurado." };
  }

  let payload: ReturnType<typeof activationTemplatePayload>;
  try {
    payload = activationTemplatePayload(input);
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Dados inválidos.",
    };
  }

  try {
    const response = await fetcher(
      `https://graph.facebook.com/v23.0/${input.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${input.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    const result = (await response.json().catch(() => ({}))) as {
      error?: { message?: string; code?: number };
      messages?: Array<{ id?: string }>;
    };
    if (!response.ok) {
      return {
        status: "failed",
        error: String(
          result.error?.message ||
            `A Meta recusou o envio (${response.status}).`,
        ).slice(0, 500),
      };
    }
    return {
      status: "sent",
      providerId: result.messages?.[0]?.id || null,
      error: null,
    };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message.slice(0, 500) : "Falha de rede.",
    };
  }
}
