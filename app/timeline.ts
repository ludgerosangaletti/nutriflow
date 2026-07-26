export type TimelineEvent = {
  date: string;
  kind: "purchase" | "access" | "anamnesis" | "document" | "checkin" | "photo" | "goal" | "adjustment" | "milestone";
  title: string;
  description: string;
  href?: string;
  future?: boolean;
};

type TimelineInput = {
  client: {
    purchaseStartedAt: string | null;
    accessStartedAt: string | null;
    accessExpiresAt: string | null;
    paymentStatus: string;
  };
  anamnesis?: {
    createdAt: string;
    submittedAt: string | null;
    status: string;
  } | null;
  documents: Array<{ title: string; publishedAt: string }>;
  checkIns: Array<{ weekStart: string; createdAt: string }>;
  photos: Array<{ period: string; createdAt: string }>;
  goals: Array<{ title: string; createdAt: string; achievedAt: string | null; status: string }>;
  adjustments: Array<{
    createdAt: string;
    answeredAt: string | null;
    closedAt: string | null;
    status: string;
    reason: string;
  }>;
};

export function buildTimeline(input: TimelineInput) {
  const events: TimelineEvent[] = [];
  const { client } = input;

  if (client.purchaseStartedAt) {
    events.push({
      date: client.purchaseStartedAt,
      kind: "purchase",
      title: "Consultoria contratada",
      description: "A jornada de acompanhamento foi iniciada.",
    });
  }

  if (client.accessStartedAt) {
    events.push({
      date: client.accessStartedAt,
      kind: "access",
      title: "Pagamento confirmado",
      description: "A assessoria e a Área do Paciente foram liberadas.",
    });
  }

  if (input.anamnesis?.submittedAt) {
    events.push({
      date: input.anamnesis.submittedAt,
      kind: "anamnesis",
      title: "Anamnese enviada",
      description: "As informações para elaboração da estratégia alimentar foram recebidas.",
      href: "/anamnese",
    });
  } else if (input.anamnesis) {
    events.push({
      date: input.anamnesis.createdAt,
      kind: "anamnesis",
      title: "Anamnese iniciada",
      description: "O questionário foi salvo como rascunho.",
      href: "/anamnese",
    });
  }

  input.documents.forEach((document) => {
    events.push({
      date: document.publishedAt,
      kind: "document",
      title: "Novo material disponível",
      description: document.title,
      href: "/documentos",
    });
  });

  input.checkIns.forEach((checkIn) => {
    events.push({
      date: checkIn.createdAt,
      kind: "checkin",
      title: "Check-in semanal enviado",
      description: `Semana de ${formatDate(`${checkIn.weekStart}T12:00:00Z`)}`,
      href: "/check-in",
    });
  });

  const photoPeriods = Map.groupBy(input.photos, (photo) => photo.period);
  photoPeriods.forEach((photos, period) => {
    events.push({
      date: photos.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt))[0].createdAt,
      kind: "photo",
      title: "Registro de evolução adicionado",
      description: `Fotos de ${formatMonth(period)}.`,
      href: "/evolucao",
    });
  });

  input.goals.forEach((goal) => {
    events.push({
      date: goal.createdAt,
      kind: "goal",
      title: "Nova meta definida",
      description: goal.title,
      href: "/metas",
    });
    if (goal.achievedAt) {
      events.push({
        date: goal.achievedAt,
        kind: "goal",
        title: "Meta alcançada",
        description: goal.title,
        href: "/metas",
      });
    }
  });

  input.adjustments.forEach((request) => {
    events.push({
      date: request.createdAt,
      kind: "adjustment",
      title: "Ajuste solicitado",
      description: request.reason,
      href: "/ajustes",
    });
    if (request.answeredAt) {
      events.push({
        date: request.answeredAt,
        kind: "adjustment",
        title: "Solicitação respondida",
        description: "A orientação do nutricionista já está disponível.",
        href: "/ajustes",
      });
    }
  });

  if (client.accessExpiresAt) {
    const expiresAt = new Date(client.accessExpiresAt);
    const future = expiresAt.getTime() > Date.now();
    events.push({
      date: client.accessExpiresAt,
      kind: "milestone",
      title: future ? "Término previsto do plano" : "Vigência do plano encerrada",
      description: future
        ? "A assessoria e o acesso permanecem ativos até esta data."
        : "Este ciclo de acompanhamento foi concluído.",
      future,
    });
  }

  return events.toSorted((a, b) => b.date.localeCompare(a.date));
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function formatMonth(period: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${period}-01T12:00:00Z`));
}
