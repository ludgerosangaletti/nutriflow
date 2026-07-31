import { NUTRIFLOW_API_VERSION } from "../../contracts/v1/errors.ts";
import type { FoodPlanDraftV1 } from "../../contracts/v1/plans.ts";
import { FoodPlanDraft } from "../../domain/plans/food-plan-draft.ts";
import { publicId, versionNumber } from "../../domain/shared/value-objects.ts";
import type { NutriFlowUnitOfWork } from "../ports/unit-of-work.ts";
import {
  assertNutriFlowAuthorized,
  NUTRIFLOW_ACTIONS,
  type NutriFlowActor,
} from "../security/authorization.ts";

export type CreateFoodPlanDraftInput = Readonly<{
  actor: NutriFlowActor;
  organizationPublicId: string;
  clientId: number;
  title: string;
  correlationId: string;
}>;

type IdentifierKind = "plan" | "version" | "event" | "audit";

export class CreateFoodPlanDraft {
  private readonly unitOfWork: NutriFlowUnitOfWork;
  private readonly generatePublicId: (kind: IdentifierKind) => string;
  private readonly clock: () => Date;
  private readonly environment: "development" | "test" | "production";

  constructor(dependencies: Readonly<{
    unitOfWork: NutriFlowUnitOfWork;
    generatePublicId: (kind: IdentifierKind) => string;
    clock?: () => Date;
    environment?: "development" | "test" | "production";
  }>) {
    this.unitOfWork = dependencies.unitOfWork;
    this.generatePublicId = dependencies.generatePublicId;
    this.clock = dependencies.clock ?? (() => new Date());
    this.environment = dependencies.environment ?? "production";
  }

  async execute(input: CreateFoodPlanDraftInput): Promise<FoodPlanDraftV1> {
    const now = this.clock();
    assertNutriFlowAuthorized(
      input.actor,
      NUTRIFLOW_ACTIONS.CREATE_PLAN,
      { organizationPublicId: input.organizationPublicId, clientId: input.clientId },
      now,
    );
    if (input.actor.kind !== "staff") throw new Error("NUTRIFLOW_STAFF_REQUIRED");
    const actor = input.actor;

    const planPublicId = publicId(this.generatePublicId("plan"));
    const planVersionPublicId = publicId(this.generatePublicId("version"));
    const auditPublicId = publicId(this.generatePublicId("audit"));
    const occurredAt = now.toISOString();
    const draft = FoodPlanDraft.create(
      {
        organizationPublicId: publicId(input.organizationPublicId),
        clientId: input.clientId,
        planPublicId,
        planVersionPublicId,
        versionNumber: versionNumber(1),
        title: input.title,
        notes: null,
      },
      {
        eventId: publicId(this.generatePublicId("event")),
        occurredAt,
        actor: { authUserId: actor.authUserId, role: actor.role },
        correlationId: input.correlationId,
        metadata: {
          organizationPublicId: input.organizationPublicId,
          environment: this.environment,
          source: "nutriflow-admin",
        },
      },
    );
    const events = draft.pullDomainEvents();

    await this.unitOfWork.run(async (transaction) => {
      transaction.plans.insertPlan({
        publicId: planPublicId,
        clientId: input.clientId,
        title: input.title.trim(),
        status: "draft",
        createdByAuthUserId: actor.authUserId,
        createdAt: occurredAt,
      });
      transaction.plans.insertPlanVersion({
        publicId: planVersionPublicId,
        planPublicId,
        versionNumber: 1,
        revision: 1,
        schemaVersion: 1,
        state: "draft",
        title: input.title.trim(),
        notes: null,
        snapshotJson: null,
        contentHash: null,
        createdByAuthUserId: actor.authUserId,
        publishedByAuthUserId: null,
        publishedAt: null,
        createdAt: occurredAt,
      });
      transaction.audit.append({
        publicId: auditPublicId,
        actorAuthUserId: actor.authUserId,
        actorRole: actor.role,
        action: "plan.draft.created",
        entityType: "food-plan",
        entityPublicId: planPublicId,
        correlationId: input.correlationId,
        beforeJson: null,
        afterJson: JSON.stringify({
          clientId: input.clientId,
          planVersionPublicId,
          state: "draft",
          revision: 1,
        }),
        occurredAt,
      });
      transaction.enqueueDomainEvents(events);
    });

    return Object.freeze({
      apiVersion: NUTRIFLOW_API_VERSION,
      publicId: planVersionPublicId,
      planPublicId,
      clientId: input.clientId,
      versionNumber: 1,
      revision: 1,
      state: "draft",
      title: input.title.trim(),
      planNotes: null,
      content: Object.freeze({
        schemaVersion: 1,
        days: Object.freeze([]),
        meals: Object.freeze([]),
        notes: Object.freeze([]),
      }),
      updatedAt: occurredAt,
    });
  }
}
