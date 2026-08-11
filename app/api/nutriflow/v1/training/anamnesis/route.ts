import { NUTRIFLOW_API_VERSION, NUTRIFLOW_ERROR_CODES } from "../../../../../../modules/nutriflow/contracts/v1/errors.ts";
import { NutriFlowContractError } from "../../../../../../modules/nutriflow/contracts/v1/validation.ts";
import { NutriFlowApplicationError } from "../../../../../../modules/nutriflow/application/errors/nutriflow-application-error.ts";
import { NUTRIFLOW_FEATURE_FLAGS } from "../../../../../../modules/nutriflow/config/feature-flags.ts";
import { canUseNutriFlowFeature, createNutriFlowPatientRuntime, createTrainingAnamnesisRepository, resolveNutriFlowPatientContext } from "../../../../../nutriflow/server.ts";
import { getPatientUser } from "../../../../../supabase/server.ts";

function correlationId(request: Request) { return request.headers.get("x-correlation-id")?.trim() || `corr_${crypto.randomUUID()}`; }
function record(value: unknown) { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

async function authorized() {
  const user = await getPatientUser();
  if (!user) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "Faça login.", 401);
  const context = await resolveNutriFlowPatientContext(user.id);
  if (!context || !(await canUseNutriFlowFeature(context, context.actor.clientId, NUTRIFLOW_FEATURE_FLAGS.TRAINING))) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FEATURE_DISABLED, "Training indisponível.", 404);
  const portal = await createNutriFlowPatientRuntime().getTraining.execute({ actor: context.actor, organizationId: context.organizationId, organizationPublicId: context.organizationPublicId });
  if (portal.card.state === "commercial") throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "A anamnese pertence ao Training contratado.", 403);
  return { user, context };
}

function failure(error: unknown, correlation: string) {
  if (error instanceof NutriFlowApplicationError) return Response.json({ apiVersion: NUTRIFLOW_API_VERSION, correlationId: correlation, errorCode: error.code, message: error.message }, { status: error.httpStatus });
  if (error instanceof NutriFlowContractError) return Response.json({ apiVersion: NUTRIFLOW_API_VERSION, correlationId: correlation, errorCode: NUTRIFLOW_ERROR_CODES.INVALID_INPUT, message: "Revise as respostas obrigatórias.", details: { path: error.path } }, { status: 400 });
  console.error("[nutriflow.training.anamnesis]", JSON.stringify({ correlationId: correlation, errorCode: NUTRIFLOW_ERROR_CODES.INTERNAL_ERROR }));
  return Response.json({ apiVersion: NUTRIFLOW_API_VERSION, correlationId: correlation, errorCode: NUTRIFLOW_ERROR_CODES.INTERNAL_ERROR, message: "Não foi possível salvar a anamnese." }, { status: 500 });
}

export async function PUT(request: Request) {
  const correlation = correlationId(request);
  try {
    const { user, context } = await authorized();
    const body = record(await request.json());
    const data = await createTrainingAnamnesisRepository().saveForPatient({
      organizationId: context.organizationId, clientId: context.actor.clientId, actorAuthUserId: user.id,
      answers: body.answers as never, submit: body.submit === true, correlationId: correlation,
    });
    return Response.json({ apiVersion: NUTRIFLOW_API_VERSION, correlationId: correlation, data }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return failure(error, correlation); }
}
