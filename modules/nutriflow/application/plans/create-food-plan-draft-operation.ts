import type { FoodPlanDraftV1 } from "../../contracts/v1/plans.ts";
import { NUTRIFLOW_FEATURE_FLAGS } from "../../config/feature-flags.ts";
import type { NutriFlowActor } from "../security/authorization.ts";
import { NUTRIFLOW_ACTIONS } from "../security/authorization.ts";
import type { NutriFlowOperationResult } from "../operations/run-nutriflow-operation.ts";
import { NutriFlowOperationRunner } from "../operations/run-nutriflow-operation.ts";
import { CreateFoodPlanDraft } from "./create-food-plan-draft.ts";

export class CreateFoodPlanDraftOperation {
  private readonly runner: NutriFlowOperationRunner;
  private readonly createDraft: CreateFoodPlanDraft;

  constructor(dependencies: Readonly<{
    runner: NutriFlowOperationRunner;
    createDraft: CreateFoodPlanDraft;
  }>) {
    this.runner = dependencies.runner;
    this.createDraft = dependencies.createDraft;
  }

  execute(input: Readonly<{
    actor: NutriFlowActor;
    organizationId: number;
    organizationPublicId: string;
    clientId: number;
    title: string;
    suppliedCorrelationId?: string | null;
    idempotencyKey: string;
    requestHash: string;
  }>): Promise<NutriFlowOperationResult<FoodPlanDraftV1>> {
    return this.runner.run({
      operation: "plan.create-draft.v1",
      suppliedCorrelationId: input.suppliedCorrelationId,
      flag: NUTRIFLOW_FEATURE_FLAGS.ADMIN_EDITOR,
      actor: input.actor,
      action: NUTRIFLOW_ACTIONS.CREATE_PLAN,
      resource: {
        organizationPublicId: input.organizationPublicId,
        clientId: input.clientId,
      },
      organizationId: input.organizationId,
      idempotency: {
        key: input.idempotencyKey,
        requestHash: input.requestHash,
        deserialize: (value) => JSON.parse(value) as FoodPlanDraftV1,
      },
      execute: ({ correlationId }) => this.createDraft.execute({
        actor: input.actor,
        organizationPublicId: input.organizationPublicId,
        clientId: input.clientId,
        title: input.title,
        correlationId,
      }),
    });
  }
}
