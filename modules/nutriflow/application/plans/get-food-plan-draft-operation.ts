import type { FoodPlanDraftV1 } from "../../contracts/v1/plans.ts";
import { NUTRIFLOW_FEATURE_FLAGS } from "../../config/feature-flags.ts";
import { NUTRIFLOW_ACTIONS, type NutriFlowActor } from "../security/authorization.ts";
import type { NutriFlowOperationResult } from "../operations/run-nutriflow-operation.ts";
import { NutriFlowOperationRunner } from "../operations/run-nutriflow-operation.ts";
import { GetFoodPlanDraft } from "./get-food-plan-draft.ts";

export class GetFoodPlanDraftOperation {
  private readonly runner: NutriFlowOperationRunner;
  private readonly getDraft: GetFoodPlanDraft;

  constructor(dependencies: Readonly<{
    runner: NutriFlowOperationRunner;
    getDraft: GetFoodPlanDraft;
  }>) {
    this.runner = dependencies.runner;
    this.getDraft = dependencies.getDraft;
  }

  execute(input: Readonly<{
    actor: NutriFlowActor;
    organizationId: number;
    organizationPublicId: string;
    clientId: number;
    suppliedCorrelationId?: string | null;
  }>): Promise<NutriFlowOperationResult<FoodPlanDraftV1>> {
    return this.runner.run({
      operation: "plan.get-draft.v1",
      suppliedCorrelationId: input.suppliedCorrelationId,
      flag: NUTRIFLOW_FEATURE_FLAGS.ADMIN_EDITOR,
      actor: input.actor,
      action: NUTRIFLOW_ACTIONS.READ_PLAN,
      resource: {
        organizationPublicId: input.organizationPublicId,
        clientId: input.clientId,
      },
      organizationId: input.organizationId,
      execute: () => this.getDraft.execute({
        actor: input.actor,
        organizationId: input.organizationId,
        organizationPublicId: input.organizationPublicId,
        clientId: input.clientId,
      }),
    });
  }
}
