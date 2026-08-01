import { NUTRIFLOW_ERROR_CODES } from "../../contracts/v1/errors.ts";
import { NutriFlowApplicationError } from "../../application/errors/nutriflow-application-error.ts";
import type { FoodPlanDraftStore, SaveFoodPlanDraftRecord } from "../../application/ports/food-plan-repository.ts";
import { serializeDomainEventForOutbox } from "../outbox/serialize-domain-event.ts";
import type { D1DatabaseLike, D1PreparedStatementLike } from "./d1-unit-of-work.ts";

function changes(result: unknown): number {
  if (!result || typeof result !== "object") return 0;
  const value = result as { changes?: number; meta?: { changes?: number } };
  return Number(value.meta?.changes ?? value.changes ?? 0);
}

export class D1FoodPlanDraftStore implements FoodPlanDraftStore {
  private readonly database: D1DatabaseLike;
  constructor(database: D1DatabaseLike) { this.database = database; }

  async save(record: SaveFoodPlanDraftRecord): Promise<void> {
    const statements: D1PreparedStatementLike[] = [];
    const scoped = "SELECT version.id FROM nf_plan_versions AS version INNER JOIN nf_plans AS plan ON plan.id = version.plan_id WHERE version.public_id = ? AND plan.public_id = ? AND plan.organization_id = ? AND plan.client_id = ? AND version.revision = ? AND version.state = 'draft'";
    const scope = [record.planVersionPublicId, record.planPublicId, record.organizationId, record.clientId, record.nextRevision] as const;
    statements.push(this.database.prepare(
      "UPDATE nf_plan_versions SET revision = ?, title = ?, notes = ?, updated_at = ? WHERE public_id = ? AND revision = ? AND state = 'draft' AND plan_id = (SELECT id FROM nf_plans WHERE public_id = ? AND organization_id = ? AND client_id = ?)",
    ).bind(record.nextRevision, record.title, record.planNotes, record.updatedAt, record.planVersionPublicId, record.expectedRevision, record.planPublicId, record.organizationId, record.clientId));
    statements.push(this.database.prepare(`UPDATE nf_plans SET title = ?, updated_at = ? WHERE public_id = ? AND organization_id = ? AND client_id = ? AND EXISTS (${scoped})`).bind(record.title, record.updatedAt, record.planPublicId, record.organizationId, record.clientId, ...scope));
    statements.push(this.database.prepare(`DELETE FROM nf_meal_items WHERE meal_id IN (SELECT id FROM nf_meals WHERE plan_version_id = (${scoped}))`).bind(...scope));
    statements.push(this.database.prepare(`DELETE FROM nf_plan_notes WHERE plan_version_id = (${scoped})`).bind(...scope));
    statements.push(this.database.prepare(`DELETE FROM nf_meals WHERE plan_version_id = (${scoped})`).bind(...scope));
    statements.push(this.database.prepare(`DELETE FROM nf_plan_days WHERE plan_version_id = (${scoped})`).bind(...scope));

    for (const day of record.content.days) statements.push(this.database.prepare(
      `INSERT INTO nf_plan_days (public_id, plan_version_id, label, day_index, sort_order, created_at, updated_at) SELECT ?, id, ?, ?, ?, ?, ? FROM nf_plan_versions WHERE id = (${scoped})`,
    ).bind(day.publicId, day.label, day.dayIndex, day.sortOrder, record.updatedAt, record.updatedAt, ...scope));
    for (const meal of record.content.meals) {
      statements.push(this.database.prepare(
        `INSERT INTO nf_meals (public_id, plan_version_id, plan_day_id, title, scheduled_time, instructions, source_template_public_id, source_template_version_number, sort_order, created_at, updated_at) SELECT ?, version.id, (SELECT id FROM nf_plan_days WHERE public_id = ? AND plan_version_id = version.id), ?, ?, ?, ?, ?, ?, ?, ? FROM nf_plan_versions AS version WHERE version.id = (${scoped})`,
      ).bind(meal.publicId, meal.planDayPublicId, meal.title, meal.scheduledTime, meal.instructions, meal.sourceTemplate?.publicId ?? null, meal.sourceTemplate?.versionNumber ?? null, meal.sortOrder, record.updatedAt, record.updatedAt, ...scope));
      for (const item of meal.items) statements.push(this.database.prepare(
        `INSERT INTO nf_meal_items (public_id, meal_id, source_type, source_public_id, source_revision_number, display_name_snapshot, quantity_milli, unit_id, unit_code_snapshot, unit_label_snapshot, preparation, notes, sort_order, created_at, updated_at) SELECT ?, meal.id, ?, ?, ?, ?, ?, (SELECT id FROM nf_units WHERE public_id = ? AND status = 'active'), ?, ?, ?, ?, ?, ?, ? FROM nf_meals AS meal WHERE meal.public_id = ? AND meal.plan_version_id = (${scoped})`,
      ).bind(item.publicId, item.source.type, item.source.publicId, item.source.revisionNumber, item.displayName, item.quantityMilli, item.unit.publicId, item.unit.code, item.unit.label, item.preparation, item.notes, item.sortOrder, record.updatedAt, record.updatedAt, meal.publicId, ...scope));
    }
    for (const note of record.content.notes) statements.push(this.database.prepare(
      `INSERT INTO nf_plan_notes (public_id, plan_version_id, meal_id, kind, content, sort_order, created_at, updated_at) SELECT ?, version.id, (SELECT id FROM nf_meals WHERE public_id = ? AND plan_version_id = version.id), ?, ?, ?, ?, ? FROM nf_plan_versions AS version WHERE version.id = (${scoped})`,
    ).bind(note.publicId, note.mealPublicId, note.kind, note.content, note.sortOrder, record.updatedAt, record.updatedAt, ...scope));

    const audit = record.audit;
    statements.push(this.database.prepare(`INSERT INTO nf_audit_entries (public_id, organization_id, actor_auth_user_id, actor_role, action, entity_type, entity_public_id, correlation_id, before_json, after_json, occurred_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (${scoped})`).bind(audit.publicId, record.organizationId, audit.actorAuthUserId, audit.actorRole, audit.action, audit.entityType, audit.entityPublicId, audit.correlationId, audit.beforeJson, audit.afterJson, audit.occurredAt, ...scope));
    const event = serializeDomainEventForOutbox(record.event);
    statements.push(this.database.prepare(`INSERT INTO nf_outbox_events (event_id, organization_id, event_type, event_version, aggregate_type, aggregate_public_id, aggregate_version, actor_auth_user_id, correlation_id, causation_id, occurred_at, payload_json, metadata_json, status, attempts, available_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (${scoped})`).bind(event.eventId, record.organizationId, event.eventType, event.eventVersion, event.aggregateType, event.aggregatePublicId, event.aggregateVersion, event.actorAuthUserId, event.correlationId, event.causationId, event.occurredAt, event.payloadJson, event.metadataJson, event.status, event.attempts, event.availableAt, ...scope));

    const results = await this.database.batch(statements);
    if (changes(results[0]) !== 1) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.VERSION_CONFLICT, "O rascunho foi alterado em outra sessão.", 409);
  }
}
