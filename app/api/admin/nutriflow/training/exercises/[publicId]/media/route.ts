import { env } from "cloudflare:workers";
import { NUTRIFLOW_API_VERSION, NUTRIFLOW_ERROR_CODES } from "../../../../../../../../modules/nutriflow/contracts/v1/errors.ts";
import { createNutriFlowApiErrorV1, NutriFlowContractError } from "../../../../../../../../modules/nutriflow/contracts/v1/validation.ts";
import { NutriFlowApplicationError } from "../../../../../../../../modules/nutriflow/application/errors/nutriflow-application-error.ts";
import { NUTRIFLOW_ACTIONS, assertNutriFlowAuthorized } from "../../../../../../../../modules/nutriflow/application/security/authorization.ts";
import { assertTrainingMediaUpload } from "../../../../../../../../modules/nutriflow/domain/training/training-media.ts";
import { NUTRIFLOW_FEATURE_FLAGS } from "../../../../../../../../modules/nutriflow/config/feature-flags.ts";
import { canUseNutriFlowFeature, createTrainingMediaRepository, resolveNutriFlowAdminContext } from "../../../../../../../nutriflow/server.ts";
import { getAdminSession } from "../../../../../../../supabase/server.ts";

const maximumVideoBytes = 8 * 1024 * 1024;
const maximumGifBytes = 3 * 1024 * 1024;
const maximumPosterBytes = 500 * 1024;

function correlation(request: Request) { return request.headers.get("x-correlation-id")?.trim() || `corr_${crypto.randomUUID()}`; }
function clientId(value: unknown) { const parsed = Number(value); if (!Number.isSafeInteger(parsed) || parsed < 1) throw new NutriFlowContractError("clientId"); return parsed; }
function mediaKind(value: unknown): "video" | "gif" { if (value === "video" || value === "gif") return value; throw new NutriFlowContractError("mediaKind"); }
function file(value: FormDataEntryValue | null, path: string) { if (!(value instanceof File) || value.size < 1) throw new NutriFlowContractError(path); return value; }
function extension(value: string, fallback: string) { const matched = /\.([a-z0-9]+)$/i.exec(value); return matched ? `.${matched[1]!.toLowerCase()}` : fallback; }

async function authorized(currentClientId: number) {
  const admin = await getAdminSession();
  const context = admin ? await resolveNutriFlowAdminContext(admin.user.id) : null;
  if (!context || !(await canUseNutriFlowFeature(context, currentClientId, NUTRIFLOW_FEATURE_FLAGS.TRAINING))) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FEATURE_DISABLED, "Treino indisponível.", 404);
  if (context.actor.role !== "owner" && context.actor.role !== "admin") throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "Acesso não autorizado.", 403);
  assertNutriFlowAuthorized(context.actor, NUTRIFLOW_ACTIONS.MANAGE_TRAINING_MEDIA, { organizationPublicId: context.organizationPublicId, clientId: currentClientId });
  return { admin, context };
}

function failure(error: unknown, correlationId: string) {
  const status = error instanceof NutriFlowApplicationError ? error.httpStatus : error instanceof NutriFlowContractError || error instanceof Error && error.message.startsWith("NUTRIFLOW_TRAINING_MEDIA_INVALID") ? 400 : 500;
  const code = error instanceof NutriFlowApplicationError ? error.code : error instanceof NutriFlowContractError || error instanceof Error && error.message.startsWith("NUTRIFLOW_TRAINING_MEDIA_INVALID") ? NUTRIFLOW_ERROR_CODES.INVALID_INPUT : NUTRIFLOW_ERROR_CODES.INTERNAL_ERROR;
  return Response.json(createNutriFlowApiErrorV1(code, correlationId), { status, headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request, route: { params: Promise<{ publicId: string }> }) {
  const correlationId = correlation(request);
  let keys: string[] = [];
  try {
    const body = await request.formData();
    const currentClientId = clientId(body.get("clientId"));
    const kind = mediaKind(body.get("mediaKind"));
    const media = file(body.get("media"), "media");
    const poster = file(body.get("poster"), "poster");
    const durationSeconds = kind === "video" ? Number(body.get("durationSeconds")) : null;
    assertTrainingMediaUpload({ kind, mediaName: media.name, mediaType: media.type, mediaBytes: media.size, posterName: poster.name, posterType: poster.type, posterBytes: poster.size, durationMs: durationSeconds === null ? null : Math.round(durationSeconds * 1000) });
    const { admin, context } = await authorized(currentClientId);
    const repository = createTrainingMediaRepository();
    const exercise = await repository.getManageableExercise({ organizationId: context.organizationId, exercisePublicId: (await route.params).publicId, allowGlobal: context.actor.role === "owner" });
    const token = crypto.randomUUID();
    const prefix = exercise.scope === "global" ? `training-media/global/${exercise.publicId}` : `training-media/organization/${context.organizationId}/${exercise.publicId}`;
    const objectKey = `${prefix}/${token}/demonstration${extension(media.name, kind === "video" ? ".mp4" : ".gif")}`;
    const posterObjectKey = `${prefix}/${token}/poster${extension(poster.name, ".jpg")}`;
    keys = [objectKey, posterObjectKey];
    await Promise.all([
      env.BUCKET.put(objectKey, await media.arrayBuffer(), { httpMetadata: { contentType: media.type, cacheControl: "private, max-age=86400" }, customMetadata: { kind, exercisePublicId: exercise.publicId } }),
      env.BUCKET.put(posterObjectKey, await poster.arrayBuffer(), { httpMetadata: { contentType: poster.type, cacheControl: "private, max-age=86400" }, customMetadata: { kind: "poster", exercisePublicId: exercise.publicId } }),
    ]);
    const asset = await repository.replace({ organizationId: context.organizationId, actorAuthUserId: admin.user.id, actorRole: context.actor.role, exercise, mediaKind: kind, objectKey, posterObjectKey, mimeType: media.type, posterMimeType: poster.type, byteSize: media.size, posterByteSize: poster.size, durationMs: durationSeconds === null ? null : Math.round(durationSeconds * 1000), correlationId });
    return Response.json({ apiVersion: NUTRIFLOW_API_VERSION, correlationId, data: asset, limits: { videoBytes: maximumVideoBytes, gifBytes: maximumGifBytes, posterBytes: maximumPosterBytes } }, { status: 201, headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (keys.length) await env.BUCKET.delete(keys).catch(() => undefined);
    return failure(error, correlationId);
  }
}

export async function DELETE(request: Request, route: { params: Promise<{ publicId: string }> }) {
  const correlationId = correlation(request);
  try {
    const body = await request.json().catch(() => ({})) as { clientId?: unknown };
    const currentClientId = clientId(body.clientId);
    const { admin, context } = await authorized(currentClientId);
    const repository = createTrainingMediaRepository();
    const exercise = await repository.getManageableExercise({ organizationId: context.organizationId, exercisePublicId: (await route.params).publicId, allowGlobal: context.actor.role === "owner" });
    await repository.remove({ organizationId: context.organizationId, actorAuthUserId: admin.user.id, actorRole: context.actor.role, exercise, correlationId });
    return Response.json({ apiVersion: NUTRIFLOW_API_VERSION, correlationId, data: { removed: true } }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return failure(error, correlationId); }
}
