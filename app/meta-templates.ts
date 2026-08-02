export const ACTIVATION_TEMPLATE_NAME = "ativacao_conta_presencial_v1";

export type MetaTemplateSummary = {
  id: string | null;
  name: string;
  status: string;
  category: string;
  language: string;
};

export function activationTemplateDefinition() {
  return {
    name: ACTIVATION_TEMPLATE_NAME,
    language: "pt_BR",
    category: "UTILITY",
    allow_category_change: true,
    components: [
      {
        type: "BODY",
        text:
          "Olá, {{1}}! Seu acesso à Área do Paciente de Ludgero Sangaletti está disponível.\n\nPara confirmar seu e-mail, completar seu cadastro e criar sua senha, toque no botão abaixo.\n\nSe precisar de ajuda, responda esta mensagem.",
        example: { body_text: [["Ludgero"]] },
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "Ativar minha conta",
            url: "https://ludgerosangaletti.com.br/{{1}}",
            example: [
              "https://ludgerosangaletti.com.br/ativar-conta?token_hash=exemplo&type=invite",
            ],
          },
        ],
      },
    ],
  } as const;
}

export function templateSummaries(value: unknown): MetaTemplateSummary[] {
  if (!value || typeof value !== "object") return [];
  const data = (value as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.name !== "string") return [];
    return [{
      id: typeof row.id === "string" ? row.id : null,
      name: row.name,
      status: typeof row.status === "string" ? row.status : "UNKNOWN",
      category: typeof row.category === "string" ? row.category : "UNKNOWN",
      language: typeof row.language === "string" ? row.language : "UNKNOWN",
    }];
  });
}
