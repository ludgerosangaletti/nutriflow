import type { FoodPlanDraftV1 } from "../../contracts/v1/plans.ts";
import { NUTRIFLOW_FEATURE_FLAGS } from "../../config/feature-flags.ts";
import type { NutriFlowActor } from "../security/authorization.ts";
import { NUTRIFLOW_ACTIONS } from "../security/authorization.ts";
import type { NutriFlowOperationResult } from "../operations/run-nutriflow-operation.ts";
import { NutriFlowOperationRunner } from "../operations/run-nutriflow-operation.ts";
import { CreateFoodPlanRevision } from "./create-food-plan-revision.ts";

export class CreateFoodPlanRevisionOperation {
  private readonly dependencies: Readonly<{ runner: NutriFlowOperationRunner; createRevision: CreateFoodPlanRevision }>;
  constructor(dependencies: Readonly<{ runner: NutriFlowOperationRunner; createRevision: CreateFoodPlanRevision }>) { this.dependencies = dependencies; }
  execute(input: Readonly<{ actor: NutriFlowActor; organizationId: number; organizationPublicId: string; clientId: number; suppliedCorrelationId?: string | null; idempotencyKey: string; requestHash: string }>): Promise<NutriFlowOperationResult<FoodPlanDraftV1>> {
    return this.dependencies.runner.run({ operation: "plan.create-revision.v1", suppliedCorrelationId: input.suppliedCorrelationId, flag: NUTRIFLOW_FEATURE_FLAGS.ADMIN_EDITOR, actor: input.actor, action: NUTRIFLOW_ACTIONS.CREATE_PLAN, resource: { organizationPublicId: input.organizationPublicId, clientId: input.clientId }, organizationId: input.organizationId, idempotency: { key: input.idempotencyKey, requestHash: input.requestHash, deserialize: (value) => JSON.parse(value) as FoodPlanDraftV1 }, execute: ({ correlationId }) => this.dependencies.createRevision.execute({ actor: input.actor, organizationId: input.organizationId, organizationPublicId: input.organizationPublicId, clientId: input.clientId, correlationId }) });
  }
}
