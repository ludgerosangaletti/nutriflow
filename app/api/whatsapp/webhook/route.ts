import {
  getWhatsappLeadContext,
  recordWhatsappLead,
  type LeadService,
  type LeadStage,
} from "../../../whatsapp-leads";

const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";
const schedulingButtonUrls = {
  presencial: "https://ludgerosangaletti.com.br/agendar/presencial",
  mentoria: "https://ludgerosangaletti.com.br/agendar/mentoria",
  avaliacao: "https://ludgerosangaletti.com.br/agendar/avaliacao",
  geral: "https://ludgerosangaletti.com.br/agendar/geral",
} as const;

const triggers = {
  presencial: "gostaria de saber mais sobre os planos da consulta presencial",
  online: "gostaria de saber mais sobre os planos da consultoria online",
  mentoria: "gostaria de saber mais sobre os planos da mentoria de emagrecimento",
  avaliacao: "gostaria de agendar uma avaliacao fisica",
} as const;

const marketingInvitation =
  "Para receber novidades e condições especiais quando estiverem disponíveis, responda *QUERO RECEBER NOVIDADES*.";

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

Se você já decidiu agendar, responda *QUERO AGENDAR*. O contato da equipe de agendamentos será liberado após uma confirmação rápida.

${marketingInvitation}`,

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

A contratação da consultoria on-line é concluída diretamente pela plataforma, sem necessidade de agendamento pelo WhatsApp.

${marketingInvitation}`,

  mentoria: `Olá! Que bom receber seu interesse na mentoria individual 😊

A mentoria consiste em uma chamada on-line individual, com aproximadamente *50 minutos de duração*, para esclarecer dúvidas e conversar de maneira aprofundada sobre um tema relacionado à nutrição, alimentação, suplementação, desempenho esportivo ou organização da rotina alimentar.

Antes da sessão, você poderá informar o assunto e enviar as principais dúvidas. Assim, a conversa será preparada para aproveitar melhor o tempo disponível.

*Investimento: R$ 200,00 por sessão.*

ℹ️ *Importante:* a mentoria tem caráter pontual e educativo. Ela não inclui anamnese clínica, avaliação física, elaboração ou prescrição de plano alimentar, nem acompanhamento após a sessão. Quando a necessidade envolver avaliação individual completa ou prescrição, a consulta presencial ou a consultoria on-line será a modalidade mais adequada.

Os horários disponíveis e a forma de pagamento são confirmados pelo atendimento no momento do agendamento.

Se você já decidiu agendar, responda *QUERO AGENDAR*. O contato da equipe de agendamentos será liberado após uma confirmação rápida.

${marketingInvitation}`,

  avaliacao: `Olá! Que bom receber seu interesse na avaliação física 😊

A avaliação inclui:

✅ Antropometria completa;
✅ Medidas de circunferências e demais indicadores corporais;
✅ Exame de bioimpedância;
✅ Análise dos resultados.

*Investimento: R$ 150,00.*

ℹ️ A avaliação física é um serviço pontual. Ela não inclui consulta nutricional, planejamento alimentar ou acompanhamento posterior. Caso você também queira uma estratégia nutricional completa, selecione *Consulta presencial* no menu.

Após o agendamento, você receberá as orientações de preparo para que as medidas e a bioimpedância sejam realizadas adequadamente. Os horários disponíveis e a forma de pagamento são confirmados pelo atendimento.

Se você já decidiu agendar, responda *QUERO AGENDAR*. O contato da equipe de agendamentos será liberado após uma confirmação rápida.

${marketingInvitation}`,

  schedulingConfirmation: `Perfeito! Antes de encaminhar você para a equipe de agendamentos, confirme:

*1 — Quero agendar agora*
*2 — Ainda tenho uma dúvida*

O contato para atendimento humano será liberado somente após a confirmação da opção 1.`,

  schedulingDoubt: `Sem problema! 😊

Você pode enviar sua dúvida por texto ou escolher novamente o serviço para consultar as informações disponíveis.

Responda *MENU* para ver novamente todas as opções.`,

  onlineCheckout: `A consultoria on-line não precisa de agendamento pelo WhatsApp. 😊

Você pode consultar os planos, fazer o cadastro e concluir a contratação diretamente em:
https://ludgerosangaletti.com.br`,

  marketingOptIn: `Pronto! Seu número foi autorizado a receber novidades, condições especiais e promoções do *Atendimento Ludgero Sangaletti*. ✅

Você pode cancelar essa autorização a qualquer momento respondendo *PARAR PROMOÇÕES*.`,

  marketingOptOut: `Tudo certo. Seu número não receberá mais novidades ou promoções. ✅

Você continua podendo usar este atendimento normalmente sempre que precisar.`,

  patientArea: `Olá! Esta opção é destinada a quem já está em acompanhamento. 😊

Na *Área do Paciente*, você pode acessar seu planejamento, documentos, metas, check-ins, evolução e solicitações de ajustes:
https://ludgerosangaletti.com.br/area-cliente

Se estiver com dificuldade para entrar, acesse:
https://ludgerosangaletti.com.br/recuperar-senha`,
} as const;

