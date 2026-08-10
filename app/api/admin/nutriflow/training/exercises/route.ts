import { NUTRIFLOW_API_VERSION, NUTRIFLOW_ERROR_CODES } from "../../../../../../modules/nutriflow/contracts/v1/errors.ts";
import { createNutriFlowApiErrorV1, NutriFlowContractError, parseSearchTrainingExerciseLibraryQueryV1 } from "../../../../../../modules/nutriflow/contracts/v1/validation.ts";
import { NutriFlowApplicationError } from "../../../../../../modules/nutriflow/application/errors/nutriflow-application-error.ts";
import { NUTRIFLOW_FEATURE_FLAGS } from "../../../../../../modules/nutriflow/config/feature-flags.ts";
import { canUseNutriFlowFeature, resolveNutriFlowAdminContext } from "../../../../../nutriflow/server.ts";
import { getAdminSession } from "../../../../../supabase/server.ts";
import { D1TrainingLibraryRepository } from "../../../../../../modules/nutriflow/infrastructure/d1/d1-training-library-repository.ts";
import { env } from "cloudflare:workers";

export async function GET(request: Request) {
  const correlationId = request.headers.get("x-correlation-id")?.trim() || `corr_${crypto.randomUUID()}`;
  try {
    const parameters = new URL(request.url).searchParams;
    const clientId = Number(parameters.get("clientId"));
    if (!Number.isSafeInteger(clientId) || clientId < 1) throw new NutriFlowContractError("clientId");
    const admin = await getAdminSession();
    const context = admin ? await resolveNutriFlowAdminContext(admin.user.id) : null;
    if (!context || !(await canUseNutriFlowFeature(context, clientId, NUTRIFLOW_FEATURE_FLAGS.TRAINING))) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FEATURE_DISABLED, "Treino indisponível.", 404);
    const query = parseSearchTrainingExerciseLibraryQueryV1({ apiVersion: NUTRIFLOW_API_VERSION, query: parameters.get("query") ?? "", muscleGroup: parameters.get("muscleGroup"), limit: Number(parameters.get("limit") ?? 12), correlationId });
    const data = await new D1TrainingLibraryRepository(env.DB).search({ organizationId: context.organizationId, query });
    return Response.json({ apiVersion: NUTRIFLOW_API_VERSION, correlationId, data }, { headers: { "cache-control": "private, max-age=30" } });
  } catch (error) {
    const status = error instanceof NutriFlowApplicationError ? error.httpStatus : error instanceof NutriFlowContractError ? 400 : 500;
    const code = error instanceof NutriFlowApplicationError ? error.code : error instanceof NutriFlowContractError ? NUTRIFLOW_ERROR_CODES.INVALID_INPUT : NUTRIFLOW_ERROR_CODES.INTERNAL_ERROR;
    return Response.json(createNutriFlowApiErrorV1(code, correlationId, error instanceof NutriFlowContractError ? { path: error.path } : undefined), { status });
  }
}
