const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";
const schedulingUrls = {
  presencial:
    "https://wa.me/5542999876280?text=Ol%C3%A1%2C%20recebi%20as%20informa%C3%A7%C3%B5es%20pelo%20atendimento%20autom%C3%A1tico%20e%20quero%20agendar%20uma%20consulta%20presencial.",
  mentoria:
    "https://wa.me/5542999876280?text=Ol%C3%A1%2C%20recebi%20as%20informa%C3%A7%C3%B5es%20pelo%20atendimento%20autom%C3%A1tico%20e%20quero%20agendar%20uma%20sess%C3%A3o%20de%20mentoria.",
  avaliacao:
    "https://wa.me/5542999876280?text=Ol%C3%A1%2C%20recebi%20as%20informa%C3%A7%C3%B5es%20pelo%20atendimento%20autom%C3%A1tico%20e%20quero%20agendar%20uma%20avalia%C3%A7%C3%A3o%20f%C3%ADsica.",
  geral:
    "https://wa.me/5542999876280?text=Ol%C3%A1%2C%20recebi%20as%20informa%C3%A7%C3%B5es%20pelo%20atendimento%20autom%C3%A1tico%20e%20quero%20prosseguir%20com%20um%20agendamento.",
} as const;

const triggers = {
  presencial: "gostaria de saber mais sobre os planos da consulta presencial",
  online: "gostaria de saber mais sobre os planos da consultoria online",
  mentoria: "gostaria de saber mais sobre os planos da mentoria de emagrecimento",
  avaliacao: "gostaria de agendar uma avaliacao fisica",
} as const;

const replies = {
  presencial: `Olá! Que bom receber seu interesse na consulta presencial 😊

A consulta presencial tem foco totalmente individualizado, com avaliação completa para entender seu momento atual e traçar uma estratégia alinhada aos seus objetivos, seja emagrecimento, ganho de massa muscular, performance esportiva ou melhora da saúde.

📋 *O que está incluso?*
✅ Avaliação física completa
✅ Antropometria e bioimpedância
✅ Planejamento alimentar personalizado
✅ Cronograma de metas e objetivos
✅ Acompanhamento e suporte durante o período contratado

💰 *Planos disponíveis:*

*Mensal*
• R$ 350,00

*Trimestral — 10% de desconto*
• R$ 939,90
(Equivalente a R$ 313,30 por mês)

*Semestral — 20% de desconto*
• R$ 1.679,90
(Equivalente a R$ 279,98 por mês)

Os planos trimestral e semestral costumam ser os mais procurados por proporcionarem melhor custo-benefício e um acompanhamento mais consistente para alcançar resultados duradouros.

💳 *Formas de pagamento*
• Plano mensal: pagamento à vista, em dinheiro ou Pix.
• Pacotes trimestral e semestral: pagamento à vista, em dinheiro ou Pix, ou parcelamento no cartão de crédito. No parcelamento, são aplicados os juros da maquininha, informados antes da confirmação.

O parcelamento no cartão não está disponível para a modalidade mensal.

*Quer prosseguir com o agendamento?*
Clique abaixo:
${schedulingUrls.presencial}`,

  online: `Olá! Que bom receber seu interesse na consultoria on-line 😊

A consultoria é realizada totalmente a distância e mantém o atendimento individualizado para objetivos como emagrecimento, ganho de massa muscular, performance esportiva e melhora da saúde.

📋 *Como funciona?*
✅ Você escolhe o plano e realiza seu cadastro pelo site;
✅ O pagamento é concluído no ambiente seguro da TON;
✅ Você preenche uma anamnese detalhada;
✅ Recebe planejamento alimentar personalizado;
✅ Acompanha metas, check-ins, ajustes, evolução e materiais pela área do paciente.

💳 O pagamento pode ser feito por Pix à vista ou cartão de crédito em até 12 vezes. No parcelamento, os juros aplicados pela TON são apresentados antes da confirmação.

A consultoria on-line não inclui antropometria ou bioimpedância presencial. Caso você precise apenas dessas medições, selecione a opção *Avaliação física* no menu.

Os planos, valores atualizados, cadastro e contratação estão disponíveis diretamente no site:
https://ludgerosangaletti.com.br

A contratação da consultoria on-line é concluída diretamente pela plataforma, sem necessidade de agendamento pelo WhatsApp.`,

  mentoria: `Olá! Que bom receber seu interesse na mentoria individual 😊

A mentoria consiste em uma chamada on-line individual, com aproximadamente *50 minutos de duração*, para esclarecer dúvidas e conversar de maneira aprofundada sobre um tema relacionado à nutrição, alimentação, suplementação, desempenho esportivo ou organização da rotina alimentar.

Antes da sessão, você poderá informar o assunto e enviar as principais dúvidas. Assim, a conversa será preparada para aproveitar melhor o tempo disponível.

*Investimento: R$ 200,00 por sessão.*

ℹ️ *Importante:* a mentoria tem caráter pontual e educativo. Ela não inclui anamnese clínica, avaliação física, elaboração ou prescrição de plano alimentar, nem acompanhamento após a sessão. Quando a necessidade envolver avaliação individual completa ou prescrição, a consulta presencial ou a consultoria on-line será a modalidade mais adequada.

Os horários disponíveis e a forma de pagamento são confirmados pelo atendimento no momento do agendamento.

*Quer prosseguir com o agendamento?*
Clique abaixo:
${schedulingUrls.mentoria}`,

  avaliacao: `Olá! Que bom receber seu interesse na avaliação física 😊

A avaliação inclui:

✅ Antropometria completa;
✅ Medidas de circunferências e demais indicadores corporais;
✅ Exame de bioimpedância;
✅ Análise dos resultados.

*Investimento: R$ 150,00.*

ℹ️ A avaliação física é um serviço pontual. Ela não inclui consulta nutricional, planejamento alimentar ou acompanhamento posterior. Caso você também queira uma estratégia nutricional completa, selecione *Consulta presencial* no menu.

Após o agendamento, você receberá as orientações de preparo para que as medidas e a bioimpedância sejam realizadas adequadamente. Os horários disponíveis e a forma de pagamento são confirmados pelo atendimento.

*Quer prosseguir com o agendamento?*
Clique abaixo:
${schedulingUrls.avaliacao}`,

  agendamento: `Perfeito! 😊

Para falar com o atendimento responsável e prosseguir com o agendamento, clique no link abaixo:
${schedulingUrls.geral}

Ao abrir a conversa, a mensagem de solicitação já estará preenchida para você.`,
} as const;

