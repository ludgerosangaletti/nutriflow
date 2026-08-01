import { NUTRIFLOW_API_VERSION, NUTRIFLOW_ERROR_CODES } from "../../../../../modules/nutriflow/contracts/v1/errors.ts";
import { createNutriFlowApiErrorV1, NutriFlowContractError, parseCreateFoodPlanCommandV1, parseSaveFoodPlanDraftCommandV1 } from "../../../../../modules/nutriflow/contracts/v1/validation.ts";
import { NutriFlowApplicationError } from "../../../../../modules/nutriflow/application/errors/nutriflow-application-error.ts";
import { createNutriFlowAdminRuntime, resolveNutriFlowAdminContext, sha256Json } from "../../../../nutriflow/server.ts";
import { getAdminSession } from "../../../../supabase/server.ts";

function positiveClientId(value: string | null) {
  const clientId = Number(value);
  return Number.isSafeInteger(clientId) && clientId > 0 ? clientId : null;
}

function correlationId(request: Request) {
  const supplied = request.headers.get("x-correlation-id")?.trim();
  return supplied || `corr_${crypto.randomUUID()}`;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function authorizedRuntime() {
  const admin = await getAdminSession();
  if (!admin) return null;
  const context = await resolveNutriFlowAdminContext(admin.user.id);
  return context ? { context, runtime: createNutriFlowAdminRuntime(context) } : null;
}

function metricHeaders(startedAt: number, queryCount: string) {
  return { "server-timing": `nutriflow;dur=${(performance.now() - startedAt).toFixed(1)}`, "x-nutriflow-query-count": queryCount };
}

function success(correlation: string, data: unknown, startedAt: number, queryCount: string, status = 200) {
  return Response.json({ apiVersion: NUTRIFLOW_API_VERSION, correlationId: correlation, data }, { status, headers: metricHeaders(startedAt, queryCount) });
}

function failure(error: unknown, correlation: string, startedAt: number) {
  if (error instanceof NutriFlowApplicationError) {
    return Response.json(createNutriFlowApiErrorV1(error.code, correlation), { status: error.httpStatus, headers: metricHeaders(startedAt, "0") });
  }
  if (error instanceof NutriFlowContractError) {
    return Response.json(createNutriFlowApiErrorV1(NUTRIFLOW_ERROR_CODES.INVALID_INPUT, correlation, { path: error.path }), { status: 400, headers: metricHeaders(startedAt, "0") });
  }
  console.error("[nutriflow.api]", JSON.stringify({ correlationId: correlation, errorCode: NUTRIFLOW_ERROR_CODES.INTERNAL_ERROR }));
  return Response.json(createNutriFlowApiErrorV1(NUTRIFLOW_ERROR_CODES.INTERNAL_ERROR, correlation), { status: 500, headers: metricHeaders(startedAt, "0") });
}

export async function GET(request: Request) {
  const startedAt = performance.now();
  const correlation = correlationId(request);
  try {
    const authorized = await authorizedRuntime();
    if (!authorized) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "Acesso não autorizado.", 403);
    const clientId = positiveClientId(new URL(request.url).searchParams.get("clientId"));
    if (!clientId) throw new NutriFlowContractError("clientId");
    const result = await authorized.runtime.getDraft.execute({
      actor: authorized.context.actor,
      organizationId: authorized.context.organizationId,
      organizationPublicId: authorized.context.organizationPublicId,
      clientId,
      suppliedCorrelationId: correlation,
    });
    return success(result.correlationId, result.data, startedAt, "5");
  } catch (error) {
    return failure(error, correlation, startedAt);
  }
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const correlation = correlationId(request);
  try {
    const authorized = await authorizedRuntime();
    if (!authorized) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "Acesso não autorizado.", 403);
    const body = recordValue(await request.json());
    const command = parseCreateFoodPlanCommandV1({ ...body, apiVersion: NUTRIFLOW_API_VERSION, correlationId: correlation });
    const key = request.headers.get("idempotency-key")?.trim();
    if (!key) throw new NutriFlowContractError("idempotencyKey");
    const result = await authorized.runtime.createDraft.execute({
      actor: authorized.context.actor,
      organizationId: authorized.context.organizationId,
      organizationPublicId: authorized.context.organizationPublicId,
      clientId: command.clientId,
      title: command.title,
      suppliedCorrelationId: correlation,
      idempotencyKey: key,
      requestHash: await sha256Json(command),
    });
    return success(result.correlationId, result.data, startedAt, "1-batch", 201);
  } catch (error) {
    return failure(error, correlation, startedAt);
  }
}

export async function PATCH(request: Request) {
  const startedAt = performance.now();
  const correlation = correlationId(request);
  try {
    const authorized = await authorizedRuntime();
    if (!authorized) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "Acesso não autorizado.", 403);
    const body = recordValue(await request.json());
    const clientId = positiveClientId(String(body.clientId ?? ""));
    if (!clientId) throw new NutriFlowContractError("clientId");
    const command = parseSaveFoodPlanDraftCommandV1({ ...recordValue(body.command), apiVersion: NUTRIFLOW_API_VERSION, correlationId: correlation });
    const key = request.headers.get("idempotency-key")?.trim();
    if (!key) throw new NutriFlowContractError("idempotencyKey");
    const result = await authorized.runtime.saveDraft.execute({
      actor: authorized.context.actor,
      organizationId: authorized.context.organizationId,
      organizationPublicId: authorized.context.organizationPublicId,
      clientId,
      command,
      idempotencyKey: key,
      requestHash: await sha256Json({ clientId, command }),
    });
    return success(result.correlationId, result.data, startedAt, "5+1-batch");
  } catch (error) {
    return failure(error, correlation, startedAt);
  }
}