type Trigger = keyof typeof triggers;

const menu = `Olá! 👋 Você está falando com o *Atendimento Ludgero Sangaletti*.

Para direcionarmos sua dúvida, responda com o número de uma opção:

1️⃣ Consulta presencial
2️⃣ Consultoria on-line
3️⃣ Mentoria individual
4️⃣ Avaliação física
5️⃣ Já quero agendar
6️⃣ Receber novidades e condições
7️⃣ Já sou paciente

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
  "5": replies.schedulingConfirmation,
  "6": replies.marketingOptIn,
  "7": replies.patientArea,
} as const;

const interactiveOptionReplies = {
  consulta_presencial: replies.presencial,
  consultoria_online: replies.online,
  mentoria_individual: replies.mentoria,
  avaliacao_fisica: replies.avaliacao,
  quero_agendar: replies.schedulingConfirmation,
  receber_novidades: replies.marketingOptIn,
  ja_sou_paciente: replies.patientArea,
} as const;

type WhatsAppWebhook = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        contacts?: Array<{
          wa_id?: string;
          profile?: { name?: string };
        }>;
        messages?: Array<{
          from?: string;
          type?: string;
          text?: { body?: string };
          interactive?: {
            button_reply?: { id?: string; title?: string };
            list_reply?: { id?: string; title?: string };
          };
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

function isMarketingOptIn(normalized: string) {
  return (
    normalized === "6" ||
    normalized === "receber_novidades" ||
    normalized === "quero receber novidades" ||
    normalized === "aceito receber novidades" ||
    normalized === "sim quero receber novidades"
  );
}

function isMarketingOptOut(normalized: string) {
  return (
    normalized === "parar promocoes" ||
    normalized === "nao quero receber novidades" ||
    normalized === "cancelar novidades"
  );
}

function isSchedulingRequest(normalized: string) {
  return (
    normalized === "5" ||
    normalized === "quero_agendar" ||
    normalized.includes("quero agendar") ||
    normalized.includes("quero marcar") ||
    normalized.includes("fazer agendamento") ||
    normalized === "agendar" ||
    normalized === "agendamento"
  );
}

function isSchedulingConfirmation(
  normalized: string,
  lastInteractionKind?: string | null,
) {
  if (
    normalized === "confirmo agendamento" ||
    normalized === "quero agendar agora" ||
    normalized === "confirmar agendamento"
  ) {
    return true;
  }

  return normalized === "1" && lastInteractionKind === "scheduling_intent";
}

function isSchedulingDoubt(
  normalized: string,
  lastInteractionKind?: string | null,
) {
  return normalized === "2" && lastInteractionKind === "scheduling_intent";
}

function schedulingUrl(serviceInterest: LeadService) {
  return (
    serviceInterest === "presencial"
      ? schedulingButtonUrls.presencial
      : serviceInterest === "mentoria"
        ? schedulingButtonUrls.mentoria
        : serviceInterest === "avaliacao"
          ? schedulingButtonUrls.avaliacao
          : schedulingButtonUrls.geral
  );
}

function schedulingReply() {
  return `Agendamento confirmado! ✅

Para falar com a equipe responsável e escolher o melhor horário, toque no botão abaixo.

Ao abrir a conversa, a solicitação já estará preenchida. Envie a mensagem para continuar o atendimento.`;
}

type QualificationPrompt = "service" | "period" | "appointment_type";

type QualificationStep = {
  reply: string;
  interactionKind: string;
  serviceInterest: LeadService;
  preferredPeriod?: string | null;
  appointmentType?: string | null;
  prompt?: QualificationPrompt;
  complete?: boolean;
};

const serviceQualificationReply = `Perfeito! Para qual serviço você deseja solicitar o agendamento?

