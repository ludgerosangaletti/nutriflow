import { NUTRIFLOW_API_VERSION, NUTRIFLOW_ERROR_CODES } from "../../../../../modules/nutriflow/contracts/v1/errors.ts";
import {
  createNutriFlowApiErrorV1,
  NutriFlowContractError,
  parseConfigureTrainingEntitlementCommandV1,
  parsePublishTrainingRoutineCommandV1,
  parseSaveTrainingRoutineDraftCommandV1,
} from "../../../../../modules/nutriflow/contracts/v1/validation.ts";
import { NutriFlowApplicationError } from "../../../../../modules/nutriflow/application/errors/nutriflow-application-error.ts";
import { NUTRIFLOW_FEATURE_FLAGS } from "../../../../../modules/nutriflow/config/feature-flags.ts";
import { canUseNutriFlowFeature, createTrainingEditorRepository, resolveNutriFlowAdminContext } from "../../../../nutriflow/server.ts";
import { getAdminSession } from "../../../../supabase/server.ts";

function clientId(value: unknown) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new NutriFlowContractError("clientId");
  return parsed;
}

function correlationId(request: Request) { return request.headers.get("x-correlation-id")?.trim() || `corr_${crypto.randomUUID()}`; }
function record(value: unknown) { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function headers(startedAt: number) { return { "cache-control": "private, no-store", "server-timing": `nutriflow-training;dur=${(performance.now() - startedAt).toFixed(1)}` }; }

async function authorized(client: number) {
  const admin = await getAdminSession();
  if (!admin) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "Acesso não autorizado.", 403);
  const context = await resolveNutriFlowAdminContext(admin.user.id);
  if (!context || !(await canUseNutriFlowFeature(context, client, NUTRIFLOW_FEATURE_FLAGS.TRAINING))) {
    throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FEATURE_DISABLED, "Treino indisponível.", 404);
  }
  return { context, admin };
}

function failure(error: unknown, correlation: string, startedAt: number) {
  if (error instanceof NutriFlowApplicationError) return Response.json(createNutriFlowApiErrorV1(error.code, correlation), { status: error.httpStatus, headers: headers(startedAt) });
  if (error instanceof NutriFlowContractError) return Response.json(createNutriFlowApiErrorV1(NUTRIFLOW_ERROR_CODES.INVALID_INPUT, correlation, { path: error.path }), { status: 400, headers: headers(startedAt) });
  console.error("[nutriflow.training.api]", JSON.stringify({ correlationId: correlation, errorCode: NUTRIFLOW_ERROR_CODES.INTERNAL_ERROR }));
  return Response.json(createNutriFlowApiErrorV1(NUTRIFLOW_ERROR_CODES.INTERNAL_ERROR, correlation), { status: 500, headers: headers(startedAt) });
}

export async function GET(request: Request) {
  const startedAt = performance.now();
  const correlation = correlationId(request);
  try {
    const currentClientId = clientId(new URL(request.url).searchParams.get("clientId"));
    const { context } = await authorized(currentClientId);
    const data = await createTrainingEditorRepository().getWorkspace({ organizationId: context.organizationId, clientId: currentClientId });
    return Response.json({ apiVersion: NUTRIFLOW_API_VERSION, correlationId: correlation, data }, { headers: headers(startedAt) });
  } catch (error) { return failure(error, correlation, startedAt); }
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const correlation = correlationId(request);
  try {
    const body = record(await request.json());
    const action = String(body.action ?? "");
    const currentClientId = clientId(body.clientId);
    const { context, admin } = await authorized(currentClientId);
    const repository = createTrainingEditorRepository();
    let data;
    if (action === "entitlement") {
      if (context.actor.role !== "owner" && context.actor.role !== "admin") throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "Acesso não autorizado.", 403);
      const command = parseConfigureTrainingEntitlementCommandV1({ ...record(body.command), apiVersion: NUTRIFLOW_API_VERSION, clientId: currentClientId, correlationId: correlation });
      data = await repository.configureEntitlement({ organizationId: context.organizationId, actorAuthUserId: admin.user.id, actorRole: context.actor.role, command });
    } else if (action === "create-draft") {
      data = await repository.createDraft({ organizationId: context.organizationId, clientId: currentClientId, actorAuthUserId: admin.user.id, actorRole: context.actor.role, correlationId: correlation, patientName: String(body.patientName ?? "Paciente") });
    } else if (action === "publish") {
      const command = parsePublishTrainingRoutineCommandV1({ ...record(body.command), apiVersion: NUTRIFLOW_API_VERSION, correlationId: correlation });
      data = await repository.publish({ organizationId: context.organizationId, clientId: currentClientId, actorAuthUserId: admin.user.id, actorRole: context.actor.role, routinePublicId: command.routinePublicId, routineVersionPublicId: command.routineVersionPublicId, expectedRevision: command.expectedRevision, correlationId: command.correlationId });
    } else throw new NutriFlowContractError("action");
    return Response.json({ apiVersion: NUTRIFLOW_API_VERSION, correlationId: correlation, data }, { status: action === "create-draft" ? 201 : 200, headers: headers(startedAt) });
  } catch (error) { return failure(error, correlation, startedAt); }
}

export async function PATCH(request: Request) {
  const startedAt = performance.now();
  const correlation = correlationId(request);
  try {
    const body = record(await request.json());
    const currentClientId = clientId(body.clientId);
    const { context, admin } = await authorized(currentClientId);
    const command = parseSaveTrainingRoutineDraftCommandV1({ ...record(body.command), apiVersion: NUTRIFLOW_API_VERSION, correlationId: correlation });
    const data = await createTrainingEditorRepository().saveDraft({ organizationId: context.organizationId, clientId: currentClientId, actorAuthUserId: admin.user.id, actorRole: context.actor.role, command });
    return Response.json({ apiVersion: NUTRIFLOW_API_VERSION, correlationId: correlation, data }, { headers: headers(startedAt) });
  } catch (error) { return failure(error, correlation, startedAt); }
}
