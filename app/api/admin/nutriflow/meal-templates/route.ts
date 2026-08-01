import { NUTRIFLOW_API_VERSION, NUTRIFLOW_ERROR_CODES } from "../../../../../modules/nutriflow/contracts/v1/errors.ts";
import { createNutriFlowApiErrorV1, NutriFlowContractError, parseArchiveReusableContentCommandV1, parseSaveMealTemplateCommandV1, parseSearchReusableContentQueryV1 } from "../../../../../modules/nutriflow/contracts/v1/validation.ts";
import { NutriFlowApplicationError } from "../../../../../modules/nutriflow/application/errors/nutriflow-application-error.ts";
import { createNutriFlowAdminRuntime, resolveNutriFlowAdminContext, sha256Json } from "../../../../nutriflow/server.ts";
import { getAdminSession } from "../../../../supabase/server.ts";

function positiveClientId(value: unknown) { const parsed = Number(value); return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null; }
function correlationId(request: Request) { return request.headers.get("x-correlation-id")?.trim() || `corr_${crypto.randomUUID()}`; }
function record(value: unknown): Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function headers(startedAt: number, queries: string) { return { "server-timing": `nutriflow;dur=${(performance.now() - startedAt).toFixed(1)}`, "x-nutriflow-query-count": queries }; }
function failure(error: unknown, correlation: string, startedAt: number) {
  if (error instanceof NutriFlowApplicationError) return Response.json(createNutriFlowApiErrorV1(error.code, correlation), { status: error.httpStatus, headers: headers(startedAt, "0") });
  if (error instanceof NutriFlowContractError) return Response.json(createNutriFlowApiErrorV1(NUTRIFLOW_ERROR_CODES.INVALID_INPUT, correlation, { path: error.path }), { status: 400, headers: headers(startedAt, "0") });
  console.error("[nutriflow.meal-templates.api]", JSON.stringify({ correlationId: correlation, errorCode: NUTRIFLOW_ERROR_CODES.INTERNAL_ERROR }));
  return Response.json(createNutriFlowApiErrorV1(NUTRIFLOW_ERROR_CODES.INTERNAL_ERROR, correlation), { status: 500, headers: headers(startedAt, "0") });
}
async function authorized() {
  const admin = await getAdminSession(); if (!admin) return null;
  const context = await resolveNutriFlowAdminContext(admin.user.id);
  return context ? { context, operations: createNutriFlowAdminRuntime(context).reusableContent } : null;
}

export async function GET(request: Request) {
  const startedAt = performance.now(); const correlation = correlationId(request);
  try {
    const auth = await authorized(); if (!auth) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "Acesso não autorizado.", 403);
    const parameters = new URL(request.url).searchParams; const clientId = positiveClientId(parameters.get("clientId")); if (!clientId) throw new NutriFlowContractError("clientId");
    const query = parseSearchReusableContentQueryV1({ apiVersion: NUTRIFLOW_API_VERSION, query: parameters.get("query") ?? "", limit: Number(parameters.get("limit") ?? 12), correlationId: correlation });
    const result = await auth.operations.searchMealTemplates({ actor: auth.context.actor, organizationId: auth.context.organizationId, organizationPublicId: auth.context.organizationPublicId, clientId, query });
    return Response.json({ apiVersion: NUTRIFLOW_API_VERSION, correlationId: result.correlationId, data: result.data }, { headers: { ...headers(startedAt, "1"), "cache-control": "private, max-age=15" } });
  } catch (error) { return failure(error, correlation, startedAt); }
}

export async function POST(request: Request) {
  const startedAt = performance.now(); const correlation = correlationId(request);
  try {
    const auth = await authorized(); if (!auth) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "Acesso não autorizado.", 403);
    const body = record(await request.json()); const clientId = positiveClientId(body.clientId); if (!clientId) throw new NutriFlowContractError("clientId");
    const command = parseSaveMealTemplateCommandV1({ ...record(body.command), apiVersion: NUTRIFLOW_API_VERSION, correlationId: correlation });
    const key = request.headers.get("idempotency-key")?.trim(); if (!key) throw new NutriFlowContractError("idempotencyKey");
    const result = await auth.operations.saveMealTemplate({ actor: auth.context.actor, organizationId: auth.context.organizationId, organizationPublicId: auth.context.organizationPublicId, clientId, command, idempotencyKey: key, requestHash: await sha256Json({ clientId, command }) });
    return Response.json({ apiVersion: NUTRIFLOW_API_VERSION, correlationId: result.correlationId, data: result.data }, { status: 201, headers: headers(startedAt, command.templatePublicId ? "2+1-batch" : "1-batch") });
  } catch (error) { return failure(error, correlation, startedAt); }
}

export async function DELETE(request: Request) {
  const startedAt = performance.now(); const correlation = correlationId(request);
  try {
    const auth = await authorized(); if (!auth) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "Acesso não autorizado.", 403);
    const body = record(await request.json()); const clientId = positiveClientId(body.clientId); if (!clientId) throw new NutriFlowContractError("clientId");
    const command = parseArchiveReusableContentCommandV1({ ...record(body.command), apiVersion: NUTRIFLOW_API_VERSION, correlationId: correlation });
    const key = request.headers.get("idempotency-key")?.trim(); if (!key) throw new NutriFlowContractError("idempotencyKey");
    const result = await auth.operations.archiveMealTemplate({ actor: auth.context.actor, organizationId: auth.context.organizationId, organizationPublicId: auth.context.organizationPublicId, clientId, command, idempotencyKey: key, requestHash: await sha256Json({ clientId, command }) });
    return Response.json({ apiVersion: NUTRIFLOW_API_VERSION, correlationId: result.correlationId, data: result.data }, { headers: headers(startedAt, "1+1-batch") });
  } catch (error) { return failure(error, correlation, startedAt); }
}
