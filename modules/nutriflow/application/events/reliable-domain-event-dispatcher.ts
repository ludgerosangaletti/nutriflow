import type { DomainEvent } from "../../domain/events/domain-event.ts";
import type { EventConsumptionRepository } from "../ports/outbox-repository.ts";

export type NamedDomainEventHandler = Readonly<{
  consumerName: string;
  eventType: string;
  handle: (event: DomainEvent) => Promise<void>;
}>;

export class ReliableDomainEventDispatcher {
  private readonly consumptions: EventConsumptionRepository;
  private readonly handlers: readonly NamedDomainEventHandler[];
  private readonly createLeaseToken: () => string;
  constructor(
    consumptions: EventConsumptionRepository,
    handlers: readonly NamedDomainEventHandler[],
    createLeaseToken: () => string,
  ) {
    this.consumptions = consumptions;
    this.handlers = handlers;
    this.createLeaseToken = createLeaseToken;
  }

  async dispatch(event: DomainEvent, now = new Date()) {
    const handlers = this.handlers.filter(({ eventType }) => eventType === event.eventType);
    for (const handler of handlers) {
      const leaseToken = this.createLeaseToken();
      const claim = await this.consumptions.claim({
        eventId: event.eventId,
        consumerName: handler.consumerName,
        now: now.toISOString(),
        staleBefore: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
        leaseToken,
      });
      if (claim === "already-processed") continue;
      if (claim === "busy") throw new Error("NUTRIFLOW_EVENT_CONSUMER_BUSY");
      try {
        await handler.handle(event);
        await this.consumptions.complete({
          eventId: event.eventId,
          consumerName: handler.consumerName,
          leaseToken,
          processedAt: new Date().toISOString(),
        });
      } catch (error) {
        await this.consumptions.fail({
          eventId: event.eventId,
          consumerName: handler.consumerName,
          leaseToken,
          failedAt: new Date().toISOString(),
          safeErrorCode: safeErrorCode(error),
          availableAt: new Date(now.getTime() + 60_000).toISOString(),
        });
        throw error;
      }
    }
  }
}

function safeErrorCode(error: unknown) {
  if (error instanceof Error && /^NF_[A-Z0-9_]+$/.test(error.message)) {
    return error.message;
  }
  return "NF_EVENT_HANDLER_FAILED";
}
