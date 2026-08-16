import type {
  ClaimedOutboxEvent,
  EventConsumptionClaim,
  EventConsumptionRepository,
  OutboxRepository,
} from "../../application/ports/outbox-repository.ts";
import {
  createDomainEvent,
  type DomainEventMetadata,
  type DomainEventPayload,
} from "../../domain/events/domain-event.ts";
import type { D1OperationDatabaseLike } from "./d1-operation-database.ts";

type OutboxRow = Readonly<{
  event_id: string;
  event_type: string;
  event_version: number;
  aggregate_type: string;
  aggregate_public_id: string;
  aggregate_version: number;
  actor_auth_user_id: string;
  correlation_id: string;
  causation_id: string | null;
  occurred_at: string;
  payload_json: string;
  metadata_json: string;
  attempts: number;
}>;

export class D1OutboxRepository implements OutboxRepository {
  private readonly database: D1OperationDatabaseLike;
  private readonly prioritizedEventTypes: readonly string[];
  constructor(
    database: D1OperationDatabaseLike,
    prioritizedEventTypes: readonly string[] = [],
  ) {
    this.database = database;
    this.prioritizedEventTypes = Object.freeze([
      ...new Set(prioritizedEventTypes.filter(Boolean)),
    ]);
  }

  async claimNext(input: Parameters<OutboxRepository["claimNext"]>[0]) {
    const priorityPlaceholders = this.prioritizedEventTypes
      .map(() => "?")
      .join(", ");
    const priorityOrder = priorityPlaceholders
      ? `CASE WHEN event_type IN (${priorityPlaceholders}) THEN 0 ELSE 1 END, `
      : "";
    const row = await this.database
      .prepare(
        `UPDATE nf_outbox_events SET status = 'processing', attempts = attempts + 1, processing_started_at = ?, lease_token = ?, last_error = NULL WHERE id = (SELECT id FROM nf_outbox_events WHERE ((status IN ('pending', 'retry') AND available_at <= ?) OR (status = 'processing' AND processing_started_at < ?)) AND json_valid(payload_json) AND json_type(payload_json) = 'object' AND json_valid(metadata_json) AND json_type(metadata_json) = 'object' AND json_type(metadata_json, '$.organizationPublicId') = 'text' AND json_type(metadata_json, '$.environment') = 'text' AND json_type(metadata_json, '$.source') = 'text' ORDER BY ${priorityOrder}available_at, id LIMIT 1) RETURNING event_id, event_type, event_version, aggregate_type, aggregate_public_id, aggregate_version, actor_auth_user_id, correlation_id, causation_id, occurred_at, payload_json, metadata_json, attempts`,
      )
      .bind(
        input.now,
        input.leaseToken,
        input.now,
        input.staleBefore,
        ...this.prioritizedEventTypes,
      )
      .first<OutboxRow>();
    if (!row) return null;
    return Object.freeze({
      event: hydrateEvent(row),
      leaseToken: input.leaseToken,
      attempts: row.attempts,
    }) satisfies ClaimedOutboxEvent;
  }

  async markProcessed(input: Parameters<OutboxRepository["markProcessed"]>[0]) {
    await this.finish(
      "UPDATE nf_outbox_events SET status = 'processed', processed_at = ?, processing_started_at = NULL, lease_token = NULL, last_error = NULL WHERE event_id = ? AND status = 'processing' AND lease_token = ?",
      [input.processedAt, input.eventId, input.leaseToken],
      "PROCESS",
    );
  }

  async scheduleRetry(input: Parameters<OutboxRepository["scheduleRetry"]>[0]) {
    await this.finish(
      "UPDATE nf_outbox_events SET status = 'retry', available_at = ?, processing_started_at = NULL, lease_token = NULL, last_error = ? WHERE event_id = ? AND status = 'processing' AND lease_token = ?",
      [input.availableAt, input.safeErrorCode, input.eventId, input.leaseToken],
      "RETRY",
    );
  }

  async markDeadLetter(input: Parameters<OutboxRepository["markDeadLetter"]>[0]) {
    await this.finish(
      "UPDATE nf_outbox_events SET status = 'dead_letter', processed_at = ?, processing_started_at = NULL, lease_token = NULL, last_error = ? WHERE event_id = ? AND status = 'processing' AND lease_token = ?",
      [input.failedAt, input.safeErrorCode, input.eventId, input.leaseToken],
      "DEAD_LETTER",
    );
  }

  private async finish(query: string, values: unknown[], action: string) {
    const result = await this.database.prepare(query).bind(...values).run();
    if ((result.meta?.changes ?? 0) !== 1) {
      throw new Error(`NUTRIFLOW_OUTBOX_${action}_LEASE_CONFLICT`);
    }
  }
}

type ConsumptionRow = Readonly<{
  status: "processing" | "processed" | "failed";
  processing_started_at: string | null;
}>;