Escolha uma das opções abaixo.`;

const periodQualificationReply = `Qual período costuma ser melhor para você?

A equipe verificará os horários disponíveis dentro da sua preferência.`;

const appointmentTypeQualificationReply = `Para finalizar, este será seu primeiro atendimento com o Ludgero ou você já é paciente?`;

const qualificationServiceLabels: Record<string, string> = {
  presencial: "Consulta presencial",
  mentoria: "Mentoria individual",
  avaliacao: "Avaliação física",
};

const qualificationPeriodLabels: Record<string, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

const qualificationAppointmentLabels: Record<string, string> = {
  primeira_consulta: "Primeiro atendimento",
  retorno: "Já é paciente",
};

function findQualificationStep(
  normalized: string,
  previousService: LeadService,
  lastInteractionKind?: string | null,
  previousPeriod?: string | null,
): QualificationStep | null {
  if (menuCommands.has(normalized)) return null;

  if (
    previousService !== "online" &&
    isSchedulingConfirmation(normalized, lastInteractionKind)
  ) {
    if (previousService === "unknown") {
      return {
        reply: serviceQualificationReply,
        interactionKind: "qualification_service",
        serviceInterest: "unknown",
        preferredPeriod: null,
        appointmentType: null,
        prompt: "service",
      };
    }

    return {
      reply: periodQualificationReply,
      interactionKind: "qualification_period",
      serviceInterest: previousService,
      preferredPeriod: null,
      appointmentType: null,
      prompt: "period",
    };
  }

  if (lastInteractionKind === "qualification_service") {
    const services: Record<string, LeadService> = {
      agendar_presencial: "presencial",
      consulta_presencial: "presencial",
      "1": "presencial",
      agendar_mentoria: "mentoria",
      mentoria_individual: "mentoria",
      "2": "mentoria",
      agendar_avaliacao: "avaliacao",
      avaliacao_fisica: "avaliacao",
      "3": "avaliacao",
    };
    const selectedService = services[normalized];

    if (!selectedService) {
      return {
        reply: `Não consegui identificar o serviço desejado.\n\n${serviceQualificationReply}`,
        interactionKind: "qualification_service",
        serviceInterest: previousService,
        prompt: "service",
      };
    }

    return {
      reply: periodQualificationReply,
      interactionKind: "qualification_period",
      serviceInterest: selectedService,
      preferredPeriod: null,
      appointmentType: null,
      prompt: "period",
    };
  }

  if (lastInteractionKind === "qualification_period") {
    const periods: Record<string, string> = {
      periodo_manha: "manha",
      manha: "manha",
      periodo_tarde: "tarde",
      tarde: "tarde",
      periodo_noite: "noite",
      noite: "noite",
    };
    const preferredPeriod = periods[normalized];

    if (!preferredPeriod) {
      return {
        reply: `Não consegui identificar o período.\n\n${periodQualificationReply}`,
        interactionKind: "qualification_period",
        serviceInterest: previousService,
        prompt: "period",
      };
    }

    return {
      reply: appointmentTypeQualificationReply,
      interactionKind: "qualification_appointment",
      serviceInterest: previousService,
      preferredPeriod,
      prompt: "appointment_type",
    };
  }

  if (lastInteractionKind === "qualification_appointment") {
    const appointmentTypes: Record<string, string> = {
      primeiro_atendimento: "primeira_consulta",
      "primeira consulta": "primeira_consulta",
      "primeiro atendimento": "primeira_consulta",
      "1": "primeira_consulta",
      paciente_retorno: "retorno",
      retorno: "retorno",
      "ja sou paciente": "retorno",
      "2": "retorno",
    };
    const appointmentType = appointmentTypes[normalized];

    if (!appointmentType) {
      return {
        reply: `Não consegui identificar a opção.\n\n${appointmentTypeQualificationReply}`,
        interactionKind: "qualification_appointment",
        serviceInterest: previousService,
        preferredPeriod: previousPeriod || undefined,
        prompt: "appointment_type",
      };
    }

    const serviceLabel =
      qualificationServiceLabels[previousService] || "Atendimento";
    const periodLabel =
      qualificationPeriodLabels[previousPeriod || ""] || "A combinar";
    const appointmentLabel =
      qualificationAppointmentLabels[appointmentType] || appointmentType;

    return {
      reply: `Perfeito! Confirmei suas preferências: ✅

