import { env } from "cloudflare:workers";
import {
  TRAINING_MEDIA_LIMITS,
  assertCuratedTrainingMediaBytes,
  assertTrainingMediaUpload,
  classifyGlobalTrainingMediaImport,
  parseGlobalTrainingMediaImportManifest,
} from "../../../../../../../modules/nutriflow/domain/training/training-media.ts";
import { createTrainingMediaRepository } from "../../../../../../nutriflow/server.ts";

const maxChunkSize = 700 * 1024;
const uploadIdPattern = /^[a-f0-9-]{36}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const kinds = new Set(["video", "poster"]);

type CompleteBody = Readonly<{
  uploadId?: string;
  videoParts?: number;
  posterParts?: number;
  videoSize?: number;
  posterSize?: number;
  contentSha256?: string;
  posterSha256?: string;
  allowNewVersion?: boolean;
  item?: Record<string, unknown>;
}>;

type OrganizationRow = Readonly<{ id: number; public_id: string }>;
type VerificationRow = Readonly<{ object_key: string; poster_object_key: string }>;

function stagingKey(uploadId: string, kind: string, partNumber: number) {
  return `training-media/import-staging/${uploadId}/${kind}/${String(partNumber).padStart(4, "0")}`;
}

async function digestHex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sameSecret(provided: string, expected: string) {
  const [providedHash, expectedHash] = await Promise.all([
    digestHex(new TextEncoder().encode(provided)),
    digestHex(new TextEncoder().encode(expected)),
  ]);
  return providedHash === expectedHash;
}

async function authorize(request: Request) {
  const expected = String(env.TRAINING_MEDIA_IMPORT_SECRET || "");
  const provided = request.headers.get("x-training-media-import-secret") || "";
  if (!expected || !provided || !(await sameSecret(provided, expected))) return null;
  return env.DB.prepare("SELECT id, public_id FROM nf_organizations WHERE status = 'active' ORDER BY id ASC LIMIT 1").first<OrganizationRow>();
}

