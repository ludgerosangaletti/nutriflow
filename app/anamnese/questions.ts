export type AnswerValue = string | boolean;
export type Answers = Record<string, AnswerValue>;

export const sections = [
  {
    id: "perfil",
    title: "Perfil",
    description: "Informações básicas para contextualizar sua avaliação.",
    fields: [
      { id: "birthDate", label: "Data de nascimento", type: "date", required: true },
      { id: "sex", label: "Sexo", type: "select", options: ["Feminino", "Masculino", "Prefiro não informar"], required: true },
      { id: "height", label: "Altura (cm)", type: "number", placeholder: "Ex.: 172", required: true },
      { id: "weight", label: "Peso atual (kg)", type: "number", placeholder: "Ex.: 74,5", required: true },
      { id: "profession", label: "Profissão e rotina de trabalho", type: "textarea", placeholder: "Conte como é seu dia de trabalho, horários e nível de atividade." },
      { id: "routine", label: "Descreva resumidamente sua rotina diária", type: "textarea", required: true },
    ],
  },
  {
    id: "saude",
    title: "Objetivo e saúde",
    description: "Seu histórico orienta prioridades e cuidados da estratégia.",
    fields: [
      { id: "mainGoal", label: "Qual é seu principal objetivo?", type: "textarea", required: true },
      { id: "goalDeadline", label: "Existe uma data, prova ou evento relacionado ao objetivo?", type: "text" },
      { id: "diagnoses", label: "Possui diagnóstico de alguma doença ou condição clínica?", type: "textarea", placeholder: "Se não possuir, escreva “Não”." },
      { id: "medications", label: "Medicamentos em uso e respectivas doses", type: "textarea", placeholder: "Inclua anticoncepcionais e medicamentos de uso eventual." },
      { id: "supplements", label: "Suplementos que utiliza atualmente", type: "textarea" },
      { id: "allergies", label: "Alergias ou intolerâncias conhecidas", type: "textarea" },
      { id: "surgeries", label: "Cirurgias, internações ou lesões relevantes", type: "textarea" },
      { id: "symptoms", label: "Sintomas ou desconfortos atuais", type: "textarea", placeholder: "Digestão, dores, fadiga, queda de cabelo, ciclo menstrual, entre outros." },
      { id: "recentExams", label: "Possui exames laboratoriais recentes?", type: "select", options: ["Sim", "Não"] },
    ],
  },
  {
    id: "alimentacao",
    title: "Alimentação",
    description: "Queremos entender o que você realmente consegue executar.",
    fields: [
      { id: "foodRoutine", label: "Descreva sua alimentação em um dia habitual", type: "textarea", placeholder: "Inclua horários, alimentos, bebidas e quantidades aproximadas.", required: true },
      { id: "mealPlaces", label: "Onde costuma realizar as refeições?", type: "textarea", placeholder: "Casa, trabalho, restaurante, delivery..." },
      { id: "preferences", label: "Alimentos e preparações de que mais gosta", type: "textarea" },
      { id: "aversions", label: "Alimentos que não gosta ou não pretende consumir", type: "textarea" },
      { id: "restrictions", label: "Restrições alimentares por escolha, cultura ou religião", type: "textarea" },
      { id: "water", label: "Consumo aproximado de água por dia", type: "text", placeholder: "Ex.: 2 litros" },
      { id: "alcohol", label: "Consumo de álcool", type: "textarea", placeholder: "Frequência e quantidade aproximada." },
      { id: "bowel", label: "Como está o funcionamento intestinal?", type: "textarea", placeholder: "Frequência, consistência, gases, dor ou desconforto." },
      { id: "weekend", label: "Sua alimentação muda nos fins de semana?", type: "textarea" },
    ],
  },
  {
    id: "atividade",
    title: "Atividade física",
    description: "Treino, recuperação e alimentação precisam conversar.",
    fields: [
      { id: "activities", label: "Quais atividades físicas pratica?", type: "textarea", placeholder: "Modalidade, frequência semanal e duração.", required: true },
      { id: "trainingSchedule", label: "Dias e horários habituais dos treinos", type: "textarea" },
      { id: "trainingExperience", label: "Há quanto tempo pratica e como avalia seu nível?", type: "textarea" },
      { id: "performanceGoal", label: "Existe algum objetivo esportivo específico?", type: "textarea" },
      { id: "injuries", label: "Possui dores, limitações ou lesões?", type: "textarea" },
      { id: "restDays", label: "Como organiza descanso e recuperação?", type: "textarea" },
    ],
  },
  {
    id: "rotina",
    title: "Sono e comportamento",
    description: "Os detalhes da rotina ajudam a criar uma estratégia sustentável.",
    fields: [
      { id: "sleep", label: "Como é seu sono?", type: "textarea", placeholder: "Horários, duração, despertares e qualidade.", required: true },
      { id: "stress", label: "Como avalia seu nível de estresse atualmente?", type: "select", options: ["Baixo", "Moderado", "Alto", "Muito alto"], required: true },
      { id: "appetite", label: "Como percebe sua fome e saciedade ao longo do dia?", type: "textarea" },
      { id: "eatingBehavior", label: "Há episódios de compulsão, ansiedade alimentar ou perda de controle?", type: "textarea" },
      { id: "previousDiets", label: "Já realizou outras dietas ou acompanhamentos? Como foi?", type: "textarea" },
      { id: "challenges", label: "Quais são hoje suas maiores dificuldades?", type: "textarea", required: true },
      { id: "expectations", label: "O que espera da consultoria e do acompanhamento?", type: "textarea", required: true },
      { id: "additionalNotes", label: "Existe algo importante que não foi perguntado?", type: "textarea" },
      { id: "truthConsent", label: "Confirmo que as informações fornecidas são verdadeiras e podem ser utilizadas na elaboração da minha estratégia nutricional.", type: "checkbox", required: true },
    ],
  },
] as const;

export const fieldLabels = Object.fromEntries(
  sections.flatMap((section) =>
    section.fields.map((field) => [field.id, field.label]),
  ),
);