• *Serviço:* ${serviceLabel}
• *Período preferido:* ${periodLabel}
• *Atendimento:* ${appointmentLabel}

Agora toque no botão de agendamento para falar com a equipe e escolher o melhor horário disponível.`,
      interactionKind: "scheduling_confirmed",
      serviceInterest: previousService,
      preferredPeriod: previousPeriod || undefined,
      appointmentType,
      complete: true,
    };
  }

  return null;
}

function findServiceInterest(normalized: string): LeadService {
  const optionServices: Record<string, LeadService> = {
    "1": "presencial",
    "2": "online",
    "3": "mentoria",
    "4": "avaliacao",
    consulta_presencial: "presencial",
    consultoria_online: "online",
    mentoria_individual: "mentoria",
    avaliacao_fisica: "avaliacao",
  };
  if (optionServices[normalized]) return optionServices[normalized];

  const trigger = findTrigger(normalized);
  if (trigger) return trigger;

  if (
    normalized.includes("avaliacao fisica") ||
    normalized.includes("valor da avaliacao") ||
    normalized.includes("quanto custa a avaliacao") ||
    normalized.includes("bioimpedancia") ||
    normalized.includes("antropometria")
  ) {
    return "avaliacao";
  }

  if (
    normalized.includes("mentoria") ||
    normalized.includes("valor da mentoria") ||
    normalized.includes("quanto custa a mentoria")
  ) {
    return "mentoria";
  }

  if (
    normalized.includes("consultoria online") ||
    normalized.includes("consultoria on-line") ||
    normalized.includes("consulta online") ||
    normalized.includes("atendimento online") ||
    normalized.includes("valor da consultoria") ||
    normalized.includes("quanto custa online")
  ) {
    return "online";
  }

  if (
    normalized.includes("consulta presencial") ||
    normalized.includes("atendimento presencial") ||
    normalized.includes("valor da consulta") ||
    normalized.includes("quanto custa a consulta") ||
    normalized.includes("pacote presencial")
  ) {
    return "presencial";
  }

  return "unknown";
}

function includesAny(normalized: string, terms: string[]) {
  return terms.some((term) => normalized.includes(term));
}

function findFaqReply(
  normalized: string,
  serviceInterest: LeadService,
): string | null {
  if (
    includesAny(normalized, [
      "onde fica",
      "qual endereco",
      "localizacao",
      "local da consulta",
      "onde atende",
    ])
  ) {
    if (serviceInterest === "online" || serviceInterest === "mentoria") {
      return serviceInterest === "online"
        ? `A consultoria on-line é realizada totalmente a distância, pela plataforma:
