import { NUTRIFLOW_API_VERSION, NUTRIFLOW_ERROR_CODES } from "../../../../../modules/nutriflow/contracts/v1/errors.ts";
import { createNutriFlowApiErrorV1 } from "../../../../../modules/nutriflow/contracts/v1/validation.ts";
import { NutriFlowApplicationError } from "../../../../../modules/nutriflow/application/errors/nutriflow-application-error.ts";
import { createNutriFlowAdminRuntime, resolveNutriFlowAdminContext, sha256Json } from "../../../../nutriflow/server";
import { getAdminSession } from "../../../../supabase/server";

export async function POST(request: Request) {
  const correlationId = request.headers.get("x-correlation-id")?.trim() || `corr_${crypto.randomUUID()}`;
  try {
    const admin = await getAdminSession();
    if (!admin) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "Acesso não autorizado.", 403);
    const context = await resolveNutriFlowAdminContext(admin.user.id);
    if (!context) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "Acesso não autorizado.", 403);
    const body = (await request.json().catch(() => ({}))) as { clientId?: number };
    const clientId = Number(body.clientId);
    if (!Number.isSafeInteger(clientId) || clientId < 1) return Response.json(createNutriFlowApiErrorV1(NUTRIFLOW_ERROR_CODES.INVALID_INPUT, correlationId), { status: 400 });
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey) return Response.json(createNutriFlowApiErrorV1(NUTRIFLOW_ERROR_CODES.INVALID_INPUT, correlationId), { status: 400 });
    const result = await createNutriFlowAdminRuntime(context).createRevision.execute({ actor: context.actor, organizationId: context.organizationId, organizationPublicId: context.organizationPublicId, clientId, suppliedCorrelationId: correlationId, idempotencyKey, requestHash: await sha256Json({ clientId }) });
    return Response.json({ apiVersion: NUTRIFLOW_API_VERSION, correlationId: result.correlationId, data: result.data }, { status: 201 });
  } catch (error) {
    if (error instanceof NutriFlowApplicationError) return Response.json(createNutriFlowApiErrorV1(error.code, correlationId), { status: error.httpStatus });
    console.error("[nutriflow.revision]", error);
    return Response.json(createNutriFlowApiErrorV1(NUTRIFLOW_ERROR_CODES.INTERNAL_ERROR, correlationId), { status: 500 });
  }
}
