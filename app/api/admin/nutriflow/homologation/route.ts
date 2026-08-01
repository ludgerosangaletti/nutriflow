import {
  NUTRIFLOW_API_VERSION,
  NUTRIFLOW_ERROR_CODES,
} from "../../../../../modules/nutriflow/contracts/v1/errors.ts";
import {
  createNutriFlowApiErrorV1,
  NutriFlowContractError,
} from "../../../../../modules/nutriflow/contracts/v1/validation.ts";
import { NutriFlowApplicationError } from "../../../../../modules/nutriflow/application/errors/nutriflow-application-error.ts";
import {
  createNutriFlowAdminRuntime,
  resolveNutriFlowAdminContext,
  sha256Json,
} from "../../../../nutriflow/server.ts";
import { getAdminSession } from "../../../../supabase/server.ts";

export const dynamic = "force-dynamic";

function correlationId(request: Request) {
  return request.headers.get("x-correlation-id")?.trim() || `corr_${crypto.randomUUID()}`;
}

function responseHeaders(startedAt: number) {
  return {
    "cache-control": "private, no-store, max-age=0",
    "server-timing": `nutriflow-homologation;dur=${(performance.now() - startedAt).toFixed(1)}`,
    "x-nutriflow-api-version": NUTRIFLOW_API_VERSION,
    "x-nutriflow-query-count": "1+7-batch+2-idempotency",
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const correlation = correlationId(request);
  try {
    const admin = await getAdminSession();
    if (!admin) throw forbidden();
    const context = await resolveNutriFlowAdminContext(admin.user.id);
    if (!context) throw forbidden();
    const body = asRecord(await request.json());
    const clientId = Number(body.clientId);
    const action = body.action === "activate" || body.action === "suspend"
      ? body.action
      : null;
    const reason = typeof body.reason === "string" ? body.reason : "";
    const expiresAt = typeof body.expiresAt === "string" ? body.expiresAt : null;
    const confirmedTestAccount = body.confirmedTestAccount === true;
    const key = request.headers.get("idempotency-key")?.trim();
    if (!Number.isSafeInteger(clientId) || clientId < 1 || !action || !key) {
      throw new NutriFlowContractError("homologation");
    }
    const payload = {
      clientId,
      enabled: action === "activate",
      reason,
      expiresAt: action === "activate" ? expiresAt : null,
      confirmedTestAccount,
    };
    const data = await createNutriFlowAdminRuntime(context).configureHomologation.execute({
      actor: context.actor,
      organizationId: context.organizationId,
      organizationPublicId: context.organizationPublicId,
      ...payload,
      correlationId: correlation,
      idempotencyKey: key,
      requestHash: await sha256Json(payload),
    });
    console.info("[nutriflow.homologation.metric]", JSON.stringify({
      action,
      durationMs: Math.round(performance.now() - startedAt),
      flagsConfigured: data.flagsConfigured,
      apiVersion: NUTRIFLOW_API_VERSION,
    }));
    return Response.json(
      { apiVersion: NUTRIFLOW_API_VERSION, correlationId: correlation, data },
      { headers: responseHeaders(startedAt) },
    );
  } catch (error) {
    if (error instanceof NutriFlowApplicationError) {
      return Response.json(createNutriFlowApiErrorV1(error.code, correlation), {
        status: error.httpStatus,
        headers: responseHeaders(startedAt),
      });
    }
    if (error instanceof NutriFlowContractError) {
      return Response.json(
        createNutriFlowApiErrorV1(NUTRIFLOW_ERROR_CODES.INVALID_INPUT, correlation, { path: error.path }),
        { status: 400, headers: responseHeaders(startedAt) },
      );
    }
    console.error("[nutriflow.homologation]", JSON.stringify({
      correlationId: correlation,
      errorCode: NUTRIFLOW_ERROR_CODES.INTERNAL_ERROR,
    }));
    return Response.json(
      createNutriFlowApiErrorV1(NUTRIFLOW_ERROR_CODES.INTERNAL_ERROR, correlation),
      { status: 500, headers: responseHeaders(startedAt) },
    );
  }
}

function forbidden() {
  return new NutriFlowApplicationError(
    NUTRIFLOW_ERROR_CODES.FORBIDDEN,
    "Acesso não autorizado.",
    403,
  );
}