https://ludgerosangaletti.com.br`
        : "A mentoria é realizada por chamada on-line. As instruções de acesso são enviadas após a confirmação do agendamento.";
    }

    if (serviceInterest === "presencial" || serviceInterest === "avaliacao") {
      return `O atendimento presencial é realizado em *Guarapuava–PR*.

O endereço completo e as orientações de chegada são enviados pela equipe no momento da confirmação do horário.`;
    }
  }

  if (
    includesAny(normalized, [
      "quanto tempo dura",
      "qual a duracao",
      "tempo de consulta",
      "duracao da consulta",
      "duracao da sessao",
    ])
  ) {
    if (serviceInterest === "mentoria") {
      return "A mentoria tem aproximadamente *50 minutos de duração* e é realizada por chamada on-line.";
    }
    if (serviceInterest === "online") {
      return `A consultoria on-line é um acompanhamento realizado durante o período do plano contratado, e não uma chamada isolada.

Você terá acesso ao planejamento, check-ins, metas, ajustes e acompanhamento pela Área do Paciente.`;
    }
    if (serviceInterest === "presencial" || serviceInterest === "avaliacao") {
      return `O tempo reservado varia conforme o serviço e as necessidades da avaliação. A equipe informa a duração prevista junto com as opções de horário.

Se já decidiu realizar o atendimento, responda *QUERO AGENDAR*.`;
    }
  }

  if (
    includesAny(normalized, [
      "preciso levar exame",
      "levar exames",
      "precisa de exames",
      "enviar exames",
      "exames recentes",
    ])
  ) {
    if (serviceInterest === "mentoria") {
      return "A mentoria é uma sessão educativa e não exige exames. Caso sua dúvida dependa de avaliação clínica individual ou prescrição, a consulta será a modalidade mais adequada.";
    }
    if (serviceInterest === "online") {
      return "Se você tiver exames recentes relacionados ao seu objetivo ou histórico de saúde, poderá enviá-los pela Área do Paciente após o cadastro. Eles ajudam na avaliação, mas você pode iniciar o processo mesmo sem exames, salvo orientação específica.";
    }
    return `Exames recentes não são obrigatórios para solicitar o agendamento, mas podem contribuir para uma avaliação mais completa.

Caso você possua exames relacionados ao seu objetivo ou histórico de saúde, leve-os no dia da consulta.`;
  }

  if (
    includesAny(normalized, [
      "bioimpedancia",
      "antropometria",
      "avaliacao corporal",
      "avaliacao fisica inclusa",
    ])
  ) {
    if (serviceInterest === "presencial") {
      return "Sim. A consulta presencial inclui avaliação física completa, antropometria e exame de bioimpedância, além do planejamento alimentar individualizado.";
    }
    if (serviceInterest === "avaliacao") {
      return `A avaliação física inclui antropometria completa, circunferências, bioimpedância e análise dos resultados.

O investimento é de *R$ 150,00*. Esse serviço não inclui consulta nutricional ou planejamento alimentar.`;
    }
    if (serviceInterest === "online") {
      return "A consultoria on-line não inclui antropometria ou bioimpedância presencial. Se desejar somente essas medições, escolha *Avaliação física* no menu.";
    }
    if (serviceInterest === "mentoria") {
      return "A mentoria não inclui antropometria, bioimpedância ou avaliação clínica. Ela é uma chamada educativa para esclarecimento de dúvidas.";
    }
  }

  if (
    includesAny(normalized, [
      "forma de pagamento",
      "formas de pagamento",
      "como posso pagar",
      "aceita cartao",
      "pagar no cartao",
      "parcel",
      "pagar no pix",
      "pagamento",
    ])
  ) {
    if (serviceInterest === "presencial") {
      return `Na consulta presencial:

• *Plano mensal:* pagamento à vista, em dinheiro ou Pix.
• *Pacotes trimestral e semestral:* à vista em dinheiro ou Pix, ou parcelados no cartão com os juros da maquininha.

O parcelamento não está disponível para a modalidade mensal.`;
    }
    if (serviceInterest === "online") {
      return "A consultoria on-line pode ser paga por Pix à vista ou cartão de crédito em até 12 vezes. Os juros do parcelamento são apresentados pela TON antes da confirmação.";
    }
    if (serviceInterest === "mentoria" || serviceInterest === "avaliacao") {
      return `A forma de pagamento é confirmada pela equipe no momento do agendamento.

O investimento é de *${serviceInterest === "mentoria" ? "R$ 200,00 por sessão" : "R$ 150,00"}*.`;
    }
  }

  if (
    includesAny(normalized, [
      "tem horario",
      "horarios disponiveis",
      "qual horario",
      "disponibilidade",
      "posso remarcar",
      "remarcar",
      "reagendar",
      "cancelar agendamento",
    ])
  ) {
    if (serviceInterest === "online") {
      return `A consultoria on-line não precisa de agendamento pelo WhatsApp. Os planos, cadastro e contratação estão disponíveis em:
https://ludgerosangaletti.com.br`;
    }
    return `Os horários disponíveis, remarcações e eventuais cancelamentos são tratados pela equipe de agendamentos.

Se você já decidiu prosseguir, responda *QUERO AGENDAR* para liberar o contato responsável.`;
  }

  if (
    includesAny(normalized, [
      "aceita convenio",
      "atende convenio",
      "pelo convenio",
      "unimed",
    ])
  ) {
    return `Os planos e valores apresentados neste atendimento são referentes ao serviço *particular*.

Atendimentos vinculados a convênio seguem regras e canais próprios da operadora ou da unidade responsável e não são agendados por este fluxo.`;
  }

  if (
    includesAny(normalized, [
      "tem suporte",
      "como funciona o suporte",
      "acompanhamento depois",
      "acompanhamento posterior",
      "pos consulta",
    ])
  ) {
    if (serviceInterest === "presencial") {
      return "Sim. Os planos presenciais incluem acompanhamento e suporte durante todo o período contratado, além do cronograma de metas e objetivos.";
    }
    if (serviceInterest === "online") {
      return "Sim. O acompanhamento on-line inclui check-ins, metas, evolução, ajustes e acesso aos materiais pela Área do Paciente durante o período contratado.";
    }
    if (serviceInterest === "mentoria") {
      return "A mentoria é pontual e não inclui acompanhamento ou suporte após a sessão. Para acompanhamento individual contínuo, escolha a consulta presencial ou a consultoria on-line.";
    }
    if (serviceInterest === "avaliacao") {
      return "A avaliação física é um serviço pontual e não inclui acompanhamento posterior ou planejamento alimentar.";
    }
  }

  if (
    includesAny(normalized, [
      "qual plano recomenda",
      "qual plano escolher",
      "melhor plano",
      "plano mais indicado",
      "qual pacote",
    ])
  ) {
    if (serviceInterest === "presencial") {
      return `A escolha depende do tempo de acompanhamento que você procura:

• *Mensal:* opção inicial, com pagamento à vista.
• *Trimestral:* melhor equilíbrio entre período de acompanhamento e investimento.
• *Semestral:* maior continuidade e melhor valor mensal.

Os planos trimestral e semestral costumam favorecer resultados mais consistentes, pois permitem acompanhar a evolução e realizar ajustes por mais tempo.`;
    }
    if (serviceInterest === "online") {
      return `Os planos e valores atualizados da consultoria on-line estão disponíveis no site. A melhor escolha depende do período em que você deseja receber acompanhamento:
https://ludgerosangaletti.com.br`;
    }
  }

  return null;
}

