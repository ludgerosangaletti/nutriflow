import {
  TRAINING_ANAMNESIS_DURATIONS,
  TRAINING_ANAMNESIS_LOCATIONS,
  TRAINING_ANAMNESIS_OBJECTIVES,
  TRAINING_ANAMNESIS_PRIORITIES,
  type TrainingAnamnesisAnswersV1,
} from "../../../modules/nutriflow/contracts/v1/training-anamnesis.ts";

export type TrainingAnamnesisSummaryItem = Readonly<{
  label: string;
  value: string;
  detail?: string;
  attention?: boolean;
}>;

const labels = <T extends readonly (readonly [string, string])[]>(values: T) =>
  Object.fromEntries(values) as Record<T[number][0], string>;

const objectiveLabels = labels(TRAINING_ANAMNESIS_OBJECTIVES);
const priorityLabels = labels(TRAINING_ANAMNESIS_PRIORITIES);
const durationLabels = labels(TRAINING_ANAMNESIS_DURATIONS);
const locationLabels = labels(TRAINING_ANAMNESIS_LOCATIONS);

function list(values: readonly string[]) {
  if (values.length <= 1) return values[0] ?? "";
  return `${values.slice(0, -1).join(", ")} e ${values.at(-1)}`;
}

function compact(value: string | null, max = 180) {
  const normalized = value?.trim().replace(/\s+/g, " ") ?? "";
  return normalized.length > max ? `${normalized.slice(0, max - 1).trimEnd()}…` : normalized;
}

export function buildTrainingAnamnesisSummary(answers: TrainingAnamnesisAnswersV1) {
  const summary: TrainingAnamnesisSummaryItem[] = [];
  if (answers.objective) {
    const priorities = answers.priorities
      .filter((value) => value !== "none")
      .map((value) => value === "other" ? compact(answers.priorityOther) : priorityLabels[value])
      .filter(Boolean);
    summary.push({
      label: "Objetivo",
      value: answers.objective === "other" ? compact(answers.objectiveOther) : objectiveLabels[answers.objective],
      detail: priorities.length ? `Prioridade: ${list(priorities)}` : undefined,
    });
  }
  if (answers.trainingDaysPerWeek) {
    summary.push({
      label: "Frequência",
      value: `${answers.trainingDaysPerWeek} ${answers.trainingDaysPerWeek === 1 ? "dia" : "dias"} por semana`,
    });
  }
  if (answers.sessionDuration) {
    summary.push({
      label: "Tempo e estrutura",
      value: `${durationLabels[answers.sessionDuration]} por treino`,
      detail: answers.trainingLocation
        ? answers.trainingLocation === "other" ? compact(answers.trainingLocationOther) : locationLabels[answers.trainingLocation]
        : undefined,
    });
  }
  const attention = [
    answers.pain ? compact(answers.painDetails) : "",
    answers.injuryHistory ? compact(answers.injuryHistoryDetails) : "",
    answers.professionalRestrictions ? compact(answers.professionalRestrictionsDetails) : "",
    answers.healthCondition ? compact(answers.healthConditionDetails) : "",
  ].filter(Boolean);
  if (attention.length) {
    summary.push({ label: "Pontos de atenção registrados", value: list(attention), attention: true });
  }
  return summary;
}