export async function GET(request: Request) {
  if (!(await authorize(request))) return Response.json({ error: "forbidden" }, { status: 403 });
  const [catalog, media, duplicates] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS count FROM nf_training_exercises WHERE scope = 'global' AND status = 'active'").first<{ count: number }>(),
    env.DB.prepare(`SELECT media.object_key, media.poster_object_key FROM nf_training_exercise_media AS media
      INNER JOIN nf_training_exercises AS exercise ON exercise.id = media.exercise_id
      WHERE exercise.scope = 'global' AND exercise.status = 'active' AND media.status = 'active'`).all<VerificationRow>(),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM (
      SELECT media.exercise_id FROM nf_training_exercise_media AS media
      INNER JOIN nf_training_exercises AS exercise ON exercise.id = media.exercise_id
      WHERE exercise.scope = 'global' AND exercise.status = 'active' AND media.status = 'active'
      GROUP BY media.exercise_id HAVING COUNT(*) > 1
    )`).first<{ count: number }>(),
  ]);
  const objects = await Promise.all(media.results.flatMap((row) => [env.BUCKET.head(row.object_key), env.BUCKET.head(row.poster_object_key)]));
  let videosPresent = 0;
  let postersPresent = 0;
  for (let index = 0; index < media.results.length; index += 1) {
    if (objects[index * 2]) videosPresent += 1;
    if (objects[index * 2 + 1]) postersPresent += 1;
  }
  return Response.json({
    globalExercises: Number(catalog?.count || 0), activeMedia: media.results.length,
    videosPresent, postersPresent,
    duplicateActiveAssociations: Number(duplicates?.count || 0),
    missingObjects: media.results.length * 2 - videosPresent - postersPresent,
  });
}

function positiveInteger(value: unknown, maximum: number) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= maximum ? number : null;
}

async function removeChunks(uploadId: string, videoParts: number, posterParts: number) {
  const keys = [
    ...Array.from({ length: videoParts }, (_, index) => stagingKey(uploadId, "video", index + 1)),
    ...Array.from({ length: posterParts }, (_, index) => stagingKey(uploadId, "poster", index + 1)),
  ];
  if (keys.length) await env.BUCKET.delete(keys);
}

async function assemble(uploadId: string, kind: "video" | "poster", parts: number, expectedSize: number) {
  const output = new Uint8Array(expectedSize);
  let offset = 0;
  for (let partNumber = 1; partNumber <= parts; partNumber += 1) {
    const object = await env.BUCKET.get(stagingKey(uploadId, kind, partNumber));
    if (!object) throw new Error(`missing-${kind}-part-${partNumber}`);
    const bytes = new Uint8Array(await object.arrayBuffer());
    if (offset + bytes.length > output.length) throw new Error(`${kind}-size-overflow`);
    output.set(bytes, offset);
    offset += bytes.length;
  }
  if (offset !== expectedSize) throw new Error(`${kind}-size-mismatch`);
  return output;
}

export async function PUT(request: Request) {
  if (!(await authorize(request))) return Response.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(request.url);
  const uploadId = url.searchParams.get("uploadId") || "";
  const kind = url.searchParams.get("kind") || "";
  const partNumber = positiveInteger(url.searchParams.get("partNumber"), 30);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (!uploadIdPattern.test(uploadId) || !kinds.has(kind) || !partNumber || contentLength < 1 || contentLength > maxChunkSize) {
    return Response.json({ error: "invalid-part" }, { status: 400 });
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength < 1 || bytes.byteLength > maxChunkSize) return Response.json({ error: "invalid-part" }, { status: 400 });
  await env.BUCKET.put(stagingKey(uploadId, kind, partNumber), bytes, { httpMetadata: { contentType: "application/octet-stream" } });
  return Response.json({ ok: true, size: bytes.byteLength });
}

export async function DELETE(request: Request) {
  if (!(await authorize(request))) return Response.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(request.url);
  const uploadId = url.searchParams.get("uploadId") || "";
  const videoParts = positiveInteger(url.searchParams.get("videoParts"), 30);
  const posterParts = positiveInteger(url.searchParams.get("posterParts"), 30);
  if (!uploadIdPattern.test(uploadId) || !videoParts || !posterParts) return Response.json({ error: "invalid-cleanup" }, { status: 400 });
  await removeChunks(uploadId, videoParts, posterParts);
  return Response.json({ ok: true });
}

export async function POST(request: Request) {
  const organization = await authorize(request);
  if (!organization) return Response.json({ error: "forbidden" }, { status: 403 });
  const body = await request.json().catch(() => ({})) as CompleteBody;
  const uploadId = String(body.uploadId || "");
  const videoSize = positiveInteger(body.videoSize, TRAINING_MEDIA_LIMITS.videoBytes);
  const posterSize = positiveInteger(body.posterSize, TRAINING_MEDIA_LIMITS.posterBytes);
  const videoParts = positiveInteger(body.videoParts, 30);
  const posterParts = positiveInteger(body.posterParts, 30);
  const contentSha256 = String(body.contentSha256 || "");
  const posterSha256 = String(body.posterSha256 || "");
  if (!uploadIdPattern.test(uploadId) || !videoSize || !posterSize || !videoParts || !posterParts ||
      videoParts !== Math.ceil(videoSize / maxChunkSize) || posterParts !== Math.ceil(posterSize / maxChunkSize) ||
      !sha256Pattern.test(contentSha256) || !sha256Pattern.test(posterSha256)) {
    return Response.json({ status: "failed", error: "invalid-completion" }, { status: 400 });
  }
  const rawItem = body.item && typeof body.item === "object" ? body.item : {};
  const manifestItem = parseGlobalTrainingMediaImportManifest({ apiVersion: 1, items: [rawItem] }).items[0]!;
  const sourceUrl = typeof rawItem.sourceUrl === "string" ? rawItem.sourceUrl.slice(0, 1000) : null;
  const credit = typeof rawItem.credit === "string" ? rawItem.credit.slice(0, 300) : null;
  const license = typeof rawItem.license === "string" ? rawItem.license.slice(0, 120) : null;
  const licenseUrl = typeof rawItem.licenseUrl === "string" ? rawItem.licenseUrl.slice(0, 1000) : null;
  let uploadedNewKeys: string[] = [];
  try {
    const [video, poster] = await Promise.all([
      assemble(uploadId, "video", videoParts, videoSize),
      assemble(uploadId, "poster", posterParts, posterSize),
    ]);
    if (await digestHex(video) !== contentSha256 || await digestHex(poster) !== posterSha256) throw new Error("hash-mismatch");
    assertTrainingMediaUpload({
      kind: "video",
      mediaName: manifestItem.videoFile,
      mediaType: "video/mp4",
      mediaBytes: video.length,
      posterName: manifestItem.posterFile,
      posterType: "image/webp",
      posterBytes: poster.length,
      durationMs: manifestItem.durationMs,
    });
    assertCuratedTrainingMediaBytes(video, poster, "image/webp");
    const repository = createTrainingMediaRepository();
    const targets = await repository.getGlobalImportTargets([manifestItem.exercisePublicId]);
    const target = targets[0];
    if (!target) return Response.json({ exercisePublicId: manifestItem.exercisePublicId, status: "failed", error: "global-exercise-not-found" }, { status: 404 });
    const disposition = classifyGlobalTrainingMediaImport({
      activeMediaPublicId: target.activeMediaPublicId,
      activeContentSha256: target.activeContentSha256,
      activePosterSha256: target.activePosterSha256,
      contentSha256,
      posterSha256,
      allowNewVersion: body.allowNewVersion === true,
    });
    if (disposition === "already_present" || disposition === "skipped") {
      await removeChunks(uploadId, videoParts, posterParts);
      return Response.json({ exercisePublicId: manifestItem.exercisePublicId, status: disposition });
    }
    const version = `${contentSha256.slice(0, 16)}-${posterSha256.slice(0, 16)}`;
    const prefix = `training-media/global/${manifestItem.slug}/${version}`;
    const objectKey = `${prefix}/demonstration.mp4`;
    const posterObjectKey = `${prefix}/poster.webp`;
    const [existingVideo, existingPoster] = await Promise.all([env.BUCKET.head(objectKey), env.BUCKET.head(posterObjectKey)]);
    if (!existingVideo) uploadedNewKeys.push(objectKey);
    if (!existingPoster) uploadedNewKeys.push(posterObjectKey);
    await Promise.all([
      existingVideo ? Promise.resolve() : env.BUCKET.put(objectKey, video, { httpMetadata: { contentType: "video/mp4", cacheControl: "private, max-age=31536000, immutable" }, customMetadata: { exercisePublicId: manifestItem.exercisePublicId, contentSha256, curated: "true" } }),
      existingPoster ? Promise.resolve() : env.BUCKET.put(posterObjectKey, poster, { httpMetadata: { contentType: "image/webp", cacheControl: "private, max-age=31536000, immutable" }, customMetadata: { exercisePublicId: manifestItem.exercisePublicId, posterSha256, curated: "true" } }),
    ]);
    const assets = await repository.importGlobalBatch({
      organizationId: organization.id,
      actorAuthUserId: "system-training-library",
      actorRole: "owner",
      records: [{ target, objectKey, posterObjectKey, mimeType: "video/mp4", posterMimeType: "image/webp", byteSize: video.length, posterByteSize: poster.length, durationMs: manifestItem.durationMs, contentSha256, posterSha256, sourceUrl, credit, license, licenseUrl }],
      overwriteExisting: disposition === "updated_version",
      correlationId: `corr_training_media_${uploadId}`,
    });
    await removeChunks(uploadId, videoParts, posterParts);
    return Response.json({ exercisePublicId: manifestItem.exercisePublicId, mediaPublicId: assets[0]!.publicId, status: disposition, objectKey, posterObjectKey });
  } catch (error) {
    if (uploadedNewKeys.length) await env.BUCKET.delete(uploadedNewKeys).catch(() => undefined);
    await removeChunks(uploadId, videoParts, posterParts).catch(() => undefined);
    return Response.json({ exercisePublicId: typeof rawItem.exercisePublicId === "string" ? rawItem.exercisePublicId : null, status: "failed", error: error instanceof Error ? error.message : "import-failed" }, { status: 500 });
  }
}
