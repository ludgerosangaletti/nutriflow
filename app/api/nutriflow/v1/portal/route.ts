import { NUTRIFLOW_API_VERSION, NUTRIFLOW_ERROR_CODES } from "../../../../../modules/nutriflow/contracts/v1/errors.ts";
import { createNutriFlowApiErrorV1 } from "../../../../../modules/nutriflow/contracts/v1/validation.ts";
import { NutriFlowApplicationError } from "../../../../../modules/nutriflow/application/errors/nutriflow-application-error.ts";
import {
  canUseNutriFlowPatientPortal,
  createNutriFlowPatientRuntime,
  resolveNutriFlowPatientContext,
} from "../../../../nutriflow/server.ts";
import { getPatientUser } from "../../../../supabase/server.ts";

export const dynamic = "force-dynamic";

function correlationId(request: Request) {
  return request.headers.get("x-correlation-id")?.trim() || `corr_${crypto.randomUUID()}`;
}

function headers(startedAt: number, queryCount: number) {
  return {
    "cache-control": "private, no-store, max-age=0",
    "server-timing": `nutriflow-portal;dur=${(performance.now() - startedAt).toFixed(1)}`,
    "x-nutriflow-api-version": NUTRIFLOW_API_VERSION,
    "x-nutriflow-query-count": String(queryCount),
  };
}

export async function GET(request: Request) {
  const startedAt = performance.now();
  const correlation = correlationId(request);
  try {
    const user = await getPatientUser();
    if (!user) {
      return Response.json(createNutriFlowApiErrorV1(NUTRIFLOW_ERROR_CODES.UNAUTHENTICATED, correlation), { status: 401, headers: headers(startedAt, 1) });
    }
    const context = await resolveNutriFlowPatientContext(user.id);
    if (!context) {
      return Response.json(createNutriFlowApiErrorV1(NUTRIFLOW_ERROR_CODES.NOT_FOUND, correlation), { status: 404, headers: headers(startedAt, 2) });
    }
    if (!(await canUseNutriFlowPatientPortal(context))) {
      return Response.json(createNutriFlowApiErrorV1(NUTRIFLOW_ERROR_CODES.FEATURE_DISABLED, correlation), { status: 404, headers: headers(startedAt, 3) });
    }
    const data = await createNutriFlowPatientRuntime().getPortal.execute({
      actor: context.actor,
      organizationId: context.organizationId,
      organizationPublicId: context.organizationPublicId,
      patientName: context.patientName,
      modality: context.modality,
    });
    console.info("[nutriflow.portal.metric]", JSON.stringify({
      metric: "patient-portal.read",
      durationMs: Math.round(performance.now() - startedAt),
      queryCount: 6,
      hasPublishedPlan: Boolean(data.plan),
      apiVersion: NUTRIFLOW_API_VERSION,
    }));
    return Response.json({ apiVersion: NUTRIFLOW_API_VERSION, correlationId: correlation, data }, { headers: headers(startedAt, 6) });
  } catch (error) {
    if (error instanceof NutriFlowApplicationError) {
      return Response.json(createNutriFlowApiErrorV1(error.code, correlation), { status: error.httpStatus, headers: headers(startedAt, 6) });
    }
    console.error("[nutriflow.portal]", JSON.stringify({ correlationId: correlation, errorCode: NUTRIFLOW_ERROR_CODES.INTERNAL_ERROR }));
    return Response.json(createNutriFlowApiErrorV1(NUTRIFLOW_ERROR_CODES.INTERNAL_ERROR, correlation), { status: 500, headers: headers(startedAt, 6) });
  }
}
