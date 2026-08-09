import { env } from "cloudflare:workers";
import { NUTRIFLOW_API_VERSION, NUTRIFLOW_ERROR_CODES } from "../../../../../../../modules/nutriflow/contracts/v1/errors.ts";
import { createNutriFlowApiErrorV1, NutriFlowContractError } from "../../../../../../../modules/nutriflow/contracts/v1/validation.ts";
import { NutriFlowApplicationError } from "../../../../../../../modules/nutriflow/application/errors/nutriflow-application-error.ts";
import { NUTRIFLOW_ACTIONS, assertNutriFlowAuthorized } from "../../../../../../../modules/nutriflow/application/security/authorization.ts";
import {
  GLOBAL_TRAINING_MEDIA_IMPORT_LIMITS,
  assertCuratedTrainingMediaBytes,
  assertTrainingMediaUpload,
  parseGlobalTrainingMediaImportManifest,
} from "../../../../../../../modules/nutriflow/domain/training/training-media.ts";
import type { GlobalTrainingMediaImportRecord } from "../../../../../../../modules/nutriflow/infrastructure/d1/d1-training-media-repository.ts";
import { createTrainingMediaRepository, resolveNutriFlowAdminContext } from "../../../../../../nutriflow/server.ts";
import { getAdminSession } from "../../../../../../supabase/server.ts";

function correlation(request: Request) {
  return request.headers.get("x-correlation-id")?.trim() || `corr_${crypto.randomUUID()}`;
}

function invalid(path: string): never {
  throw new NutriFlowContractError(path);
}

function posterExtension(filename: string) {
  const matched = /\.(jpe?g|png|webp)$/i.exec(filename);
  return matched ? `.${matched[1]!.toLowerCase()}` : invalid("posterFile");
}

async function authorized() {
  const admin = await getAdminSession();
  if (!admin) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.UNAUTHENTICATED, "Autenticação necessária.", 401);
  const context = await resolveNutriFlowAdminContext(admin.user.id);
  if (!context || context.actor.role !== "owner") throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "Acesso não autorizado.", 403);
  assertNutriFlowAuthorized(context.actor, NUTRIFLOW_ACTIONS.MANAGE_TRAINING_MEDIA, { organizationPublicId: context.organizationPublicId, clientId: 0 });
  return { admin, context };
}