export class D1EventConsumptionRepository implements EventConsumptionRepository {
  private readonly database: D1OperationDatabaseLike;
  constructor(database: D1OperationDatabaseLike) {
    this.database = database;
  }

  async claim(input: Parameters<EventConsumptionRepository["claim"]>[0]): Promise<EventConsumptionClaim> {
    const inserted = await this.database
      .prepare(
        "INSERT INTO nf_event_consumptions (event_id, consumer_name, status, attempts, available_at, processing_started_at, lease_token, created_at, updated_at) VALUES (?, ?, 'processing', 1, ?, ?, ?, ?, ?) ON CONFLICT (event_id, consumer_name) DO NOTHING",
      )
      .bind(
        input.eventId,
        input.consumerName,
        input.now,
        input.now,
        input.leaseToken,
        input.now,
        input.now,
      )
      .run();
    if ((inserted.meta?.changes ?? 0) === 1) return "acquired";

    const row = await this.database
      .prepare(
        "SELECT status, processing_started_at FROM nf_event_consumptions WHERE event_id = ? AND consumer_name = ?",
      )
      .bind(input.eventId, input.consumerName)
      .first<ConsumptionRow>();
    if (!row) throw new Error("NUTRIFLOW_EVENT_CONSUMPTION_MISSING");
    if (row.status === "processed") return "already-processed";

    const reclaimed = await this.database
      .prepare(
        "UPDATE nf_event_consumptions SET status = 'processing', attempts = attempts + 1, processing_started_at = ?, lease_token = ?, last_error = NULL, updated_at = ? WHERE event_id = ? AND consumer_name = ? AND ((status = 'failed' AND available_at <= ?) OR (status = 'processing' AND processing_started_at < ?))",
      )
      .bind(
        input.now,
        input.leaseToken,
        input.now,
        input.eventId,
        input.consumerName,
        input.now,
        input.staleBefore,
      )
      .run();
    return (reclaimed.meta?.changes ?? 0) === 1 ? "acquired" : "busy";
  }

  async complete(input: Parameters<EventConsumptionRepository["complete"]>[0]) {
    await this.finish(
      "UPDATE nf_event_consumptions SET status = 'processed', processed_at = ?, processing_started_at = NULL, lease_token = NULL, last_error = NULL, updated_at = ? WHERE event_id = ? AND consumer_name = ? AND status = 'processing' AND lease_token = ?",
      [
        input.processedAt,
        input.processedAt,
        input.eventId,
        input.consumerName,
        input.leaseToken,
      ],
    );
  }

  async fail(input: Parameters<EventConsumptionRepository["fail"]>[0]) {
    await this.finish(
      "UPDATE nf_event_consumptions SET status = 'failed', available_at = ?, processing_started_at = NULL, lease_token = NULL, last_error = ?, updated_at = ? WHERE event_id = ? AND consumer_name = ? AND status = 'processing' AND lease_token = ?",
      [
        input.availableAt,
        input.safeErrorCode,
        input.failedAt,
        input.eventId,
        input.consumerName,
        input.leaseToken,
      ],
    );
  }

  private async finish(query: string, values: unknown[]) {
    const result = await this.database.prepare(query).bind(...values).run();
    if ((result.meta?.changes ?? 0) !== 1) {
      throw new Error("NUTRIFLOW_EVENT_CONSUMPTION_LEASE_CONFLICT");
    }
  }
}

function hydrateEvent(row: OutboxRow) {
  const payload = parseObject(row.payload_json, "payload") as DomainEventPayload;
  const metadata = parseObject(row.metadata_json, "metadata");
  if (
    typeof metadata.organizationPublicId !== "string" ||
    typeof metadata.environment !== "string" ||
    typeof metadata.source !== "string"
  ) {
    throw new Error("NUTRIFLOW_INVALID_OUTBOX_EVENT:metadata");
  }
  return createDomainEvent({
    eventId: row.event_id,
    eventType: row.event_type,
    eventVersion: row.event_version,
    aggregateType: row.aggregate_type,
    aggregatePublicId: row.aggregate_public_id,
    aggregateVersion: row.aggregate_version,
    occurredAt: row.occurred_at,
    actor: {
      authUserId: row.actor_auth_user_id,
      role: typeof metadata.actorRole === "string" ? metadata.actorRole : "system",
    },
    correlationId: row.correlation_id,
    causationId: row.causation_id ?? undefined,
    payload,
    metadata: metadata as DomainEventMetadata,
  });
}

function parseObject(value: string, field: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`NUTRIFLOW_INVALID_OUTBOX_EVENT:${field}`);
  }
  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`NUTRIFLOW_INVALID_OUTBOX_EVENT:${field}`);
  }
  return parsed as Record<string, unknown>;
}
