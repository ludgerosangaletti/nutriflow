import type { FoodPlanDraftV1, SaveFoodPlanDraftCommandV1 } from "../../contracts/v1/plans.ts";
import { NUTRIFLOW_FEATURE_FLAGS } from "../../config/feature-flags.ts";
import { NUTRIFLOW_ACTIONS, type NutriFlowActor } from "../security/authorization.ts";
import type { NutriFlowOperationResult } from "../operations/run-nutriflow-operation.ts";
import { NutriFlowOperationRunner } from "../operations/run-nutriflow-operation.ts";
import { SaveFoodPlanDraft } from "./save-food-plan-draft.ts";

export class SaveFoodPlanDraftOperation {
  private readonly dependencies: Readonly<{ runner: NutriFlowOperationRunner; saveDraft: SaveFoodPlanDraft }>;
  constructor(dependencies: Readonly<{ runner: NutriFlowOperationRunner; saveDraft: SaveFoodPlanDraft }>) { this.dependencies = dependencies; }
  execute(input: Readonly<{ actor: NutriFlowActor; organizationId: number; organizationPublicId: string; clientId: number; command: SaveFoodPlanDraftCommandV1; idempotencyKey: string; requestHash: string }>): Promise<NutriFlowOperationResult<FoodPlanDraftV1>> {
    return this.dependencies.runner.run({ operation: "plan.save-draft.v1", suppliedCorrelationId: input.command.correlationId, flag: NUTRIFLOW_FEATURE_FLAGS.ADMIN_EDITOR, actor: input.actor, action: NUTRIFLOW_ACTIONS.UPDATE_DRAFT, resource: { organizationPublicId: input.organizationPublicId, clientId: input.clientId }, organizationId: input.organizationId, idempotency: { key: input.idempotencyKey, requestHash: input.requestHash, deserialize: (value) => JSON.parse(value) as FoodPlanDraftV1 }, execute: ({ correlationId }) => this.dependencies.saveDraft.execute({ actor: input.actor, organizationId: input.organizationId, organizationPublicId: input.organizationPublicId, clientId: input.clientId, command: { ...input.command, correlationId } }) });
  }
}