type Trigger = keyof typeof triggers;

const menu = `Olá! 👋 Você está falando com o *Atendimento Ludgero Sangaletti*.

Para direcionarmos sua dúvida, responda com o número de uma opção:

1️⃣ Consulta presencial
2️⃣ Consultoria on-line
3️⃣ Mentoria individual
4️⃣ Avaliação física
5️⃣ Já quero agendar

Você também pode escrever *menu*, *início* ou *voltar* a qualquer momento.`;

const unknownMessage = `Não consegui identificar qual atendimento você procura.

${menu}`;

const serviceClarification = `Para informar corretamente valores, pagamento, duração ou disponibilidade, preciso saber qual serviço você procura.

${menu}`;

const unsupportedMessage = `Recebi seu arquivo, mas este atendimento automático funciona por mensagens de texto.

${menu}`;

const menuCommands = new Set([
  "menu",
  "inicio",
  "voltar",
  "comecar",
  "recomecar",
  "ajuda",
  "oi",
  "ola",
  "bom dia",
  "boa tarde",
  "boa noite",
]);

const optionReplies = {
  "1": replies.presencial,
  "2": replies.online,
  "3": replies.mentoria,
  "4": replies.avaliacao,
  "5": replies.agendamento,
} as const;

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

function findNaturalReply(message: string): string | null {
  const normalized = normalize(message);
  const numericOption = normalized.match(/^[1-5]$/)?.[0] as
    | keyof typeof optionReplies
    | undefined;

  if (numericOption) return optionReplies[numericOption];
  if (menuCommands.has(normalized)) return menu;

  const trigger = findTrigger(normalized);
  if (trigger) return replies[trigger];

  if (
    normalized.includes("quero agendar") ||
    normalized.includes("quero marcar") ||
    normalized.includes("fazer agendamento") ||
    normalized === "agendar" ||
    normalized === "agendamento"
  ) {
    return replies.agendamento;
  }

  if (
    normalized.includes("avaliacao fisica") ||
    normalized.includes("valor da avaliacao") ||
    normalized.includes("quanto custa a avaliacao") ||
    normalized.includes("bioimpedancia") ||
    normalized.includes("antropometria")
  ) {
    return replies.avaliacao;
  }

  if (
    normalized.includes("mentoria") ||
    normalized.includes("valor da mentoria") ||
    normalized.includes("quanto custa a mentoria")
  ) {
    return replies.mentoria;
  }

  if (
    normalized.includes("consultoria online") ||
    normalized.includes("consultoria on-line") ||
    normalized.includes("consulta online") ||
    normalized.includes("atendimento online") ||
    normalized.includes("valor da consultoria") ||
    normalized.includes("quanto custa online")
  ) {
    return replies.online;
  }

  if (
    normalized.includes("consulta presencial") ||
    normalized.includes("atendimento presencial") ||
    normalized.includes("valor da consulta") ||
    normalized.includes("quanto custa a consulta") ||
    normalized.includes("pacote presencial")
  ) {
    return replies.presencial;
  }

  if (
    normalized.includes("valor") ||
    normalized.includes("quanto custa") ||
    normalized.includes("pagamento") ||
    normalized.includes("cartao") ||
    normalized.includes("parcel") ||
    normalized.includes("pix") ||
    normalized.includes("horario") ||
    normalized.includes("disponibilidade") ||
    normalized.includes("o que inclui") ||
    normalized.includes("como funciona")
  ) {
    return serviceClarification;
  }

  return null;
}

function normalizeRecipient(value: string) {
  const digits = value.replace(/\D/g, "");

  // A Meta ainda pode entregar o wa_id brasileiro no formato antigo,
  // sem o nono dígito. O envio pela Cloud API exige o número cadastrado.
  if (
    digits.startsWith("55") &&
    digits.length === 12 &&
    !digits.slice(4).startsWith("9")
  ) {
    return `${digits.slice(0, 4)}9${digits.slice(4)}`;
  }

  return digits;
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
        to: normalizeRecipient(to),
        type: "text",
        text: { preview_url: true, body },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    console.error("whatsapp_send_failed", {
      status: response.status,
      detail,
    });
    throw new Error(`Falha ao enviar mensagem: ${response.status}`);
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
    if (!message.from) continue;

    const reply =
      message.type === "text" && message.text?.body
        ? findNaturalReply(message.text.body) || unknownMessage
        : unsupportedMessage;

    try {
      await sendText(message.from, reply);
    } catch (error) {
      console.error("whatsapp_reply_failed", {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }

  return Response.json({ received: true });
}
