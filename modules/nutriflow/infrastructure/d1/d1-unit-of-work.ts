import type {
  AuditWriteRepository,
  NewAuditEntry,
} from "../../application/ports/audit-repository.ts";
import type {
  FoodPlanWriteRepository,
  NewMealItemRecord,
  NewMealRecord,
  NewPlanDayRecord,
  NewPlanNoteRecord,
  NewPlanRecord,
  NewPlanVersionRecord,
} from "../../application/ports/food-plan-repository.ts";
import type {
  NutriFlowTransaction,
  NutriFlowUnitOfWork,
} from "../../application/ports/unit-of-work.ts";
import type { DomainEvent } from "../../domain/events/domain-event.ts";
import { serializeDomainEventForOutbox } from "../outbox/serialize-domain-event.ts";

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
  batch(statements: D1PreparedStatementLike[]): Promise<unknown[]>;
}

export type D1UnitOfWorkContext = Readonly<{
  organizationId: number;
  organizationPublicId: string;
}>;

type StatementFactory = (database: D1DatabaseLike) => D1PreparedStatementLike;

class StagedPlanRepository implements FoodPlanWriteRepository {
  private readonly stage: (factory: StatementFactory) => void;
  private readonly organizationId: number;

  constructor(
    stage: (factory: StatementFactory) => void,
    organizationId: number,
  ) {
    this.stage = stage;
    this.organizationId = organizationId;
  }

  insertPlan(record: NewPlanRecord) {
    this.stage((database) =>
      database
        .prepare(
          "INSERT INTO nf_plans (public_id, organization_id, client_id, title, status, created_by_auth_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          record.publicId,
          this.organizationId,
          record.clientId,
          record.title,
          record.status,
          record.createdByAuthUserId,
          record.createdAt,
          record.createdAt,
        ),
    );
  }

  insertPlanVersion(record: NewPlanVersionRecord) {
    this.stage((database) =>
      database
        .prepare(
          "INSERT INTO nf_plan_versions (public_id, plan_id, version_number, revision, schema_version, state, title, notes, snapshot_json, content_hash, created_by_auth_user_id, published_by_auth_user_id, published_at, created_at, updated_at) VALUES (?, (SELECT id FROM nf_plans WHERE public_id = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          record.publicId,
          record.planPublicId,
          record.versionNumber,
          record.revision,
          record.schemaVersion,
          record.state,
          record.title,
          record.notes,
          record.snapshotJson,
          record.contentHash,
          record.createdByAuthUserId,
          record.publishedByAuthUserId,
          record.publishedAt,
          record.createdAt,
          record.createdAt,
        ),
    );
  }

  insertPlanDay(record: NewPlanDayRecord) {
    this.stage((database) =>
      database
        .prepare(
          "INSERT INTO nf_plan_days (public_id, plan_version_id, label, day_index, sort_order, created_at, updated_at) VALUES (?, (SELECT id FROM nf_plan_versions WHERE public_id = ?), ?, ?, ?, ?, ?)",
        )
        .bind(
          record.publicId,
          record.planVersionPublicId,
          record.label,
          record.dayIndex,
          record.sortOrder,
          record.createdAt,
          record.createdAt,
        ),
    );
  }

  insertMeal(record: NewMealRecord) {
    this.stage((database) =>
      database
        .prepare(
          "INSERT INTO nf_meals (public_id, plan_version_id, plan_day_id, title, scheduled_time, instructions, source_template_public_id, source_template_version_number, sort_order, created_at, updated_at) VALUES (?, (SELECT id FROM nf_plan_versions WHERE public_id = ?), (SELECT id FROM nf_plan_days WHERE public_id = ?), ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          record.publicId,
          record.planVersionPublicId,
          record.planDayPublicId,
          record.title,
          record.scheduledTime,
          record.instructions,
          record.sourceTemplatePublicId,
          record.sourceTemplateVersionNumber,
          record.sortOrder,
          record.createdAt,
          record.createdAt,
        ),
    );
  }