function findNaturalReply(
  message: string,
  previousService: LeadService = "unknown",
  lastInteractionKind?: string | null,
): string | null {
  const normalized = normalize(message);

  if (isSchedulingConfirmation(normalized, lastInteractionKind)) {
    return schedulingReply();
  }
  if (isSchedulingDoubt(normalized, lastInteractionKind)) {
    return replies.schedulingDoubt;
  }
  if (
    previousService === "online" &&
    isSchedulingRequest(normalized)
  ) {
    return replies.onlineCheckout;
  }

  const interactiveOption =
    interactiveOptionReplies[
      normalized as keyof typeof interactiveOptionReplies
    ];
  if (interactiveOption) return interactiveOption;

  const numericOption = normalized.match(/^[1-7]$/)?.[0] as
    | keyof typeof optionReplies
    | undefined;

  if (numericOption) return optionReplies[numericOption];
  if (menuCommands.has(normalized)) return menu;
  if (isMarketingOptIn(normalized)) return replies.marketingOptIn;
  if (isMarketingOptOut(normalized)) return replies.marketingOptOut;

  const trigger = findTrigger(normalized);
  if (trigger) return replies[trigger];
  if (isSchedulingRequest(normalized)) return replies.schedulingConfirmation;

  const serviceInterest = findServiceInterest(normalized);
  const hasExplicitService =
    Boolean(findTrigger(normalized)) ||
    includesAny(normalized, [
      "consulta presencial",
      "consultoria online",
      "consultoria on-line",
      "consulta online",
      "mentoria",
      "avaliacao fisica",
    ]);
  const contextService =
    previousService !== "unknown" && !hasExplicitService
      ? previousService
      : serviceInterest;
  const faqReply = findFaqReply(normalized, contextService);
  if (faqReply) return faqReply;

  if (serviceInterest !== "unknown") return replies[serviceInterest];

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

function classifyLeadInteraction(
  messageBody?: string,
  messageType = "unknown",
  previousService: LeadService = "unknown",
  lastInteractionKind?: string | null,
) {
  if (!messageBody) {
    return {
      serviceInterest: "unknown" as LeadService,
      source: "direct" as const,
      stage: "new" as LeadStage,
      interactionKind: messageType,
      marketingConsent: null,
    };
  }

  const normalized = normalize(messageBody);
  const trigger = findTrigger(normalized);
  const detectedService = findServiceInterest(normalized);
  const serviceInterest =
    detectedService === "unknown" ? previousService : detectedService;
  const schedulingConfirmed = isSchedulingConfirmation(
    normalized,
    lastInteractionKind,
  );
  const schedulingDoubt = isSchedulingDoubt(normalized, lastInteractionKind);
  const schedulingIntent =
    previousService !== "online" &&
    !schedulingConfirmed &&
    !schedulingDoubt &&
    isSchedulingRequest(normalized);
  const stage: LeadStage = schedulingConfirmed
    ? "qualified"
    : serviceInterest === "unknown"
      ? "new"
      : "informed";

  return {
    serviceInterest,
    source: trigger ? ("linktree" as const) : ("direct" as const),
    stage,
    interactionKind: schedulingConfirmed
      ? "scheduling_confirmed"
      : schedulingDoubt
        ? "scheduling_doubt"
        : schedulingIntent
          ? "scheduling_intent"
          : previousService === "online" && isSchedulingRequest(normalized)
            ? "online_checkout"
      : isMarketingOptIn(normalized)
        ? "marketing_opt_in"
        : isMarketingOptOut(normalized)
          ? "marketing_opt_out"
          : serviceInterest !== "unknown"
            ? "service_interest"
            : menuCommands.has(normalized)
              ? "menu"
              : "unrecognized_text",
    marketingConsent: isMarketingOptIn(normalized)
      ? true
      : isMarketingOptOut(normalized)
        ? false
        : null,
  };
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

function firstName(profileName?: string) {
  const name = profileName?.trim().split(/\s+/)[0];
  return name && name.length <= 40 ? name : null;
}

async function sendInteractiveMenu(
  to: string,
  profileName?: string,
  notUnderstood = false,
) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    throw new Error("Configuração do WhatsApp incompleta.");
  }

  const name = firstName(profileName);
  const greeting = name ? `Olá, ${name}! 👋` : "Olá! 👋";
  const introduction = notUnderstood
    ? "Não consegui identificar exatamente o que você procura. Escolha uma opção abaixo para eu direcionar seu atendimento."
    : "Sou o assistente virtual da equipe Ludgero Sangaletti. Como posso ajudar?";

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
        type: "interactive",
        interactive: {
          type: "list",
          header: { type: "text", text: "Atendimento Ludgero Sangaletti" },
          body: { text: `${greeting}\n\n${introduction}` },
          footer: { text: "Você pode voltar ao menu a qualquer momento." },
          action: {
            button: "Ver opções",
            sections: [
              {
                title: "Serviços",
                rows: [
                  {
                    id: "consulta_presencial",
                    title: "Consulta presencial",
                    description: "Planos e acompanhamento presencial",
                  },
                  {
                    id: "consultoria_online",
                    title: "Consultoria on-line",
                    description: "Planos e contratação pelo site",
                  },
                  {
                    id: "mentoria_individual",
                    title: "Mentoria individual",
                    description: "Sessão on-line para esclarecer dúvidas",
                  },
                  {
                    id: "avaliacao_fisica",
                    title: "Avaliação física",
                    description: "Antropometria e bioimpedância",
                  },
                ],
              },
              {
                title: "Atendimento",
                rows: [
                  {
                    id: "quero_agendar",
                    title: "Quero agendar",
                    description: "Prosseguir com um agendamento",
                  },
                  {
                    id: "ja_sou_paciente",
                    title: "Já sou paciente",
                    description: "Acessar sua área e recursos",
                  },
                  {
                    id: "receber_novidades",
                    title: "Receber novidades",
                    description: "Autorizar promoções e condições especiais",
                  },
                ],
              },
            ],
          },
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    console.error("whatsapp_menu_send_failed", {
      status: response.status,
      detail,
    });
    throw new Error(`Falha ao enviar menu: ${response.status}`);
  }
}

