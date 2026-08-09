import type { TrainingExerciseLibraryItemV1, TrainingRoutineContentV1, TrainingWeekday } from "../../../../../modules/nutriflow/contracts/v1/training.ts";

export const TRAINING_DAYS: readonly Readonly<{ key: TrainingWeekday; label: string }>[] = Object.freeze([
  { key: "mon", label: "SEG" }, { key: "tue", label: "TER" }, { key: "wed", label: "QUA" },
  { key: "thu", label: "QUI" }, { key: "fri", label: "SEX" }, { key: "sat", label: "SÃB" }, { key: "sun", label: "DOM" },
]);

export function trainingEditorId(kind: string) { return `${kind}_${crypto.randomUUID()}`; }
export function emptyTrainingContent(): TrainingRoutineContentV1 { return Object.freeze({ schemaVersion: 1, days: Object.freeze([]) }); }

function normalize(content: TrainingRoutineContentV1): TrainingRoutineContentV1 {
  return Object.freeze({
    schemaVersion: 1,
    days: Object.freeze(content.days
      .filter((day) => day.muscleGroups.length > 0)
      .map((day) => Object.freeze({
        weekday: day.weekday,
        muscleGroups: Object.freeze(day.muscleGroups.map((group, groupIndex) => Object.freeze({
          ...group,
          sortOrder: groupIndex,
          exercises: Object.freeze(group.exercises.map((exercise, exerciseIndex) => Object.freeze({ ...exercise, sortOrder: exerciseIndex }))),
        }))),
      }))),
  });
}

function updateDay(content: TrainingRoutineContentV1, weekday: TrainingWeekday, updater: (groups: TrainingRoutineContentV1["days"][number]["muscleGroups"]) => TrainingRoutineContentV1["days"][number]["muscleGroups"]) {
  const found = content.days.find((day) => day.weekday === weekday);
  const days = found
    ? content.days.map((day) => day.weekday === weekday ? { ...day, muscleGroups: updater(day.muscleGroups) } : day)
    : [...content.days, { weekday, muscleGroups: updater([]) }];
  return normalize({ schemaVersion: 1, days });
}

export function groupsForDay(content: TrainingRoutineContentV1, weekday: TrainingWeekday) {
  return content.days.find((day) => day.weekday === weekday)?.muscleGroups ?? [];
}

export function addMuscleGroup(content: TrainingRoutineContentV1, weekday: TrainingWeekday, name = "Novo grupamento") {
  return updateDay(content, weekday, (groups) => [...groups, { publicId: trainingEditorId("training_group"), name, sortOrder: groups.length, exercises: [] }]);
}

export function renameMuscleGroup(content: TrainingRoutineContentV1, weekday: TrainingWeekday, groupId: string, name: string) {
  return updateDay(content, weekday, (groups) => groups.map((group) => group.publicId === groupId ? { ...group, name } : group));
}

export function removeMuscleGroup(content: TrainingRoutineContentV1, weekday: TrainingWeekday, groupId: string) {
  return updateDay(content, weekday, (groups) => groups.filter((group) => group.publicId !== groupId));
}

export function addTrainingExercise(content: TrainingRoutineContentV1, weekday: TrainingWeekday, groupId: string, item: TrainingExerciseLibraryItemV1) {
  return updateDay(content, weekday, (groups) => groups.map((group) => group.publicId !== groupId ? group : {
    ...group,
    exercises: [...group.exercises, {
      publicId: trainingEditorId("training_exercise"),
      exercise: { publicId: item.publicId, name: item.name, primaryMuscleGroup: item.primaryMuscleGroup, instructions: item.instructions, mediaPublicId: item.media?.publicId ?? null, posterObjectKey: item.media?.posterObjectKey ?? null, mediaObjectKey: item.media?.objectKey ?? null, mediaKind: item.media?.mediaKind ?? null },
      prescription: { sets: 3, repetitions: { min: 8, max: 12 }, durationSeconds: null, restSeconds: 60, notes: null },
      sortOrder: group.exercises.length,
    }],
  }));
}

export function updateTrainingExercise(content: TrainingRoutineContentV1, weekday: TrainingWeekday, groupId: string, exerciseId: string, patch: Partial<TrainingRoutineContentV1["days"][number]["muscleGroups"][number]["exercises"][number]["prescription"]>) {
  return updateDay(content, weekday, (groups) => groups.map((group) => group.publicId !== groupId ? group : { ...group, exercises: group.exercises.map((exercise) => exercise.publicId === exerciseId ? { ...exercise, prescription: { ...exercise.prescription, ...patch } } : exercise) }));
}

export function removeTrainingExercise(content: TrainingRoutineContentV1, weekday: TrainingWeekday, groupId: string, exerciseId: string) {
  return updateDay(content, weekday, (groups) => groups.map((group) => group.publicId === groupId ? { ...group, exercises: group.exercises.filter((exercise) => exercise.publicId !== exerciseId) } : group));
}

export function moveTrainingExercise(content: TrainingRoutineContentV1, weekday: TrainingWeekday, groupId: string, exerciseId: string, direction: -1 | 1) {
  return updateDay(content, weekday, (groups) => groups.map((group) => {
    if (group.publicId !== groupId) return group;
    const exercises = [...group.exercises];
    const index = exercises.findIndex((exercise) => exercise.publicId === exerciseId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= exercises.length) return group;
    [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
    return { ...group, exercises };
  }));
}
