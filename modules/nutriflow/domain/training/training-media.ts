import type { TrainingRoutineContentV1 } from "../../contracts/v1/training.ts";

export const TRAINING_MEDIA_LIMITS = Object.freeze({
  videoBytes: 8 * 1024 * 1024,
  gifBytes: 3 * 1024 * 1024,
  posterBytes: 500 * 1024,
  videoDurationSeconds: 90,
});

export const GLOBAL_TRAINING_MEDIA_IMPORT_LIMITS = Object.freeze({
  items: 24,
  manifestBytes: 64 * 1024,
  totalBytes: 64 * 1024 * 1024,
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

export type GlobalTrainingMediaImportItem = Readonly<{
  slug: string;
  exercisePublicId: string;
  videoFile: string;
  posterFile: string;
  durationMs: number;
}>;

export type GlobalTrainingMediaImportManifest = Readonly<{
  apiVersion: 1;
  items: readonly GlobalTrainingMediaImportItem[];
}>;

export type GlobalTrainingMediaImportDisposition = "created" | "already_present" | "updated_version" | "skipped";

/** Resolves idempotent content imports without silently replacing an active version. */
export function classifyGlobalTrainingMediaImport(input: Readonly<{
  activeMediaPublicId: string | null;
  activeContentSha256: string | null;
  activePosterSha256: string | null;
  contentSha256: string;
  posterSha256: string;
  allowNewVersion: boolean;
}>): GlobalTrainingMediaImportDisposition {
  if (!input.activeMediaPublicId) return "created";
  if (input.activeContentSha256 === input.contentSha256 && input.activePosterSha256 === input.posterSha256) return "already_present";
  return input.allowNewVersion ? "updated_version" : "skipped";
}

const HISTORICAL_GLOBAL_TRAINING_SLUGS = Object.freeze<Record<string, string>>({
  tr_ex_global_supino_reto: "supino-reto-barra",
  tr_ex_global_crucifixo: "crucifixo-reto-halteres",
  tr_ex_global_puxada_frente: "puxada-frontal-pronada",
  tr_ex_global_remada_baixa: "remada-baixa-cabo",
  tr_ex_global_desenvolvimento: "desenvolvimento-halteres",
  tr_ex_global_rosca_direta: "rosca-direta-barra",
  tr_ex_global_triceps_pulley: "triceps-pulley-corda",
  tr_ex_global_agachamento: "agachamento-livre",
  tr_ex_global_leg_press: "leg-press-45",
  tr_ex_global_mesa_flexora: "mesa-flexora",
  tr_ex_global_elevacao_panturrilha: "panturrilha-em-pe",
  tr_ex_global_prancha: "prancha",
});

export function globalTrainingCatalogSlug(publicId: string) {
  return HISTORICAL_GLOBAL_TRAINING_SLUGS[publicId] ?? publicId.replace(/^tr_ex_global_/, "");
}

function invalid(message: string): never { throw new Error(`NUTRIFLOW_TRAINING_MEDIA_INVALID:${message}`); }

function manifestObject(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) invalid(path);
  return value as Record<string, unknown>;
}

function manifestText(value: unknown, path: string, pattern: RegExp) {
  if (typeof value !== "string" || !pattern.test(value)) invalid(path);
  return value;
}

/**
 * Parses the curated global-library manifest. Catalog slug and immutable
 * public identifier are independent because historical records preserve their
 * original public_id even when their canonical catalog slug changes.
 */
export function parseGlobalTrainingMediaImportManifest(value: unknown): GlobalTrainingMediaImportManifest {
  const input = manifestObject(value, "manifest");
  if (input.apiVersion !== 1 || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > GLOBAL_TRAINING_MEDIA_IMPORT_LIMITS.items) invalid("manifest-shape");
  const slugs = new Set<string>();
  const publicIds = new Set<string>();
  const filenames = new Set<string>();
  const items = input.items.map((entry, index): GlobalTrainingMediaImportItem => {
    const item = manifestObject(entry, `items.${index}`);
    const slug = manifestText(item.slug, `items.${index}.slug`, /^[a-z0-9]+(?:(?:-|_)[a-z0-9]+){0,7}$/);
    const exercisePublicId = item.exercisePublicId === undefined
      ? `tr_ex_global_${slug}`
      : manifestText(item.exercisePublicId, `items.${index}.exercisePublicId`, /^tr_ex_global_[a-z0-9]+(?:(?:-|_)[a-z0-9]+){0,8}$/);
    const videoFile = manifestText(item.videoFile, `items.${index}.videoFile`, /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}\.mp4$/i);
    const posterFile = manifestText(item.posterFile, `items.${index}.posterFile`, /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}\.(?:jpe?g|png|webp)$/i);
    if (slugs.has(slug)) invalid(`items.${index}.slug-duplicate`);
    if (publicIds.has(exercisePublicId)) invalid(`items.${index}.exercisePublicId-duplicate`);
    if (filenames.has(videoFile) || filenames.has(posterFile) || videoFile === posterFile) invalid(`items.${index}.file-duplicate`);
    if (typeof item.durationSeconds !== "number" || !Number.isFinite(item.durationSeconds) || item.durationSeconds < 1 || item.durationSeconds > TRAINING_MEDIA_LIMITS.videoDurationSeconds) invalid(`items.${index}.durationSeconds`);
    slugs.add(slug);
    publicIds.add(exercisePublicId);
    filenames.add(videoFile);
    filenames.add(posterFile);
    return Object.freeze({
      slug,
      exercisePublicId,
      videoFile,
      posterFile,
      durationMs: Math.round(item.durationSeconds * 1000),
    });
  });
  return Object.freeze({ apiVersion: 1, items: Object.freeze(items) });
}

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

function bytesMatch(bytes: Uint8Array, offset: number, expected: readonly number[]) {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function containsAscii(bytes: Uint8Array, text: string) {
  const expected = Array.from(text, (character) => character.charCodeAt(0));
  for (let offset = 0; offset <= bytes.length - expected.length; offset += 1) {
    if (bytesMatch(bytes, offset, expected)) return true;
  }
  return false;
}

/** Verifies the actual container, H.264 codec marker and poster signature for curated batch imports. */
export function assertCuratedTrainingMediaBytes(video: Uint8Array, poster: Uint8Array, posterType: string) {
  if (video.length < 12 || !bytesMatch(video, 4, [0x66, 0x74, 0x79, 0x70])) invalid("video-container");
  if (!containsAscii(video, "avc1") && !containsAscii(video, "avc3")) invalid("video-codec-h264");
  const validPoster = posterType === "image/jpeg"
    ? bytesMatch(poster, 0, [0xff, 0xd8, 0xff])
    : posterType === "image/png"
      ? bytesMatch(poster, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      : posterType === "image/webp"
        ? bytesMatch(poster, 0, [0x52, 0x49, 0x46, 0x46]) && bytesMatch(poster, 8, [0x57, 0x45, 0x42, 0x50])
        : false;
  if (!validPoster) invalid("poster-signature");
}

/** Verifies a requested asset is part of exactly the rendered immutable publication. */
export function publicationReferencesTrainingMedia(content: TrainingRoutineContentV1, mediaPublicId: string) {
  return content.days.some((day) => day.muscleGroups.some((group) => group.exercises.some((exercise) => exercise.exercise.mediaPublicId === mediaPublicId)));
}