async function sendQualificationButtons(
  to: string,
  prompt: QualificationPrompt,
  body: string,
) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    throw new Error("Configuração do WhatsApp incompleta.");
  }

  const buttons =
    prompt === "service"
      ? [
          {
            type: "reply",
            reply: { id: "agendar_presencial", title: "Consulta presencial" },
          },
          {
            type: "reply",
            reply: { id: "agendar_mentoria", title: "Mentoria" },
          },
          {
            type: "reply",
            reply: { id: "agendar_avaliacao", title: "Avaliação física" },
          },
        ]
      : prompt === "period"
        ? [
            {
              type: "reply",
              reply: { id: "periodo_manha", title: "Manhã" },
            },
            {
              type: "reply",
              reply: { id: "periodo_tarde", title: "Tarde" },
            },
            {
              type: "reply",
              reply: { id: "periodo_noite", title: "Noite" },
            },
          ]
        : [
            {
              type: "reply",
              reply: {
                id: "primeiro_atendimento",
                title: "Primeiro atendimento",
              },
            },
            {
              type: "reply",
              reply: { id: "paciente_retorno", title: "Já sou paciente" },
            },
          ];

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
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: body },
          action: { buttons },
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    console.error("whatsapp_qualification_send_failed", {
      status: response.status,
      detail,
    });
    throw new Error(`Falha ao enviar qualificação: ${response.status}`);
  }
}

