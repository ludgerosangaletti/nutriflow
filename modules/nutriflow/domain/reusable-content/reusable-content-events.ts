import { createDomainEvent, type DomainEvent } from "../events/domain-event.ts";

export const MEAL_TEMPLATE_VERSION_CREATED = "nutriflow.meal-template-version-created.v1";
export const MEAL_TEMPLATE_ARCHIVED = "nutriflow.meal-template-archived.v1";
export const RECIPE_VERSION_CREATED = "nutriflow.recipe-version-created.v1";
export const RECIPE_ARCHIVED = "nutriflow.recipe-archived.v1";

type EventBase = Readonly<{
  eventId: string;
  aggregatePublicId: string;
  aggregateVersion: number;
  occurredAt: string;
  actor: Readonly<{ authUserId: string; role: string }>;
  correlationId: string;
  metadata: Readonly<{ organizationPublicId: string; environment: string; source: string }>;
}>;

export function reusableContentEvent(input: EventBase & Readonly<{
  kind: "meal-template" | "recipe";
  action: "version-created" | "archived";
  versionPublicId?: string;
  state?: string;
}>): DomainEvent {
  const eventType = input.kind === "meal-template"
    ? input.action === "version-created" ? MEAL_TEMPLATE_VERSION_CREATED : MEAL_TEMPLATE_ARCHIVED
    : input.action === "version-created" ? RECIPE_VERSION_CREATED : RECIPE_ARCHIVED;
  return createDomainEvent({
    eventId: input.eventId,
    eventType,
    eventVersion: 1,
    aggregateType: input.kind,
    aggregatePublicId: input.aggregatePublicId,
    aggregateVersion: input.aggregateVersion,
    occurredAt: input.occurredAt,
    actor: input.actor,
    correlationId: input.correlationId,
    payload: {
      publicId: input.aggregatePublicId,
      ...(input.versionPublicId ? { versionPublicId: input.versionPublicId } : {}),
      ...(input.state ? { state: input.state } : {}),
    },
    metadata: input.metadata,
  });
}
