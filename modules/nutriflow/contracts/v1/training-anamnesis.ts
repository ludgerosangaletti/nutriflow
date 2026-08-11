import { NUTRIFLOW_API_VERSION } from "./errors.ts";
import type { TrainingWeekday } from "./training.ts";

export const TRAINING_ANAMNESIS_OBJECTIVES = [
  ["muscle_gain", "Ganho de massa muscular"],
  ["fat_loss", "Redução de gordura / melhora da composição corporal"],
  ["strength", "Ganho de força"],
  ["conditioning", "Melhora do condicionamento físico"],
  ["health", "Saúde e qualidade de vida"],
  ["sports_performance", "Melhorar desempenho esportivo"],
  ["return_to_training", "Retornar aos treinos"],
  ["other", "Outro"],
] as const;

export const TRAINING_ANAMNESIS_PRIORITIES = [
  ["chest", "Peitoral"], ["back", "Costas"], ["shoulders", "Ombros"],
  ["arms", "Braços"], ["glutes", "Glúteos"], ["thighs", "Coxas"],
  ["calves", "Panturrilhas"], ["core", "Abdômen/Core"],
  ["none", "Não tenho prioridade específica"], ["other", "Outra"],
] as const;

export const TRAINING_ANAMNESIS_EXPERIENCE = [
  ["never", "Nunca pratiquei"], ["under_6_months", "Menos de 6 meses"],
  ["6_to_12_months", "6 meses a 1 ano"], ["1_to_3_years", "1 a 3 anos"],
  ["over_3_years", "Mais de 3 anos"],
] as const;

export const TRAINING_ANAMNESIS_CURRENT_ROUTINE = [
  ["regular", "Treino regularmente"], ["irregular", "Treino de forma irregular"],
  ["stopped_under_3_months", "Estou parado há menos de 3 meses"],
  ["stopped_over_3_months", "Estou parado há mais de 3 meses"],
  ["never", "Nunca pratiquei musculação"],
] as const;

export const TRAINING_ANAMNESIS_DURATIONS = [
  ["up_to_30", "Até 30 min"], ["30_to_45", "30–45 min"],
  ["45_to_60", "45–60 min"], ["60_to_75", "60–75 min"],
  ["over_75", "Mais de 75 min"],
] as const;

export const TRAINING_ANAMNESIS_LOCATIONS = [
  ["full_gym", "Academia completa"], ["condo_gym", "Academia de condomínio"],
  ["limited_gym", "Academia pequena / estrutura limitada"], ["home", "Em casa"],
  ["other", "Outro"],
] as const;

export const TRAINING_ANAMNESIS_EQUIPMENT = [
  ["dumbbells", "Halteres"], ["barbell_plates", "Barra e anilhas"], ["bench", "Banco"],
  ["bands", "Elásticos/minibands"], ["kettlebell", "Kettlebell"], ["pull_up_bar", "Barra fixa"],
  ["machines", "Máquinas"], ["cardio", "Esteira/bicicleta/ergômetro"], ["none", "Nenhum"],
  ["other", "Outros"],
] as const;

export const TRAINING_ANAMNESIS_ACTIVITIES = [
  ["none", "Não"], ["running", "Corrida"], ["cycling", "Ciclismo"],
  ["football", "Futebol/Futsal"], ["crossfit", "CrossFit"], ["martial_arts", "Lutas"],
  ["swimming", "Natação"], ["other_sport", "Outro esporte"], ["other_activity", "Outra atividade"],
] as const;

type ValueOf<T extends readonly (readonly [string, string])[]> = T[number][0];

export type TrainingAnamnesisAnswersV1 = Readonly<{
  schemaVersion: 1;
  objective: ValueOf<typeof TRAINING_ANAMNESIS_OBJECTIVES> | null;
  objectiveOther: string | null;
  priorities: readonly ValueOf<typeof TRAINING_ANAMNESIS_PRIORITIES>[];
  priorityOther: string | null;
  experience: ValueOf<typeof TRAINING_ANAMNESIS_EXPERIENCE> | null;
  currentRoutine: ValueOf<typeof TRAINING_ANAMNESIS_CURRENT_ROUTINE> | null;
  unsafeExercises: boolean | null;
  unsafeExercisesDetails: string | null;
  trainingDaysPerWeek: number | null;
  availableDays: readonly TrainingWeekday[];
  sessionDuration: ValueOf<typeof TRAINING_ANAMNESIS_DURATIONS> | null;
  trainingLocation: ValueOf<typeof TRAINING_ANAMNESIS_LOCATIONS> | null;
  trainingLocationOther: string | null;
  equipment: readonly ValueOf<typeof TRAINING_ANAMNESIS_EQUIPMENT>[];
  equipmentOther: string | null;
  pain: boolean | null;
  painDetails: string | null;
  injuryHistory: boolean | null;
  injuryHistoryDetails: string | null;
  professionalRestrictions: boolean | null;
  professionalRestrictionsDetails: string | null;
  healthCondition: boolean | null;
  healthConditionDetails: string | null;
  likedExercises: string | null;
  dislikedExercises: string | null;
  otherActivity: ValueOf<typeof TRAINING_ANAMNESIS_ACTIVITIES> | null;
  otherActivityDetails: string | null;
  otherActivityFrequency: number | null;
  additionalNotes: string | null;
}>;

export type TrainingAnamnesisStatusV1 = Readonly<{
  status: "not_started" | "draft" | "submitted";
  updatedAt: string | null;
  submittedAt: string | null;
}>;

export type TrainingAnamnesisV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  publicId: string | null;
  status: TrainingAnamnesisStatusV1["status"];
  answers: TrainingAnamnesisAnswersV1;
  revision: number;
  updatedAt: string | null;
  submittedAt: string | null;
}>;

export function emptyTrainingAnamnesisAnswers(): TrainingAnamnesisAnswersV1 {
  return Object.freeze({
    schemaVersion: 1, objective: null, objectiveOther: null, priorities: Object.freeze([]), priorityOther: null,
    experience: null, currentRoutine: null, unsafeExercises: null, unsafeExercisesDetails: null,
    trainingDaysPerWeek: null, availableDays: Object.freeze([]), sessionDuration: null,
    trainingLocation: null, trainingLocationOther: null, equipment: Object.freeze([]), equipmentOther: null,
    pain: null, painDetails: null, injuryHistory: null, injuryHistoryDetails: null,
    professionalRestrictions: null, professionalRestrictionsDetails: null, healthCondition: null, healthConditionDetails: null,
    likedExercises: null, dislikedExercises: null, otherActivity: null, otherActivityDetails: null,
    otherActivityFrequency: null, additionalNotes: null,
  });
}
