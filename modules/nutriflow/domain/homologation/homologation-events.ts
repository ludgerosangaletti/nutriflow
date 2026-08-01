import { createDomainEvent, type DomainEvent } from "../events/domain-event.ts";

export const HOMOLOGATION_ACCESS_CONFIGURED =
  "nutriflow.homologation-access-configured.v1";

export function homologationAccessConfigured(input: Readonly<{
  eventId: string;
  organizationPublicId: string;
  clientId: number;
  enabled: boolean;
  expiresAt: string | null;
  occurredAt: string;
  actor: Readonly<{ authUserId: string; role: string }>;
  correlationId: string;
  environment: string;
}>): DomainEvent {
  return createDomainEvent({
    eventId: input.eventId,
    eventType: HOMOLOGATION_ACCESS_CONFIGURED,
    eventVersion: 1,
    aggregateType: "homologation-access",
    aggregatePublicId: `client-${input.clientId}`,
    aggregateVersion: 1,
    occurredAt: input.occurredAt,
    actor: input.actor,
    correlationId: input.correlationId,
    payload: {
      clientId: input.clientId,
      enabled: input.enabled,
      expiresAt: input.expiresAt,
    },
    metadata: {
      organizationPublicId: input.organizationPublicId,
      environment: input.environment,
      source: "nutriflow.homologation",
    },
  });
}

