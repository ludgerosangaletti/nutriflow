const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";

const triggers = {
  presencial: "gostaria de saber mais sobre os planos da consulta presencial",
  online: "gostaria de saber mais sobre os planos da consultoria online",
  mentoria: "gostaria de saber mais sobre os planos da mentoria de emagrecimento",
  avaliacao: "gostaria de agendar uma avaliacao fisica",
} as const;

const replies = {
  presencial: `Olá! Que bom receber seu interesse no acompanhamento presencial 😊

O atendimento é individualizado e inclui avaliação completa, análise da rotina, definição de estratégias e planejamento alimentar personalizado conforme seus objetivos.

*Planos disponíveis:*

🔹 *Mensal*
R$ 350,00

🔹 *Trimestral — 10% de desconto*
R$ 945,00
Equivalente a R$ 315,00 por mês

🔹 *Semestral — 20% de desconto*
R$ 1.680,00
Equivalente a R$ 280,00 por mês

Para agendar ou esclarecer alguma dúvida, responda a esta mensagem. Assim que possível, continuarei seu atendimento pessoalmente.`,

  online: `Olá! Que bom receber seu interesse na consultoria on-line 😊

Todo o processo é realizado pela minha plataforma: você poderá conhecer os planos, realizar o pagamento, preencher sua anamnese e acompanhar sua evolução pela área do paciente.

Acesse:
https://ludgerosangaletti.com.br

Se permanecer alguma dúvida antes da contratação, responda a esta mensagem. Assim que possível, continuarei seu atendimento pessoalmente.`,

  mentoria: `Olá! Que bom receber seu interesse na mentoria individual 😊

A mentoria consiste em uma chamada on-line, com aproximadamente *50 minutos de duração*, para esclarecer dúvidas e conversar de maneira aprofundada sobre um tema relacionado à nutrição, alimentação, suplementação, desempenho esportivo ou organização da rotina alimentar.

Antes da sessão, você poderá informar o assunto e enviar suas principais dúvidas. Assim, consigo direcionar a conversa e aproveitar melhor o nosso tempo.

*Investimento: R$ 200,00 por sessão.*

A mentoria possui caráter pontual e educativo. Ela não inclui anamnese clínica, elaboração de plano alimentar ou acompanhamento posterior. Caso seja necessário um atendimento individualizado com prescrição, indicarei a consulta ou consultoria mais adequada.

Para agendar, envie:
• Seu nome completo;
• O tema que deseja abordar;
• Suas principais dúvidas;
• Dias e horários disponíveis.`,

  avaliacao: `Olá! Que bom receber seu interesse na avaliação física 😊

A avaliação inclui:

✅ Antropometria completa;
✅ Medidas de circunferências e demais indicadores corporais;
✅ Exame de bioimpedância;
✅ Análise dos resultados.

*Investimento: R$ 150,00.*

Para solicitar um horário, responda a esta mensagem informando seu nome e os dias e períodos em que possui disponibilidade.`,
} as const;

type Trigger = keyof typeof triggers;

type WhatsAppWebhook = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from?: string;
          type?: string;
          text?: { body?: string };
        }>;
      };
    }>;
  }>;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findTrigger(message: string): Trigger | null {
  const normalized = normalize(message);
  const match = Object.entries(triggers).find(([, trigger]) =>
    normalized.includes(trigger),
  );
  return (match?.[0] as Trigger | undefined) || null;
}

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(first: string, second: string) {
  if (first.length !== second.length) return false;
  let difference = 0;
  for (let index = 0; index < first.length; index += 1) {
    difference |= first.charCodeAt(index) ^ second.charCodeAt(index);
  }
  return difference === 0;
}

async function hasValidSignature(request: Request, body: string) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const received = request.headers.get("x-hub-signature-256");
  if (!appSecret || !received?.startsWith("sha256=")) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  return timingSafeEqual(received.slice(7), bytesToHex(signature));
}

async function sendText(to: string, body: string) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    throw new Error("Configuração do WhatsApp incompleta.");
  }

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: true, body },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Falha ao enviar mensagem: ${response.status} ${detail}`);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token &&
    token === process.env.WHATSAPP_VERIFY_TOKEN &&
    challenge
  ) {
    return new Response(challenge, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return new Response("Verificação recusada.", { status: 403 });
}

export async function POST(request: Request) {
  const body = await request.text();
  if (!(await hasValidSignature(request, body))) {
    return new Response("Assinatura inválida.", { status: 401 });
  }

  let payload: WhatsAppWebhook;
  try {
    payload = JSON.parse(body) as WhatsAppWebhook;
  } catch {
    return new Response("Conteúdo inválido.", { status: 400 });
  }

  const messages =
    payload.entry?.flatMap(
      (entry) =>
        entry.changes?.flatMap((change) => change.value?.messages || []) || [],
    ) || [];

  for (const message of messages) {
    if (message.type !== "text" || !message.from || !message.text?.body) continue;
    const trigger = findTrigger(message.text.body);
    if (trigger) await sendText(message.from, replies[trigger]);
  }

  return Response.json({ received: true });
}