async function sendSchedulingTemplate(to: string) {
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
        type: "template",
        template: {
          name: "agendamento_confirmado",
          language: { code: "pt_BR" },
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    console.error("whatsapp_template_send_failed", {
      status: response.status,
      detail,
    });
    throw new Error(
      `Falha ao enviar modelo de agendamento: ${response.status}`,
    );
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
        entry.changes?.flatMap((change) => {
          const contacts = change.value?.contacts || [];
          return (change.value?.messages || []).map((message) => ({
            ...message,
            profileName: contacts.find(
              (contact) => contact.wa_id === message.from,
            )?.profile?.name,
          }));
        }) || [],
    ) || [];

  for (const message of messages) {
    if (!message.from) continue;

    const messageBody =
      message.text?.body ||
      message.interactive?.list_reply?.id ||
      message.interactive?.button_reply?.id;

    let previousLead: Awaited<ReturnType<typeof getWhatsappLeadContext>> = null;
    try {
      previousLead = await getWhatsappLeadContext(message.from);
    } catch (error) {
      console.error("whatsapp_lead_context_failed", {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }

    const previousService =
      (previousLead?.serviceInterest as LeadService | undefined) || "unknown";
    const normalizedMessage = normalize(messageBody || "");
    const qualification = messageBody
      ? findQualificationStep(
          normalizedMessage,
          previousService,
          previousLead?.lastInteractionKind,
          previousLead?.preferredPeriod,
        )
      : null;
    const classification = qualification
      ? {
          serviceInterest: qualification.serviceInterest,
          source: "direct" as const,
          stage: (qualification.complete
            ? "qualified"
            : qualification.serviceInterest === "unknown"
              ? "new"
              : "informed") as LeadStage,
          interactionKind: qualification.interactionKind,
          preferredPeriod: qualification.preferredPeriod,
          appointmentType: qualification.appointmentType,
          marketingConsent: null,
        }
      : classifyLeadInteraction(
          messageBody,
          message.type || "unknown",
          previousService,
          previousLead?.lastInteractionKind,
        );
    const reply =
      qualification?.reply ||
      (messageBody
        ? findNaturalReply(
            messageBody,
            previousService,
            previousLead?.lastInteractionKind,
          ) || unknownMessage
        : unsupportedMessage);

    try {
      await recordWhatsappLead({
        waId: message.from,
        profileName: message.profileName,
        ...classification,
      });
    } catch (error) {
      console.error("whatsapp_lead_record_failed", {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }

    try {
      const shouldShowMenu =
        menuCommands.has(normalizedMessage) || reply === unknownMessage;

      if (qualification?.complete) {
        await sendText(message.from, reply);
        try {
          await sendSchedulingTemplate(message.from);
        } catch {
          await sendText(
            message.from,
            schedulingUrl(classification.serviceInterest),
          );
        }
      } else if (qualification?.prompt) {
        try {
          await sendQualificationButtons(
            message.from,
            qualification.prompt,
            reply,
          );
        } catch {
          await sendText(message.from, reply);
        }
      } else if (shouldShowMenu) {
        try {
          await sendInteractiveMenu(
            message.from,
            message.profileName,
            reply === unknownMessage,
          );
        } catch {
          await sendText(message.from, reply);
        }
      } else {
        await sendText(message.from, reply);
      }
    } catch (error) {
      console.error("whatsapp_reply_failed", {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }

  return Response.json({ received: true });
}
