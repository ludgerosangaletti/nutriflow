import type { PublishedFoodPlanV1, PublishFoodPlanVersionCommandV1 } from "../../contracts/v1/plans.ts";
import { NUTRIFLOW_FEATURE_FLAGS } from "../../config/feature-flags.ts";
import { NUTRIFLOW_ACTIONS, type NutriFlowActor } from "../security/authorization.ts";
import type { NutriFlowOperationResult } from "../operations/run-nutriflow-operation.ts";
import { NutriFlowOperationRunner } from "../operations/run-nutriflow-operation.ts";
import { PublishFoodPlanVersion } from "./publish-food-plan-version.ts";

export class PublishFoodPlanVersionOperation {
  private readonly dependencies: Readonly<{ runner: NutriFlowOperationRunner; publish: PublishFoodPlanVersion }>;
  constructor(dependencies: Readonly<{ runner: NutriFlowOperationRunner; publish: PublishFoodPlanVersion }>) { this.dependencies = dependencies; }
  execute(input: Readonly<{ actor: NutriFlowActor; organizationId: number; organizationPublicId: string; clientId: number; command: PublishFoodPlanVersionCommandV1; idempotencyKey: string; requestHash: string }>): Promise<NutriFlowOperationResult<PublishedFoodPlanV1>> {
    return this.dependencies.runner.run({
      operation: "plan.publish-version.v1", suppliedCorrelationId: input.command.correlationId,
      flag: NUTRIFLOW_FEATURE_FLAGS.ADMIN_EDITOR, actor: input.actor, action: NUTRIFLOW_ACTIONS.PUBLISH_VERSION,
      resource: { organizationPublicId: input.organizationPublicId, clientId: input.clientId }, organizationId: input.organizationId,
      idempotency: { key: input.idempotencyKey, requestHash: input.requestHash, deserialize: (value) => JSON.parse(value) as PublishedFoodPlanV1 },
      execute: ({ correlationId }) => this.dependencies.publish.execute({ actor: input.actor, organizationId: input.organizationId, organizationPublicId: input.organizationPublicId, clientId: input.clientId, command: { ...input.command, correlationId } }),
    });
  }
}
