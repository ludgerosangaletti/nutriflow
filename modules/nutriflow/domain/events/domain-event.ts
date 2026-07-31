export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | { readonly [key: string]: JsonValue }
  | readonly JsonValue[];

export type DomainEventPayload = Readonly<Record<string, JsonValue>>;

export type DomainEventActor = Readonly<{
  authUserId: string;
  role: string;
}>;

export type DomainEventMetadata = Readonly<{
  organizationPublicId: string;
  environment: string;
  source: string;
}>;

export type DomainEvent<TPayload extends DomainEventPayload = DomainEventPayload> =
  Readonly<{
    eventId: string;
    eventType: string;
    eventVersion: number;
    aggregateType: string;
    aggregatePublicId: string;
    aggregateVersion: number;
    occurredAt: string;
    actor: DomainEventActor;
    correlationId: string;
    causationId?: string;
    payload: TPayload;
    metadata: DomainEventMetadata;
  }>;

export type CreateDomainEventInput<TPayload extends DomainEventPayload> = Readonly<{
  eventId: string;
  eventType: string;
  eventVersion: number;
  aggregateType: string;
  aggregatePublicId: string;
  aggregateVersion: number;
  occurredAt: string;
  actor: DomainEventActor;
  correlationId: string;
  causationId?: string;
  payload: TPayload;
  metadata: DomainEventMetadata;
}>;

function requireNonEmpty(value: string, field: string) {
  if (value.trim().length === 0) {
    throw new Error(`NUTRIFLOW_INVALID_DOMAIN_EVENT:${field}`);
  }
}

export function createDomainEvent<TPayload extends DomainEventPayload>(
  input: CreateDomainEventInput<TPayload>,
): DomainEvent<TPayload> {
  requireNonEmpty(input.eventId, "eventId");
  requireNonEmpty(input.eventType, "eventType");
  requireNonEmpty(input.aggregateType, "aggregateType");
  requireNonEmpty(input.aggregatePublicId, "aggregatePublicId");
  requireNonEmpty(input.occurredAt, "occurredAt");
  requireNonEmpty(input.actor.authUserId, "actor.authUserId");
  requireNonEmpty(input.actor.role, "actor.role");
  requireNonEmpty(input.correlationId, "correlationId");
  requireNonEmpty(input.metadata.organizationPublicId, "metadata.organizationPublicId");
  requireNonEmpty(input.metadata.environment, "metadata.environment");
  requireNonEmpty(input.metadata.source, "metadata.source");

  if (!Number.isInteger(input.eventVersion) || input.eventVersion < 1) {
    throw new Error("NUTRIFLOW_INVALID_DOMAIN_EVENT:eventVersion");
  }

  if (!Number.isInteger(input.aggregateVersion) || input.aggregateVersion < 1) {
    throw new Error("NUTRIFLOW_INVALID_DOMAIN_EVENT:aggregateVersion");
  }

  if (Number.isNaN(Date.parse(input.occurredAt))) {
    throw new Error("NUTRIFLOW_INVALID_DOMAIN_EVENT:occurredAt");
  }

  return Object.freeze({
    ...input,
    actor: Object.freeze({ ...input.actor }),
    metadata: Object.freeze({ ...input.metadata }),
    payload: Object.freeze({ ...input.payload }),
  });
}
