import { NUTRIFLOW_API_VERSION } from "./errors.ts";

export const TRAINING_WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type TrainingWeekday = (typeof TRAINING_WEEKDAYS)[number];
export type TrainingExerciseScope = "global" | "organization";
export type TrainingEntitlementStatus = "active" | "inactive";

export type TrainingExerciseLibraryItemV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  publicId: string;
  name: string;
  primaryMuscleGroup: string;
  aliases: readonly string[];
  instructions: string | null;
  scope: TrainingExerciseScope;
  media: Readonly<{ posterObjectKey: string | null; mediaKind: "video" | "gif" | null }> | null;
}>;

export type SearchTrainingExerciseLibraryQueryV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  query: string;
  muscleGroup: string | null;
  limit: number;
  correlationId: string;
}>;

export type TrainingPrescriptionMetricV1 = Readonly<{
  sets: number | null;
  repetitions: Readonly<{ min: number; max: number }> | null;
  durationSeconds: number | null;
  restSeconds: number | null;
  notes: string | null;
}>;

export type TrainingRoutineContentV1 = Readonly<{
  schemaVersion: 1;
  days: readonly Readonly<{
    weekday: TrainingWeekday;
    muscleGroups: readonly Readonly<{
      publicId: string;
      name: string;
      sortOrder: number;
      exercises: readonly Readonly<{
        publicId: string;
        exercise: Readonly<{
          publicId: string;
          name: string;
          primaryMuscleGroup: string;
          instructions: string | null;
          posterObjectKey: string | null;
          mediaKind: "video" | "gif" | null;
        }>;
        prescription: TrainingPrescriptionMetricV1;
        sortOrder: number;
      }>[];
    }>[];
  }>[];
}>;

export type TrainingPatientAccessStateV1 =
  | Readonly<{ state: "commercial"; title: "Treino"; subtitle: "Contrate seu treino personalizado" }>
  | Readonly<{ state: "preparing"; title: "Treino"; subtitle: "Seu treino está sendo preparado" }>
  | Readonly<{ state: "today"; title: "Treino de hoje"; subtitle: string; weekday: TrainingWeekday }>
  | Readonly<{ state: "rest"; title: "Treino"; subtitle: "Hoje é dia de descanso"; weekday: TrainingWeekday }>;