function failure(error: unknown, correlationId: string) {
  const invalidMedia = error instanceof Error && error.message.startsWith("NUTRIFLOW_TRAINING_MEDIA_INVALID");
  const status = error instanceof NutriFlowApplicationError ? error.httpStatus : error instanceof NutriFlowContractError || invalidMedia ? 400 : 500;
  const code = error instanceof NutriFlowApplicationError ? error.code : error instanceof NutriFlowContractError || invalidMedia ? NUTRIFLOW_ERROR_CODES.INVALID_INPUT : NUTRIFLOW_ERROR_CODES.INTERNAL_ERROR;
  return Response.json(createNutriFlowApiErrorV1(code, correlationId), { status, headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request) {
  const correlationId = correlation(request);
  const uploadedKeys: string[] = [];
  let metadataCommitted = false;
  try {
    const { admin, context } = await authorized();
    const form = await request.formData();
    const manifestFile = form.get("manifest");
    if (!(manifestFile instanceof File) || !manifestFile.name.toLowerCase().endsWith(".json") || manifestFile.size < 1 || manifestFile.size > GLOBAL_TRAINING_MEDIA_IMPORT_LIMITS.manifestBytes) invalid("manifest");
    let manifestValue: unknown;
    try {
      manifestValue = JSON.parse(await manifestFile.text()) as unknown;
    } catch {
      invalid("manifest.json");
    }
    const manifest = parseGlobalTrainingMediaImportManifest(manifestValue);
    const overwriteExisting = form.get("overwriteExisting") === "true";
    const uploadedFiles = form.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
    const files = new Map<string, File>();
    for (const uploaded of uploadedFiles) {
      if (files.has(uploaded.name)) invalid("files.duplicate");
      files.set(uploaded.name, uploaded);
    }
    const expectedFiles = new Set(manifest.items.flatMap((item) => [item.videoFile, item.posterFile]));
    if (files.size !== expectedFiles.size || [...files.keys()].some((name) => !expectedFiles.has(name))) invalid("files.correspondence");
    const totalBytes = [...files.values()].reduce((total, current) => total + current.size, 0);
    if (totalBytes > GLOBAL_TRAINING_MEDIA_IMPORT_LIMITS.totalBytes) invalid("files.totalBytes");

    const repository = createTrainingMediaRepository();
    const targets = await repository.getGlobalImportTargets(manifest.items.map((item) => item.exercisePublicId));
    if (targets.length !== manifest.items.length) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.NOT_FOUND, "Exercício global não encontrado.", 404);
    const targetByPublicId = new Map(targets.map((target) => [target.publicId, target]));
    if (!overwriteExisting && targets.some((target) => target.activeMediaPublicId !== null)) {
      throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.VERSION_CONFLICT, "Uma ou mais mídias já estão associadas.", 409);
    }

    const batchId = crypto.randomUUID();
    const records: GlobalTrainingMediaImportRecord[] = [];
    for (const item of manifest.items) {
      const target = targetByPublicId.get(item.exercisePublicId);
      const video = files.get(item.videoFile);
      const poster = files.get(item.posterFile);
      if (!target || !video || !poster) invalid(`files.${item.slug}`);
      assertTrainingMediaUpload({
        kind: "video",
        mediaName: video.name,
        mediaType: video.type,
        mediaBytes: video.size,
        posterName: poster.name,
        posterType: poster.type,
        posterBytes: poster.size,
        durationMs: item.durationMs,
      });
      assertCuratedTrainingMediaBytes(
        new Uint8Array(await video.arrayBuffer()),
        new Uint8Array(await poster.arrayBuffer()),
        poster.type,
      );
      const prefix = `training-media/global/${item.slug}/${batchId}`;
      const objectKey = `${prefix}/demonstration.mp4`;
      const posterObjectKey = `${prefix}/poster${posterExtension(poster.name)}`;
      uploadedKeys.push(objectKey, posterObjectKey);
      records.push(Object.freeze({
        target,
        objectKey,
        posterObjectKey,
        mimeType: "video/mp4",
        posterMimeType: poster.type,
        byteSize: video.size,
        posterByteSize: poster.size,
        durationMs: item.durationMs,
      }));
    }

    const uploadResults = await Promise.allSettled(records.flatMap((record, index) => {
      const item = manifest.items[index]!;
      const video = files.get(item.videoFile)!;
      const poster = files.get(item.posterFile)!;
      const metadata = { exercisePublicId: item.exercisePublicId, exerciseSlug: item.slug, curated: "true", batchId };
      return [
        env.BUCKET.put(record.objectKey, video.stream(), { httpMetadata: { contentType: record.mimeType, cacheControl: "private, max-age=31536000, immutable" }, customMetadata: { ...metadata, kind: "video" } }),
        env.BUCKET.put(record.posterObjectKey, poster.stream(), { httpMetadata: { contentType: record.posterMimeType, cacheControl: "private, max-age=31536000, immutable" }, customMetadata: { ...metadata, kind: "poster" } }),
      ];
    }));
    const failedUpload = uploadResults.find((result) => result.status === "rejected");
    if (failedUpload?.status === "rejected") throw failedUpload.reason;

    const assets = await repository.importGlobalBatch({
      organizationId: context.organizationId,
      actorAuthUserId: admin.user.id,
      actorRole: context.actor.role,
      records,
      overwriteExisting,
      correlationId,
    });
    metadataCommitted = true;
    return Response.json({
      apiVersion: NUTRIFLOW_API_VERSION,
      correlationId,
      data: {
        batchId,
        imported: assets.length,
        replaced: records.filter((record) => record.target.activeMediaPublicId !== null).length,
        assets: assets.map((asset, index) => ({ exerciseSlug: manifest.items[index]!.slug, mediaPublicId: asset.publicId })),
      },
    }, { status: 201, headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (!metadataCommitted && uploadedKeys.length) await env.BUCKET.delete(uploadedKeys).catch(() => undefined);
    return failure(error, correlationId);
  }
}
