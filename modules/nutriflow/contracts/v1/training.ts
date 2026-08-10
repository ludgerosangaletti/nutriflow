import { NUTRIFLOW_API_VERSION } from "./errors.ts";

export const TRAINING_WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const TRAINING_EXERCISE_LIBRARY_MAX_RESULTS = 25;
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
  media: Readonly<{
    publicId: string;
    posterObjectKey: string | null;
    objectKey: string;
    mediaKind: "video" | "gif";
    durationMs: number | null;
  }> | null;
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

export type TrainingExerciseSnapshotV1 = Readonly<{
  publicId: string;
  name: string;
  primaryMuscleGroup: string;
  instructions: string | null;
  /** Stable media reference captured with this routine version; never resolved from a mutable catalog entry. */
  mediaPublicId: string | null;
  posterObjectKey: string | null;
  mediaObjectKey: string | null;
  mediaKind: "video" | "gif" | null;
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
        exercise: TrainingExerciseSnapshotV1;
        prescription: TrainingPrescriptionMetricV1;
        sortOrder: number;
      }>[];
    }>[];
  }>[];
}>;

export type TrainingRoutineDraftV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  routinePublicId: string;
  publicId: string;
  versionNumber: number;
  revision: number;
  title: string;
  content: TrainingRoutineContentV1;
  updatedAt: string;
}>;

export type TrainingPublicationV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  publicId: string;
  routinePublicId: string;
  routineVersionPublicId: string;
  versionNumber: number;
  publishedAt: string;
  content: TrainingRoutineContentV1;
}>;

export type TrainingEntitlementV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  active: boolean;
  publicId: string | null;
  changedAt: string | null;
  reason: string | null;
}>;

export type TrainingEditorWorkspaceV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  entitlement: TrainingEntitlementV1;
  draft: TrainingRoutineDraftV1 | null;
  publication: TrainingPublicationV1 | null;
}>;

export type ConfigureTrainingEntitlementCommandV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  clientId: number;
  active: boolean;
  reason: string | null;
  correlationId: string;
}>;

export type SaveTrainingRoutineDraftCommandV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  routinePublicId: string;
  routineVersionPublicId: string;
  expectedRevision: number;
  title: string;
  content: TrainingRoutineContentV1;
  correlationId: string;
}>;

export type PublishTrainingRoutineCommandV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  routinePublicId: string;
  routineVersionPublicId: string;
  expectedRevision: number;
  correlationId: string;
}>;

export type PatientTrainingPortalV1 = Readonly<{
  apiVersion: typeof NUTRIFLOW_API_VERSION;
  card: TrainingPatientAccessStateV1;
  currentWeekday: TrainingWeekday;
  publication: Readonly<{ publicId: string; versionNumber: number; publishedAt: string; content: TrainingRoutineContentV1 }> | null;
}>;

export type TrainingPatientAccessStateV1 =
  | Readonly<{ state: "commercial"; title: "Treino"; subtitle: "Contrate seu treino personalizado" }>
  | Readonly<{ state: "preparing"; title: "Treino"; subtitle: "Seu treino está sendo preparado" }>
  | Readonly<{ state: "today"; title: "Treino de hoje"; subtitle: string; weekday: TrainingWeekday }>
  | Readonly<{ state: "rest"; title: "Treino"; subtitle: "Hoje é dia de descanso"; weekday: TrainingWeekday }>;
