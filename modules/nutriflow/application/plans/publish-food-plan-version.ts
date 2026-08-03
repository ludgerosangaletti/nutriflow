import { NUTRIFLOW_API_VERSION, NUTRIFLOW_ERROR_CODES } from "../../contracts/v1/errors.ts";
import type { PublishedFoodPlanV1, PublishFoodPlanVersionCommandV1 } from "../../contracts/v1/plans.ts";
import { FoodPlanDraft, type DomainEventContext } from "../../domain/plans/food-plan-draft.ts";
import { publicId, quantityMilli, revisionToken, sortOrder, unitCode, versionNumber } from "../../domain/shared/value-objects.ts";
import { NutriFlowApplicationError } from "../errors/nutriflow-application-error.ts";
import type { FoodPlanReadRepository } from "../ports/food-plan-repository.ts";
import type { FoodPlanPublicationStore } from "../ports/food-plan-publication-store.ts";
import { assertNutriFlowAuthorized, NUTRIFLOW_ACTIONS, type NutriFlowActor } from "../security/authorization.ts";

type IdentifierKind = "event" | "audit" | "publication";

export class PublishFoodPlanVersion {
  private readonly plans: FoodPlanReadRepository;
  private readonly store: FoodPlanPublicationStore;
  private readonly generatePublicId: (kind: IdentifierKind) => string;
  private readonly hashJson: (value: unknown) => Promise<string>;
  private readonly clock: () => Date;
  private readonly environment: "development" | "test" | "production";

  constructor(dependencies: Readonly<{
    plans: FoodPlanReadRepository;
    store: FoodPlanPublicationStore;
    generatePublicId: (kind: IdentifierKind) => string;
    hashJson: (value: unknown) => Promise<string>;
    clock?: () => Date;
    environment?: "development" | "test" | "production";
  }>) {
    this.plans = dependencies.plans;
    this.store = dependencies.store;
    this.generatePublicId = dependencies.generatePublicId;
    this.hashJson = dependencies.hashJson;
    this.clock = dependencies.clock ?? (() => new Date());
    this.environment = dependencies.environment ?? "production";
  }

