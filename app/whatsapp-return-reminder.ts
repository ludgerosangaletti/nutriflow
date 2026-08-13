import { normalizeMetaBrazilRecipient } from "./appointment-scheduling.ts";

export type ReturnReminderWhatsAppResult = Readonly<{
  status: "accepted" | "failed" | "not_configured";
  providerId?: string | null;
  error?: string | null;
}>;

type ReturnReminderWhatsAppInput = Readonly<{
  accessToken?: string;
  phoneNumberId?: string;
  templateName?: string;
  recipient: string;
  patientName: string;
  appointmentAt: string;
}>;

export function returnReminderTemplatePayload(input: ReturnReminderWhatsAppInput) {
  const recipient = normalizeMetaBrazilRecipient(input.recipient);
  const appointmentDate = new Date(input.appointmentAt);
  if (!recipient || Number.isNaN(appointmentDate.getTime())) {
    throw new Error("Destinatário ou data do lembrete inválidos.");
  }
  const appointment = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(appointmentDate);
  const firstName = input.patientName.trim().split(/\s+/)[0] || "Paciente";
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
        parameters: [
          { type: "text", text: firstName },
          { type: "text", text: appointment },
        ],
      }],
    },
  };
}

export async function sendReturnReminderWhatsApp(
  input: ReturnReminderWhatsAppInput,
  fetcher: typeof fetch = fetch,
): Promise<ReturnReminderWhatsAppResult> {
  if (!input.accessToken || !input.phoneNumberId || !input.templateName) {
    return { status: "not_configured", error: "Template não configurado." };
  }
  let payload: ReturnType<typeof returnReminderTemplatePayload>;
  try {
    payload = returnReminderTemplatePayload(input);
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : "Dados inválidos." };
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
    const result = await response.json().catch(() => ({})) as {
      error?: { message?: string };
      messages?: Array<{ id?: string }>;
    };
    if (!response.ok) {
      return {
        status: "failed",
        error: String(result.error?.message || `A Meta recusou o envio (${response.status}).`).slice(0, 500),
      };
    }
    return { status: "accepted", providerId: result.messages?.[0]?.id || null, error: null };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message.slice(0, 500) : "Falha de rede." };
  }
}
