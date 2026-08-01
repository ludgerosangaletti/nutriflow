import { NUTRIFLOW_API_VERSION, NUTRIFLOW_ERROR_CODES } from "../../../../../../modules/nutriflow/contracts/v1/errors.ts";
import { createNutriFlowApiErrorV1, NutriFlowContractError, parseSearchFoodCatalogQueryV1 } from "../../../../../../modules/nutriflow/contracts/v1/validation.ts";
import { NutriFlowApplicationError } from "../../../../../../modules/nutriflow/application/errors/nutriflow-application-error.ts";
import { createNutriFlowAdminRuntime, resolveNutriFlowAdminContext } from "../../../../../nutriflow/server.ts";
import { getAdminSession } from "../../../../../supabase/server.ts";

function positiveClientId(value: string | null) {
  const clientId = Number(value);
  return Number.isSafeInteger(clientId) && clientId > 0 ? clientId : null;
}

function correlationId(request: Request) {
  return request.headers.get("x-correlation-id")?.trim() || `corr_${crypto.randomUUID()}`;
}

function failure(error: unknown, correlation: string, duration: number) {
  const headers = { "server-timing": `nutriflow;dur=${duration.toFixed(1)}`, "x-nutriflow-query-count": "1" };
  if (error instanceof NutriFlowApplicationError) return Response.json(createNutriFlowApiErrorV1(error.code, correlation), { status: error.httpStatus, headers });
  if (error instanceof NutriFlowContractError) return Response.json(createNutriFlowApiErrorV1(NUTRIFLOW_ERROR_CODES.INVALID_INPUT, correlation, { path: error.path }), { status: 400, headers });
  console.error("[nutriflow.catalog.api]", JSON.stringify({ correlationId: correlation, errorCode: NUTRIFLOW_ERROR_CODES.INTERNAL_ERROR }));
  return Response.json(createNutriFlowApiErrorV1(NUTRIFLOW_ERROR_CODES.INTERNAL_ERROR, correlation), { status: 500, headers });
}

export async function GET(request: Request) {
  const startedAt = performance.now();
  const correlation = correlationId(request);
  try {
    const admin = await getAdminSession();
    if (!admin) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "Acesso não autorizado.", 403);
    const context = await resolveNutriFlowAdminContext(admin.user.id);
    if (!context) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "Acesso não autorizado.", 403);
    const parameters = new URL(request.url).searchParams;
    const clientId = positiveClientId(parameters.get("clientId"));
    if (!clientId) throw new NutriFlowContractError("clientId");
    const query = parseSearchFoodCatalogQueryV1({
      apiVersion: NUTRIFLOW_API_VERSION,
      query: parameters.get("query") ?? "",
      categoryCode: parameters.get("category"),
      limit: Number(parameters.get("limit") ?? 12),
      correlationId: correlation,
    });
    const result = await createNutriFlowAdminRuntime(context).searchCatalog.execute({ actor: context.actor, organizationId: context.organizationId, organizationPublicId: context.organizationPublicId, clientId, query });
    const duration = performance.now() - startedAt;
    return Response.json({ apiVersion: NUTRIFLOW_API_VERSION, correlationId: result.correlationId, data: result.data }, { headers: { "server-timing": `nutriflow;dur=${duration.toFixed(1)}`, "x-nutriflow-query-count": "1", "cache-control": "private, max-age=30" } });
  } catch (error) {
    return failure(error, correlation, performance.now() - startedAt);
  }
}