  async execute(input: Readonly<{
    actor: NutriFlowActor;
    organizationId: number;
    organizationPublicId: string;
    clientId: number;
    command: PublishFoodPlanVersionCommandV1;
  }>): Promise<PublishedFoodPlanV1> {
    const now = this.clock();
    assertNutriFlowAuthorized(input.actor, NUTRIFLOW_ACTIONS.PUBLISH_VERSION, { organizationPublicId: input.organizationPublicId, clientId: input.clientId }, now);
    if (input.actor.kind !== "staff") throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "Acesso não autorizado.", 403);
    const existing = await this.plans.findDraftByVersion({ organizationId: input.organizationId, clientId: input.clientId, planVersionPublicId: input.command.planVersionPublicId });
    if (!existing || existing.planPublicId !== input.command.planPublicId) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.NOT_FOUND, "Recurso não encontrado.", 404);
    if (existing.revision !== input.command.expectedRevision) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.VERSION_CONFLICT, "O rascunho foi alterado em outra sessão.", 409);
    const checklist = [
      !existing.title.trim() ? "título do plano" : null,
      existing.content.days.length === 0 ? "ao menos um dia" : null,
      existing.content.meals.length === 0 ? "ao menos uma refeição" : null,
      ...existing.content.meals.filter((meal) => meal.items.length === 0).map((meal) => `alimentos em ${meal.title || "refeição sem nome"}`),
    ].filter((item): item is string => Boolean(item));
    if (checklist.length) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.INVALID_INPUT, `Checklist de publicação incompleto: ${checklist.join(", ")}.`, 400);

    const meals = existing.content.meals.map((meal) => Object.freeze({
      publicId: publicId(meal.publicId),
      planDayPublicId: meal.planDayPublicId ? publicId(meal.planDayPublicId) : null,
      title: meal.title,
      scheduledTime: meal.scheduledTime,
      instructions: meal.instructions,
      sourceTemplatePublicId: meal.sourceTemplate ? publicId(meal.sourceTemplate.publicId) : null,
      sourceTemplateVersionNumber: meal.sourceTemplate ? versionNumber(meal.sourceTemplate.versionNumber) : null,
      sortOrder: sortOrder(meal.sortOrder),
      items: Object.freeze(meal.items.map((item) => Object.freeze({
        publicId: publicId(item.publicId),
        source: Object.freeze({ type: item.source.type, publicId: item.source.publicId ? publicId(item.source.publicId) : null, revisionNumber: item.source.revisionNumber ? versionNumber(item.source.revisionNumber) : null }),
        displayName: item.displayName,
        quantityMilli: quantityMilli(item.quantityMilli),
        unitPublicId: publicId(item.unit.publicId),
        unitCode: unitCode(item.unit.code),
        unitLabel: item.unit.label,
        preparation: item.preparation,
        notes: item.notes,
        sortOrder: sortOrder(item.sortOrder),
      }))),
      substitutions: Object.freeze((meal.substitutions ?? []).map((group) => Object.freeze({ ...group, publicId: publicId(group.publicId), mealItemPublicId: group.mealItemPublicId ? publicId(group.mealItemPublicId) : null, options: Object.freeze(group.options.map((option) => Object.freeze({ ...option, publicId: publicId(option.publicId), unitPublicId: publicId(option.unit.publicId), quantityMilli: quantityMilli(option.quantityMilli), sortOrder: sortOrder(option.sortOrder), source: Object.freeze({ ...option.source, publicId: option.source.publicId ? publicId(option.source.publicId) : null, revisionNumber: option.source.revisionNumber ? versionNumber(option.source.revisionNumber) : null }) }))) }))),
    }));
    const draft = FoodPlanDraft.rehydrate({
      organizationPublicId: publicId(input.organizationPublicId),
      clientId: input.clientId,
      planPublicId: publicId(existing.planPublicId),
      planVersionPublicId: publicId(existing.publicId),
      versionNumber: versionNumber(existing.versionNumber),
      revision: revisionToken(existing.revision),
      state: existing.state,
      title: existing.title,
      notes: existing.planNotes,
      days: existing.content.days.map((day) => Object.freeze({ publicId: publicId(day.publicId), label: day.label, dayIndex: day.dayIndex, sortOrder: sortOrder(day.sortOrder) })),
      meals,
      planNotes: existing.content.notes.map((note) => Object.freeze({ publicId: publicId(note.publicId), mealPublicId: note.mealPublicId ? publicId(note.mealPublicId) : null, kind: note.kind, content: note.content, sortOrder: sortOrder(note.sortOrder) })),
    });
    try {
      draft.requestReview(revisionToken(existing.revision));
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("NUTRIFLOW_PLAN_REVIEW_BLOCKED")) {
        throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.INVALID_INPUT, "O plano precisa ter alimentos em todas as refeições.", 400);
      }
      throw error;
    }
    const snapshot = draft.createSnapshot();
    const contentHash = await this.hashJson(snapshot);
    const publicationPublicId = publicId(this.generatePublicId("publication"));
    const occurredAt = now.toISOString();
    const eventContext: DomainEventContext = {
      eventId: publicId(this.generatePublicId("event")),
      occurredAt,
      actor: { authUserId: input.actor.authUserId, role: input.actor.role },
      correlationId: input.command.correlationId,
      metadata: { organizationPublicId: input.organizationPublicId, environment: this.environment, source: "nutriflow-admin" },
    };
    draft.confirmPublication({ expectedRevision: draft.revision, publicationPublicId, contentHash, event: eventContext });
    const [event] = draft.pullDomainEvents();
    await this.store.publish({
      organizationId: input.organizationId,
      clientId: input.clientId,
      planPublicId: existing.planPublicId,
      planVersionPublicId: existing.publicId,
      publicationPublicId,
      expectedRevision: existing.revision,
      finalRevision: draft.revision,
      snapshotJson: JSON.stringify(snapshot),
      contentHash,
      actorAuthUserId: input.actor.authUserId,
      audit: {
        publicId: publicId(this.generatePublicId("audit")), actorAuthUserId: input.actor.authUserId, actorRole: input.actor.role,
        action: "plan.version.published", entityType: "food-plan", entityPublicId: existing.planPublicId,
        correlationId: input.command.correlationId, beforeJson: JSON.stringify({ state: "draft", revision: existing.revision }),
        afterJson: JSON.stringify({ state: "published", revision: draft.revision, publicationPublicId, contentHash }), occurredAt,
      },
      event,
      publishedAt: occurredAt,
    });
    return Object.freeze({
      apiVersion: NUTRIFLOW_API_VERSION,
      publicationPublicId,
      planPublicId: existing.planPublicId,
      planVersionPublicId: existing.publicId,
      clientId: input.clientId,
      versionNumber: existing.versionNumber,
      contentHash,
      publishedAt: occurredAt,
      content: existing.content,
    });
  }
}
