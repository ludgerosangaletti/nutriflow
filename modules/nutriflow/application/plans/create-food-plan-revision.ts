import { NUTRIFLOW_API_VERSION, NUTRIFLOW_ERROR_CODES } from "../../contracts/v1/errors.ts";
import type { FoodPlanDraftV1 } from "../../contracts/v1/plans.ts";
import { createDomainEvent } from "../../domain/events/domain-event.ts";
import { NutriFlowApplicationError } from "../errors/nutriflow-application-error.ts";
import type { FoodPlanReadRepository } from "../ports/food-plan-repository.ts";
import type { NutriFlowUnitOfWork } from "../ports/unit-of-work.ts";
import { assertNutriFlowAuthorized, NUTRIFLOW_ACTIONS, type NutriFlowActor } from "../security/authorization.ts";

export class CreateFoodPlanRevision {
  private readonly dependencies: Readonly<{ plans: FoodPlanReadRepository; unitOfWork: NutriFlowUnitOfWork; generatePublicId: (kind: string) => string; environment: "development" | "test" | "production"; clock?: () => Date }>;
  constructor(dependencies: Readonly<{ plans: FoodPlanReadRepository; unitOfWork: NutriFlowUnitOfWork; generatePublicId: (kind: string) => string; environment: "development" | "test" | "production"; clock?: () => Date }>) { this.dependencies = dependencies; }

  async execute(input: Readonly<{ actor: NutriFlowActor; organizationId: number; organizationPublicId: string; clientId: number; correlationId: string }>): Promise<FoodPlanDraftV1> {
    const now = (this.dependencies.clock ?? (() => new Date()))();
    assertNutriFlowAuthorized(input.actor, NUTRIFLOW_ACTIONS.CREATE_PLAN, { organizationPublicId: input.organizationPublicId, clientId: input.clientId }, now);
    if (input.actor.kind !== "staff") throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "Acesso não autorizado.", 403);
    const existingDraft = await this.dependencies.plans.findLatestDraft({ organizationId: input.organizationId, clientId: input.clientId });
    if (existingDraft) return existingDraft;
    const published = await this.dependencies.plans.findLatestPublished({ organizationId: input.organizationId, clientId: input.clientId });
    if (!published) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.NOT_FOUND, "Não há versão publicada para revisar.", 404);
    const occurredAt = now.toISOString();
    const versionPublicId = this.dependencies.generatePublicId("version");
    const dayIds = new Map(published.content.days.map((day) => [day.publicId, this.dependencies.generatePublicId("day")]));
    const mealIds = new Map(published.content.meals.map((meal) => [meal.publicId, this.dependencies.generatePublicId("meal")]));
    const content = Object.freeze({
      schemaVersion: 1 as const,
      days: Object.freeze(published.content.days.map((day) => Object.freeze({ ...day, publicId: dayIds.get(day.publicId)! }))),
      meals: Object.freeze(published.content.meals.map((meal) => Object.freeze({ ...meal, publicId: mealIds.get(meal.publicId)!, planDayPublicId: meal.planDayPublicId ? dayIds.get(meal.planDayPublicId) ?? null : null, items: Object.freeze(meal.items.map((item) => Object.freeze({ ...item, publicId: this.dependencies.generatePublicId("item") }))) }))),
      notes: Object.freeze(published.content.notes.map((note) => Object.freeze({ ...note, publicId: this.dependencies.generatePublicId("note"), mealPublicId: note.mealPublicId ? mealIds.get(note.mealPublicId) ?? null : null }))),
    });
    const nextVersion = published.versionNumber + 1;
    const event = createDomainEvent({ eventId: this.dependencies.generatePublicId("event"), eventType: "nutriflow.food-plan.revision-created", eventVersion: 1, aggregateType: "food-plan", aggregatePublicId: published.planPublicId, aggregateVersion: nextVersion, occurredAt, actor: { authUserId: input.actor.authUserId, role: input.actor.role }, correlationId: input.correlationId, payload: { clientId: input.clientId, sourceVersionNumber: published.versionNumber, planVersionPublicId: versionPublicId }, metadata: { organizationPublicId: input.organizationPublicId, environment: this.dependencies.environment, source: "nutriflow-admin" } });
    await this.dependencies.unitOfWork.run(async (transaction) => {
      transaction.plans.insertPlanVersion({ publicId: versionPublicId, planPublicId: published.planPublicId, versionNumber: nextVersion, revision: 1, schemaVersion: 1, state: "draft", title: published.title, notes: published.planNotes, snapshotJson: null, contentHash: null, createdByAuthUserId: input.actor.authUserId, publishedByAuthUserId: null, publishedAt: null, createdAt: occurredAt });
      for (const day of content.days) transaction.plans.insertPlanDay({ publicId: day.publicId, planVersionPublicId: versionPublicId, label: day.label, dayIndex: day.dayIndex, sortOrder: day.sortOrder, createdAt: occurredAt });
      for (const meal of content.meals) {
        transaction.plans.insertMeal({ publicId: meal.publicId, planVersionPublicId: versionPublicId, planDayPublicId: meal.planDayPublicId, title: meal.title, scheduledTime: meal.scheduledTime, instructions: meal.instructions, sourceTemplatePublicId: meal.sourceTemplate?.publicId ?? null, sourceTemplateVersionNumber: meal.sourceTemplate?.versionNumber ?? null, sortOrder: meal.sortOrder, createdAt: occurredAt });
        for (const item of meal.items) transaction.plans.insertMealItem({ publicId: item.publicId, mealPublicId: meal.publicId, sourceType: item.source.type, sourcePublicId: item.source.publicId, sourceRevisionNumber: item.source.revisionNumber, displayNameSnapshot: item.displayName, quantityMilli: item.quantityMilli, unitPublicId: item.unit.publicId, unitCodeSnapshot: item.unit.code, unitLabelSnapshot: item.unit.label, preparation: item.preparation, notes: item.notes, sortOrder: item.sortOrder, createdAt: occurredAt });
      }
      for (const note of content.notes) transaction.plans.insertPlanNote({ publicId: note.publicId, planVersionPublicId: versionPublicId, mealPublicId: note.mealPublicId, kind: note.kind, content: note.content, sortOrder: note.sortOrder, createdAt: occurredAt });
      transaction.audit.append({ publicId: this.dependencies.generatePublicId("audit"), actorAuthUserId: input.actor.authUserId, actorRole: input.actor.role, action: "plan.revision.created", entityType: "food-plan", entityPublicId: published.planPublicId, correlationId: input.correlationId, beforeJson: JSON.stringify({ publishedVersion: published.versionNumber }), afterJson: JSON.stringify({ draftVersion: nextVersion }), occurredAt });
      transaction.enqueueDomainEvents([event]);
    });
    return Object.freeze({ apiVersion: NUTRIFLOW_API_VERSION, publicId: versionPublicId, planPublicId: published.planPublicId, clientId: input.clientId, versionNumber: nextVersion, revision: 1, state: "draft", title: published.title, planNotes: published.planNotes, content, updatedAt: occurredAt });
  }
}
