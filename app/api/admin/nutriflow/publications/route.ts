import { NUTRIFLOW_API_VERSION, NUTRIFLOW_ERROR_CODES } from "../../../../../modules/nutriflow/contracts/v1/errors.ts";
import { createNutriFlowApiErrorV1, NutriFlowContractError, parsePublishFoodPlanVersionCommandV1 } from "../../../../../modules/nutriflow/contracts/v1/validation.ts";
import { NutriFlowApplicationError } from "../../../../../modules/nutriflow/application/errors/nutriflow-application-error.ts";
import { createNutriFlowAdminRuntime, resolveNutriFlowAdminContext, sha256Json } from "../../../../nutriflow/server.ts";
import { getAdminSession } from "../../../../supabase/server.ts";

function correlationId(request: Request) { return request.headers.get("x-correlation-id")?.trim() || `corr_${crypto.randomUUID()}`; }
function headers(startedAt: number) { return { "cache-control": "private, no-store", "server-timing": `nutriflow-publish;dur=${(performance.now() - startedAt).toFixed(1)}`, "x-nutriflow-query-count": "5+1-batch" }; }

export async function POST(request: Request) {
  const startedAt = performance.now();
  const correlation = correlationId(request);
  try {
    const admin = await getAdminSession();
    if (!admin) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "Acesso não autorizado.", 403);
    const context = await resolveNutriFlowAdminContext(admin.user.id);
    if (!context) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "Acesso não autorizado.", 403);
    const body = await request.json() as Record<string, unknown>;
    const clientId = Number(body.clientId);
    if (!Number.isSafeInteger(clientId) || clientId < 1) throw new NutriFlowContractError("clientId");
    const command = parsePublishFoodPlanVersionCommandV1({ ...(body.command as Record<string, unknown>), apiVersion: NUTRIFLOW_API_VERSION, correlationId: correlation });
    const key = request.headers.get("idempotency-key")?.trim();
    if (!key) throw new NutriFlowContractError("idempotencyKey");
    const result = await createNutriFlowAdminRuntime(context).publish.execute({
      actor: context.actor, organizationId: context.organizationId, organizationPublicId: context.organizationPublicId,
      clientId, command, idempotencyKey: key, requestHash: await sha256Json({ clientId, command }),
    });
    return Response.json({ apiVersion: NUTRIFLOW_API_VERSION, correlationId: result.correlationId, data: result.data }, { status: 201, headers: headers(startedAt) });
  } catch (error) {
    if (error instanceof NutriFlowApplicationError) return Response.json(createNutriFlowApiErrorV1(error.code, correlation), { status: error.httpStatus, headers: headers(startedAt) });
    if (error instanceof NutriFlowContractError) return Response.json(createNutriFlowApiErrorV1(NUTRIFLOW_ERROR_CODES.INVALID_INPUT, correlation, { path: error.path }), { status: 400, headers: headers(startedAt) });
    console.error("[nutriflow.publish]", JSON.stringify({ correlationId: correlation, errorCode: NUTRIFLOW_ERROR_CODES.INTERNAL_ERROR }));
    return Response.json(createNutriFlowApiErrorV1(NUTRIFLOW_ERROR_CODES.INTERNAL_ERROR, correlation), { status: 500, headers: headers(startedAt) });
  }
}

