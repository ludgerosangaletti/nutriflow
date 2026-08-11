import { NutriFlowContractError } from "./validation.ts";
import { TRAINING_WEEKDAYS } from "./training.ts";
import {
  emptyTrainingAnamnesisAnswers,
  TRAINING_ANAMNESIS_ACTIVITIES,
  TRAINING_ANAMNESIS_CURRENT_ROUTINE,
  TRAINING_ANAMNESIS_DURATIONS,
  TRAINING_ANAMNESIS_EQUIPMENT,
  TRAINING_ANAMNESIS_EXPERIENCE,
  TRAINING_ANAMNESIS_LOCATIONS,
  TRAINING_ANAMNESIS_OBJECTIVES,
  TRAINING_ANAMNESIS_PRIORITIES,
  type TrainingAnamnesisAnswersV1,
} from "./training-anamnesis.ts";

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown, path: string, max = 800) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new NutriFlowContractError(path);
  const clean = value.trim().replace(/\s+/g, " ");
  if (!clean || clean.length > max) throw new NutriFlowContractError(path);
  return clean;
}

function choice<T extends readonly (readonly [string, string])[]>(value: unknown, options: T, path: string) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !options.some(([key]) => key === value)) throw new NutriFlowContractError(path);
  return value as T[number][0];
}

function choices<T extends readonly (readonly [string, string])[]>(value: unknown, options: T, path: string) {
  if (value === null || value === undefined) return Object.freeze([]) as readonly T[number][0][];
  if (!Array.isArray(value) || value.length > options.length || new Set(value).size !== value.length || value.some((item) => typeof item !== "string" || !options.some(([key]) => key === item))) throw new NutriFlowContractError(path);
  return Object.freeze(value as T[number][0][]);
}

function yesNo(value: unknown, path: string) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "boolean") throw new NutriFlowContractError(path);
  return value;
}

function frequency(value: unknown, path: string, max: number) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) throw new NutriFlowContractError(path);
  return parsed;
}

