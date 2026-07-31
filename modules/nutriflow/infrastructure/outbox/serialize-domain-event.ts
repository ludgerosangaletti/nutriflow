import type { DomainEvent } from "../../domain/events/domain-event.ts";

export type SerializedOutboxEvent = Readonly<{
  eventId: string;
  eventType: string;
  eventVersion: number;
  aggregateType: string;
  aggregatePublicId: string;
  aggregateVersion: number;
  actorAuthUserId: string;
  correlationId: string;
  causationId: string | null;
  occurredAt: string;
  payloadJson: string;
  metadataJson: string;
  status: "pending";
  attempts: 0;
  availableAt: string;
}>;

export function serializeDomainEventForOutbox(
  event: DomainEvent,
): SerializedOutboxEvent {
  return Object.freeze({
    eventId: event.eventId,
    eventType: event.eventType,
    eventVersion: event.eventVersion,
    aggregateType: event.aggregateType,
    aggregatePublicId: event.aggregatePublicId,
    aggregateVersion: event.aggregateVersion,
    actorAuthUserId: event.actor.authUserId,
    correlationId: event.correlationId,
    causationId: event.causationId ?? null,
    occurredAt: event.occurredAt,
    payloadJson: JSON.stringify(event.payload),
    metadataJson: JSON.stringify(event.metadata),
    status: "pending",
    attempts: 0,
    availableAt: event.occurredAt,
  });
}
