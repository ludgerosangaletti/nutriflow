import { NUTRIFLOW_API_VERSION, NUTRIFLOW_ERROR_CODES } from "../../contracts/v1/errors.ts";
import type { FoodPlanDraftV1 } from "../../contracts/v1/plans.ts";
import { NutriFlowApplicationError } from "../errors/nutriflow-application-error.ts";
import type { FoodPlanReadRepository } from "../ports/food-plan-repository.ts";
import {
  assertNutriFlowAuthorized,
  NUTRIFLOW_ACTIONS,
  type NutriFlowActor,
} from "../security/authorization.ts";

export class GetFoodPlanDraft {
  private readonly plans: FoodPlanReadRepository;
  constructor(plans: FoodPlanReadRepository) {
    this.plans = plans;
  }

  async execute(input: Readonly<{
    actor: NutriFlowActor;
    organizationId: number;
    organizationPublicId: string;
    clientId: number;
    now?: Date;
  }>): Promise<FoodPlanDraftV1> {
    assertNutriFlowAuthorized(
      input.actor,
      NUTRIFLOW_ACTIONS.READ_PLAN,
      { organizationPublicId: input.organizationPublicId, clientId: input.clientId },
      input.now,
    );
    const record = await this.plans.findLatestDraft({
      organizationId: input.organizationId,
      clientId: input.clientId,
    });
    if (!record) {
      throw new NutriFlowApplicationError(
        NUTRIFLOW_ERROR_CODES.NOT_FOUND,
        "Recurso não encontrado.",
        404,
      );
    }
    return Object.freeze({
      apiVersion: NUTRIFLOW_API_VERSION,
      ...record,
      content: Object.freeze({
        schemaVersion: 1,
        days: Object.freeze([]),
        meals: Object.freeze([]),
        notes: Object.freeze([]),
      }),
    });
  }
}
