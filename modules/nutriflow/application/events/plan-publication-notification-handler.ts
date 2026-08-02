import type { DomainEvent } from "../../domain/events/domain-event.ts";
import { PLAN_VERSION_PUBLISHED } from "../../domain/plans/plan-events.ts";

export function createPlanPublicationNotificationHandler(input: Readonly<{ notify: (payload: Record<string, unknown>) => Promise<void> }>) {
  return { consumerName: "nutriflow.plan-publication-notification.v1", eventType: PLAN_VERSION_PUBLISHED, async handle(event: DomainEvent) {
    await input.notify({ eventId: event.eventId, publication: event.payload });
  } };
}
