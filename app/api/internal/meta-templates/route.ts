import { env } from "cloudflare:workers";
import {
  ACTIVATION_TEMPLATE_NAME,
  activationTemplateDefinition,
  templateSummaries,
} from "../../../meta-templates";

function safeEqual(received: string, expected: string) {
  if (received.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < received.length; index += 1) {
    difference |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

function metaError(value: unknown) {
  if (!value || typeof value !== "object") return "A Meta recusou a operação.";
  const error = (value as { error?: unknown }).error;
  if (!error || typeof error !== "object") return "A Meta recusou a operação.";
  const message = (error as { message?: unknown }).message;
  return typeof message === "string"
    ? message.slice(0, 500)
    : "A Meta recusou a operação.";
}

async function listTemplates(input: {
  accessToken: string;
  apiVersion: string;
  businessAccountId: string;
}) {
  const fields = encodeURIComponent("id,name,status,category,language");
  const response = await fetch(
    `https://graph.facebook.com/${input.apiVersion}/${input.businessAccountId}/message_templates?fields=${fields}&limit=250`,
    { headers: { authorization: `Bearer ${input.accessToken}` } },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(metaError(payload));
  return templateSummaries(payload);
}

export async function POST(request: Request) {
  const suppliedSecret = request.headers.get("x-checkin-reminder-secret") || "";
  const expectedSecret = env.CHECKIN_REMINDER_SECRET || "";
  if (!expectedSecret || !safeEqual(suppliedSecret, expectedSecret)) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { action?: string };
  const action = String(body.action || "inspect");
  if (!["inspect", "inspect_and_submit_activation"].includes(action)) {
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || "";
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "";
  const apiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || "v25.0";
  if (!accessToken || !businessAccountId) {
    return Response.json(
      { error: "Configuração da conta WhatsApp incompleta." },
      { status: 500 },
    );
  }

  try {
    let templates = await listTemplates({
      accessToken,
      apiVersion,
      businessAccountId,
    });
    let activation = templates.find(
      (template) =>
        template.name === ACTIVATION_TEMPLATE_NAME &&
        template.language === "pt_BR",
    );
    let submitted = false;

    if (!activation && action === "inspect_and_submit_activation") {
      const response = await fetch(
        `https://graph.facebook.com/${apiVersion}/${businessAccountId}/message_templates`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(activationTemplateDefinition()),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        return Response.json(
          {
            ok: false,
            action,
            error: metaError(payload),
            templates,
          },
          { status: 502 },
        );
      }
      submitted = true;
      templates = await listTemplates({
        accessToken,
        apiVersion,
        businessAccountId,
      });
      activation = templates.find(
        (template) =>
          template.name === ACTIVATION_TEMPLATE_NAME &&
          template.language === "pt_BR",
      );
    }

    return Response.json({
      ok: true,
      action,
      submitted,
      activation: activation || null,
      activationReady: activation?.status === "APPROVED",
      templates,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Falha ao consultar a Meta.",
      },
      { status: 502 },
    );
  }
}