  insertMealItem(record: NewMealItemRecord) {
    this.stage((database) =>
      database
        .prepare(
          "INSERT INTO nf_meal_items (public_id, meal_id, source_type, source_public_id, source_revision_number, display_name_snapshot, quantity_milli, unit_id, unit_code_snapshot, unit_label_snapshot, preparation, notes, sort_order, created_at, updated_at) VALUES (?, (SELECT id FROM nf_meals WHERE public_id = ?), ?, ?, ?, ?, ?, (SELECT id FROM nf_units WHERE public_id = ?), ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          record.publicId,
          record.mealPublicId,
          record.sourceType,
          record.sourcePublicId,
          record.sourceRevisionNumber,
          record.displayNameSnapshot,
          record.quantityMilli,
          record.unitPublicId,
          record.unitCodeSnapshot,
          record.unitLabelSnapshot,
          record.preparation,
          record.notes,
          record.sortOrder,
          record.createdAt,
          record.createdAt,
        ),
    );
  }

  insertPlanNote(record: NewPlanNoteRecord) {
    this.stage((database) =>
      database
        .prepare(
          "INSERT INTO nf_plan_notes (public_id, plan_version_id, meal_id, kind, content, sort_order, created_at, updated_at) VALUES (?, (SELECT id FROM nf_plan_versions WHERE public_id = ?), (SELECT id FROM nf_meals WHERE public_id = ?), ?, ?, ?, ?, ?)",
        )
        .bind(
          record.publicId,
          record.planVersionPublicId,
          record.mealPublicId,
          record.kind,
          record.content,
          record.sortOrder,
          record.createdAt,
          record.createdAt,
        ),
    );
  }
}

class StagedAuditRepository implements AuditWriteRepository {
  private readonly stage: (factory: StatementFactory) => void;
  private readonly organizationId: number;

  constructor(
    stage: (factory: StatementFactory) => void,
    organizationId: number,
  ) {
    this.stage = stage;
    this.organizationId = organizationId;
  }

  append(entry: NewAuditEntry) {
    this.stage((database) =>
      database
        .prepare(
          "INSERT INTO nf_audit_entries (public_id, organization_id, actor_auth_user_id, actor_role, action, entity_type, entity_public_id, correlation_id, before_json, after_json, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          entry.publicId,
          this.organizationId,
          entry.actorAuthUserId,
          entry.actorRole,
          entry.action,
          entry.entityType,
          entry.entityPublicId,
          entry.correlationId,
          entry.beforeJson,
          entry.afterJson,
          entry.occurredAt,
        ),
    );
  }
}

export class D1NutriFlowUnitOfWork implements NutriFlowUnitOfWork {
  private readonly database: D1DatabaseLike;
  private readonly context: D1UnitOfWorkContext;

  constructor(
    database: D1DatabaseLike,
    context: D1UnitOfWorkContext,
  ) {
    this.database = database;
    this.context = context;
    if (!Number.isSafeInteger(context.organizationId) || context.organizationId < 1) {
      throw new Error("NUTRIFLOW_INVALID_UNIT_OF_WORK_CONTEXT");
    }
  }

  async run<T>(operation: (transaction: NutriFlowTransaction) => Promise<T>) {
    const factories: StatementFactory[] = [];
    const stage = (factory: StatementFactory) => factories.push(factory);
    const plans = new StagedPlanRepository(stage, this.context.organizationId);
    const audit = new StagedAuditRepository(stage, this.context.organizationId);
    const transaction: NutriFlowTransaction = {
      plans,
      audit,
      enqueueDomainEvents: (events: readonly DomainEvent[]) => {
        for (const event of events) {
          if (
            event.metadata.organizationPublicId !== this.context.organizationPublicId
          ) {
            throw new Error("NUTRIFLOW_CROSS_ORGANIZATION_EVENT");
          }
          const row = serializeDomainEventForOutbox(event);
          stage((database) =>
            database
              .prepare(
                "INSERT INTO nf_outbox_events (event_id, organization_id, event_type, event_version, aggregate_type, aggregate_public_id, aggregate_version, actor_auth_user_id, correlation_id, causation_id, occurred_at, payload_json, metadata_json, status, attempts, available_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
              )
              .bind(
                row.eventId,
                this.context.organizationId,
                row.eventType,
                row.eventVersion,
                row.aggregateType,
                row.aggregatePublicId,
                row.aggregateVersion,
                row.actorAuthUserId,
                row.correlationId,
                row.causationId,
                row.occurredAt,
                row.payloadJson,
                row.metadataJson,
                row.status,
                row.attempts,
                row.availableAt,
              ),
          );
        }
      },
    };

    const result = await operation(transaction);
    if (factories.length > 0) {
      await this.database.batch(factories.map((factory) => factory(this.database)));
    }
    return result;
  }
}
