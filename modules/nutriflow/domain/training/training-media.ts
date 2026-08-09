import type { TrainingRoutineContentV1 } from "../../contracts/v1/training.ts";

export const TRAINING_MEDIA_LIMITS = Object.freeze({
  videoBytes: 8 * 1024 * 1024,
  gifBytes: 3 * 1024 * 1024,
  posterBytes: 500 * 1024,
  videoDurationSeconds: 90,
});

export type TrainingMediaKind = "video" | "gif";
export type TrainingMediaUpload = Readonly<{
  kind: TrainingMediaKind;
  mediaName: string;
  mediaType: string;
  mediaBytes: number;
  posterName: string;
  posterType: string;
  posterBytes: number;
  durationMs: number | null;
}>;

function invalid(message: string): never { throw new Error(`NUTRIFLOW_TRAINING_MEDIA_INVALID:${message}`); }

/** Validates cheap, deterministic upload properties. Codec optimisation remains part of the curated-media workflow. */
export function assertTrainingMediaUpload(input: TrainingMediaUpload) {
  if (input.kind === "video") {
    if (input.mediaType !== "video/mp4" || !input.mediaName.toLowerCase().endsWith(".mp4")) invalid("video-format");
    if (input.mediaBytes < 1 || input.mediaBytes > TRAINING_MEDIA_LIMITS.videoBytes) invalid("video-size");
    if (!input.durationMs || input.durationMs < 1_000 || input.durationMs > TRAINING_MEDIA_LIMITS.videoDurationSeconds * 1_000) invalid("video-duration");
  } else {
    if (input.mediaType !== "image/gif" || !input.mediaName.toLowerCase().endsWith(".gif")) invalid("gif-format");
    if (input.mediaBytes < 1 || input.mediaBytes > TRAINING_MEDIA_LIMITS.gifBytes) invalid("gif-size");
  }
  if (!( ["image/jpeg", "image/png", "image/webp"] as const).includes(input.posterType as never)) invalid("poster-format");
  if (!/\.(jpe?g|png|webp)$/i.test(input.posterName)) invalid("poster-name");
  if (input.posterBytes < 1 || input.posterBytes > TRAINING_MEDIA_LIMITS.posterBytes) invalid("poster-size");
}

/** Verifies a requested asset is part of exactly the rendered immutable publication. */
export function publicationReferencesTrainingMedia(content: TrainingRoutineContentV1, mediaPublicId: string) {
  return content.days.some((day) => day.muscleGroups.some((group) => group.exercises.some((exercise) => exercise.exercise.mediaPublicId === mediaPublicId)));
}