export function parseTrainingAnamnesisAnswersV1(value: unknown, complete = false): TrainingAnamnesisAnswersV1 {
  const source = record(value);
  const defaults = emptyTrainingAnamnesisAnswers();
  const objective = choice(source.objective, TRAINING_ANAMNESIS_OBJECTIVES, "answers.objective");
  const priorities = choices(source.priorities, TRAINING_ANAMNESIS_PRIORITIES, "answers.priorities");
  const experience = choice(source.experience, TRAINING_ANAMNESIS_EXPERIENCE, "answers.experience");
  const currentRoutine = choice(source.currentRoutine, TRAINING_ANAMNESIS_CURRENT_ROUTINE, "answers.currentRoutine");
  const unsafeExercises = yesNo(source.unsafeExercises, "answers.unsafeExercises");
  const days = Array.isArray(source.availableDays) ? source.availableDays : [];
  if (days.length > 7 || new Set(days).size !== days.length || days.some((day) => typeof day !== "string" || !TRAINING_WEEKDAYS.includes(day as never))) throw new NutriFlowContractError("answers.availableDays");
  const sessionDuration = choice(source.sessionDuration, TRAINING_ANAMNESIS_DURATIONS, "answers.sessionDuration");
  const trainingLocation = choice(source.trainingLocation, TRAINING_ANAMNESIS_LOCATIONS, "answers.trainingLocation");
  const equipment = choices(source.equipment, TRAINING_ANAMNESIS_EQUIPMENT, "answers.equipment");
  const pain = yesNo(source.pain, "answers.pain");
  const injuryHistory = yesNo(source.injuryHistory, "answers.injuryHistory");
  const professionalRestrictions = yesNo(source.professionalRestrictions, "answers.professionalRestrictions");
  const healthCondition = yesNo(source.healthCondition, "answers.healthCondition");
  const otherActivity = choice(source.otherActivity, TRAINING_ANAMNESIS_ACTIVITIES, "answers.otherActivity");
  const parsed: TrainingAnamnesisAnswersV1 = Object.freeze({
    ...defaults,
    objective, objectiveOther: objective === "other" ? text(source.objectiveOther, "answers.objectiveOther", 160) : null,
    priorities, priorityOther: priorities.includes("other") ? text(source.priorityOther, "answers.priorityOther", 160) : null,
    experience, currentRoutine, unsafeExercises,
    unsafeExercisesDetails: unsafeExercises ? text(source.unsafeExercisesDetails, "answers.unsafeExercisesDetails") : null,
    trainingDaysPerWeek: frequency(source.trainingDaysPerWeek, "answers.trainingDaysPerWeek", 7),
    availableDays: Object.freeze(days) as TrainingAnamnesisAnswersV1["availableDays"], sessionDuration,
    trainingLocation, trainingLocationOther: trainingLocation === "other" ? text(source.trainingLocationOther, "answers.trainingLocationOther", 160) : null,
    equipment: ["limited_gym", "home"].includes(trainingLocation ?? "") ? equipment : Object.freeze([]),
    equipmentOther: equipment.includes("other") ? text(source.equipmentOther, "answers.equipmentOther", 160) : null,
    pain, painDetails: pain ? text(source.painDetails, "answers.painDetails") : null,
    injuryHistory, injuryHistoryDetails: injuryHistory ? text(source.injuryHistoryDetails, "answers.injuryHistoryDetails") : null,
    professionalRestrictions, professionalRestrictionsDetails: professionalRestrictions ? text(source.professionalRestrictionsDetails, "answers.professionalRestrictionsDetails") : null,
    healthCondition, healthConditionDetails: healthCondition ? text(source.healthConditionDetails, "answers.healthConditionDetails") : null,
    likedExercises: text(source.likedExercises, "answers.likedExercises"), dislikedExercises: text(source.dislikedExercises, "answers.dislikedExercises"),
    otherActivity, otherActivityDetails: otherActivity && ["other_sport", "other_activity"].includes(otherActivity) ? text(source.otherActivityDetails, "answers.otherActivityDetails", 160) : null,
    otherActivityFrequency: otherActivity && otherActivity !== "none" ? frequency(source.otherActivityFrequency, "answers.otherActivityFrequency", 14) : null,
    additionalNotes: text(source.additionalNotes, "answers.additionalNotes", 1200),
  });
  if (complete) {
    const required = [objective, experience, currentRoutine, unsafeExercises, parsed.trainingDaysPerWeek, parsed.availableDays.length ? true : null, sessionDuration, trainingLocation, pain, injuryHistory, professionalRestrictions, healthCondition, otherActivity];
    if (required.some((item) => item === null)) throw new NutriFlowContractError("answers.required");
    if (!priorities.length) throw new NutriFlowContractError("answers.priorities");
    if (objective === "other" && !parsed.objectiveOther) throw new NutriFlowContractError("answers.objectiveOther");
    if (priorities.includes("other") && !parsed.priorityOther) throw new NutriFlowContractError("answers.priorityOther");
    if (unsafeExercises && !parsed.unsafeExercisesDetails) throw new NutriFlowContractError("answers.unsafeExercisesDetails");
    if (["limited_gym", "home"].includes(trainingLocation ?? "") && !parsed.equipment.length) throw new NutriFlowContractError("answers.equipment");
    if (equipment.includes("other") && !parsed.equipmentOther) throw new NutriFlowContractError("answers.equipmentOther");
    if (pain && !parsed.painDetails) throw new NutriFlowContractError("answers.painDetails");
    if (injuryHistory && !parsed.injuryHistoryDetails) throw new NutriFlowContractError("answers.injuryHistoryDetails");
    if (professionalRestrictions && !parsed.professionalRestrictionsDetails) throw new NutriFlowContractError("answers.professionalRestrictionsDetails");
    if (healthCondition && !parsed.healthConditionDetails) throw new NutriFlowContractError("answers.healthConditionDetails");
    if (otherActivity && otherActivity !== "none" && !parsed.otherActivityFrequency) throw new NutriFlowContractError("answers.otherActivityFrequency");
    if (otherActivity && ["other_sport", "other_activity"].includes(otherActivity) && !parsed.otherActivityDetails) throw new NutriFlowContractError("answers.otherActivityDetails");
  }
  return parsed;
}
