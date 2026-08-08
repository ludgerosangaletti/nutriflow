import { NUTRIFLOW_API_VERSION, NUTRIFLOW_ERROR_CODES } from "../../contracts/v1/errors.ts";
import type { FoodPlanDraftV1, SaveFoodPlanDraftCommandV1 } from "../../contracts/v1/plans.ts";
import { FoodPlanDraft } from "../../domain/plans/food-plan-draft.ts";
import { publicId, quantityMilli, revisionToken, sortOrder, unitCode, versionNumber } from "../../domain/shared/value-objects.ts";
import { NutriFlowApplicationError } from "../errors/nutriflow-application-error.ts";
import type { FoodPlanDraftStore, FoodPlanReadRepository } from "../ports/food-plan-repository.ts";
import { assertNutriFlowAuthorized, NUTRIFLOW_ACTIONS, type NutriFlowActor } from "../security/authorization.ts";

type IdentifierKind = "event" | "audit";

export class SaveFoodPlanDraft {
  private readonly dependencies: Readonly<{
    plans: FoodPlanReadRepository;
    store: FoodPlanDraftStore;
    generatePublicId: (kind: IdentifierKind) => string;
    clock?: () => Date;
    environment?: "development" | "test" | "production";
  }>;
  private readonly clock: () => Date;
  private readonly environment: "development" | "test" | "production";
  constructor(dependencies: Readonly<{
    plans: FoodPlanReadRepository;
    store: FoodPlanDraftStore;
    generatePublicId: (kind: IdentifierKind) => string;
    clock?: () => Date;
    environment?: "development" | "test" | "production";
  }>) {
    this.dependencies = dependencies;
    this.clock = dependencies.clock ?? (() => new Date());
    this.environment = dependencies.environment ?? "production";
  }

  async execute(input: Readonly<{ actor: NutriFlowActor; organizationId: number; organizationPublicId: string; clientId: number; command: SaveFoodPlanDraftCommandV1 }>): Promise<FoodPlanDraftV1> {
    const now = this.clock();
    assertNutriFlowAuthorized(input.actor, NUTRIFLOW_ACTIONS.UPDATE_DRAFT, { organizationPublicId: input.organizationPublicId, clientId: input.clientId }, now);
    if (input.actor.kind !== "staff") throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "Acesso não autorizado.", 403);
    const existing = await this.dependencies.plans.findDraftByVersion({ organizationId: input.organizationId, clientId: input.clientId, planVersionPublicId: input.command.planVersionPublicId });
    if (!existing || existing.planPublicId !== input.command.planPublicId) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.NOT_FOUND, "Recurso não encontrado.", 404);
    if (existing.revision !== input.command.expectedRevision) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.VERSION_CONFLICT, "O rascunho foi alterado em outra sessão.", 409);
    const days = input.command.content.days.map((day) => Object.freeze({ publicId: publicId(day.publicId), label: day.label, dayIndex: day.dayIndex, sortOrder: sortOrder(day.sortOrder) }));
    const meals = input.command.content.meals.map((meal) => Object.freeze({
      publicId: publicId(meal.publicId), planDayPublicId: meal.planDayPublicId ? publicId(meal.planDayPublicId) : null, title: meal.title, scheduledTime: meal.scheduledTime, instructions: meal.instructions, sourceTemplatePublicId: meal.sourceTemplate ? publicId(meal.sourceTemplate.publicId) : null, sourceTemplateVersionNumber: meal.sourceTemplate ? versionNumber(meal.sourceTemplate.versionNumber) : null, sortOrder: sortOrder(meal.sortOrder),
      items: Object.freeze(meal.items.map((item) => Object.freeze({ publicId: publicId(item.publicId), source: Object.freeze({ type: item.source.type, publicId: item.source.publicId ? publicId(item.source.publicId) : null, revisionNumber: item.source.revisionNumber ? versionNumber(item.source.revisionNumber) : null }), displayName: item.displayName, quantityMilli: quantityMilli(item.quantityMilli), unitPublicId: publicId(item.unit.publicId), unitCode: unitCode(item.unit.code), unitLabel: item.unit.label, preparation: item.preparation, notes: item.notes, macros: item.macros ?? null, sortOrder: sortOrder(item.sortOrder) }))), substitutions: Object.freeze(meal.substitutions ?? []), macros: meal.macros ?? null,
    }));
    const notes = input.command.content.notes.map((note) => Object.freeze({ publicId: publicId(note.publicId), mealPublicId: note.mealPublicId ? publicId(note.mealPublicId) : null, kind: note.kind, content: note.content, sortOrder: sortOrder(note.sortOrder) }));
    const draft = FoodPlanDraft.rehydrate({ organizationPublicId: publicId(input.organizationPublicId), clientId: input.clientId, planPublicId: publicId(existing.planPublicId), planVersionPublicId: publicId(existing.publicId), versionNumber: versionNumber(existing.versionNumber), revision: revisionToken(existing.revision), state: existing.state, title: existing.title, notes: existing.planNotes, days: existing.content.days.map((day) => ({ ...day, publicId: publicId(day.publicId), sortOrder: sortOrder(day.sortOrder) })), meals: [], planNotes: [] });
    const occurredAt = now.toISOString();
    draft.replaceContent({ expectedRevision: revisionToken(input.command.expectedRevision), title: input.command.title, notes: input.command.planNotes, days, meals, planNotes: notes, event: { eventId: publicId(this.dependencies.generatePublicId("event")), occurredAt, actor: { authUserId: input.actor.authUserId, role: input.actor.role }, correlationId: input.command.correlationId, metadata: { organizationPublicId: input.organizationPublicId, environment: this.environment, source: "nutriflow-admin" } } });
    const [event] = draft.pullDomainEvents();
    await this.dependencies.store.save({ organizationId: input.organizationId, organizationPublicId: input.organizationPublicId, clientId: input.clientId, planPublicId: existing.planPublicId, planVersionPublicId: existing.publicId, expectedRevision: input.command.expectedRevision, nextRevision: draft.revision, title: input.command.title.trim(), planNotes: input.command.planNotes?.trim() || null, content: input.command.content, audit: { publicId: publicId(this.dependencies.generatePublicId("audit")), actorAuthUserId: input.actor.authUserId, actorRole: input.actor.role, action: "plan.draft.saved", entityType: "food-plan", entityPublicId: existing.planPublicId, correlationId: input.command.correlationId, beforeJson: JSON.stringify({ revision: existing.revision }), afterJson: JSON.stringify({ revision: draft.revision }), occurredAt }, event, updatedAt: occurredAt });
    return Object.freeze({ apiVersion: NUTRIFLOW_API_VERSION, publicId: existing.publicId, planPublicId: existing.planPublicId, clientId: input.clientId, versionNumber: existing.versionNumber, revision: draft.revision, state: "draft", title: input.command.title.trim(), planNotes: input.command.planNotes?.trim() || null, content: input.command.content, updatedAt: occurredAt });
  }
}
