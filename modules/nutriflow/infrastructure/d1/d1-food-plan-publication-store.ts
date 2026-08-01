import { NUTRIFLOW_ERROR_CODES } from "../../contracts/v1/errors.ts";
import { NutriFlowApplicationError } from "../../application/errors/nutriflow-application-error.ts";
import type { FoodPlanPublicationStore, PublishFoodPlanRecord } from "../../application/ports/food-plan-publication-store.ts";
import { serializeDomainEventForOutbox } from "../outbox/serialize-domain-event.ts";
import type { D1DatabaseLike, D1PreparedStatementLike } from "./d1-unit-of-work.ts";

function changes(result: unknown): number {
  if (!result || typeof result !== "object") return 0;
  const value = result as { changes?: number; meta?: { changes?: number } };
  return Number(value.meta?.changes ?? value.changes ?? 0);
}

export class D1FoodPlanPublicationStore implements FoodPlanPublicationStore {
  private readonly database: D1DatabaseLike;
  constructor(database: D1DatabaseLike) { this.database = database; }

  async publish(record: PublishFoodPlanRecord) {
    const statements: D1PreparedStatementLike[] = [];
    const scoped = "SELECT version.id FROM nf_plan_versions AS version INNER JOIN nf_plans AS plan ON plan.id = version.plan_id WHERE version.public_id = ? AND plan.public_id = ? AND plan.organization_id = ? AND plan.client_id = ? AND version.revision = ? AND version.state = 'published'";
    const scope = [record.planVersionPublicId, record.planPublicId, record.organizationId, record.clientId, record.finalRevision] as const;
    statements.push(this.database.prepare(`UPDATE nf_plan_versions SET revision = ?, state = 'published', snapshot_json = ?, content_hash = ?, published_by_auth_user_id = ?, published_at = ?, updated_at = ? WHERE public_id = ? AND revision = ? AND state = 'draft' AND plan_id = (SELECT id FROM nf_plans WHERE public_id = ? AND organization_id = ? AND client_id = ?)`)
      .bind(record.finalRevision, record.snapshotJson, record.contentHash, record.actorAuthUserId, record.publishedAt, record.publishedAt, record.planVersionPublicId, record.expectedRevision, record.planPublicId, record.organizationId, record.clientId));
    statements.push(this.database.prepare(`UPDATE nf_plans SET status = 'published', updated_at = ? WHERE public_id = ? AND organization_id = ? AND client_id = ? AND EXISTS (${scoped})`).bind(record.publishedAt, record.planPublicId, record.organizationId, record.clientId, ...scope));
    statements.push(this.database.prepare(`UPDATE nf_publications SET status = 'revoked', revoked_by_auth_user_id = ?, revoked_at = ?, revocation_reason = 'Substituída por nova versão publicada' WHERE organization_id = ? AND client_id = ? AND plan_id = (SELECT id FROM nf_plans WHERE public_id = ?) AND status = 'active' AND EXISTS (${scoped})`).bind(record.actorAuthUserId, record.publishedAt, record.organizationId, record.clientId, record.planPublicId, ...scope));
    statements.push(this.database.prepare(`INSERT INTO nf_publications (public_id, organization_id, client_id, plan_id, plan_version_id, status, published_by_auth_user_id, published_at) SELECT ?, ?, ?, plan.id, version.id, 'active', ?, ? FROM nf_plans AS plan INNER JOIN nf_plan_versions AS version ON version.plan_id = plan.id WHERE version.id = (${scoped})`).bind(record.publicationPublicId, record.organizationId, record.clientId, record.actorAuthUserId, record.publishedAt, ...scope));
    const audit = record.audit;
    statements.push(this.database.prepare(`INSERT INTO nf_audit_entries (public_id, organization_id, actor_auth_user_id, actor_role, action, entity_type, entity_public_id, correlation_id, before_json, after_json, occurred_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (${scoped})`).bind(audit.publicId, record.organizationId, audit.actorAuthUserId, audit.actorRole, audit.action, audit.entityType, audit.entityPublicId, audit.correlationId, audit.beforeJson, audit.afterJson, audit.occurredAt, ...scope));
    const event = serializeDomainEventForOutbox(record.event);
    statements.push(this.database.prepare(`INSERT INTO nf_outbox_events (event_id, organization_id, event_type, event_version, aggregate_type, aggregate_public_id, aggregate_version, actor_auth_user_id, correlation_id, causation_id, occurred_at, payload_json, metadata_json, status, attempts, available_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (${scoped})`).bind(event.eventId, record.organizationId, event.eventType, event.eventVersion, event.aggregateType, event.aggregatePublicId, event.aggregateVersion, event.actorAuthUserId, event.correlationId, event.causationId, event.occurredAt, event.payloadJson, event.metadataJson, event.status, event.attempts, event.availableAt, ...scope));
    const results = await this.database.batch(statements);
    if (changes(results[0]) !== 1) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.VERSION_CONFLICT, "O rascunho foi alterado em outra sessão.", 409);
  }
}
