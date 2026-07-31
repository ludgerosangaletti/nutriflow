import type { DomainEvent } from "../../domain/events/domain-event.ts";

export type DomainEventHandler = (event: DomainEvent) => Promise<void>;

export interface DomainEventDispatcher {
  dispatchCommitted(events: readonly DomainEvent[]): Promise<void>;
}

export class InMemoryDomainEventDispatcher implements DomainEventDispatcher {
  readonly #handlers = new Map<string, Set<DomainEventHandler>>();

  subscribe(eventType: string, handler: DomainEventHandler): () => void {
    const handlers = this.#handlers.get(eventType) ?? new Set<DomainEventHandler>();
    handlers.add(handler);
    this.#handlers.set(eventType, handlers);

    return () => handlers.delete(handler);
  }

  async dispatchCommitted(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      const handlers = this.#handlers.get(event.eventType) ?? [];
      await Promise.all([...handlers].map((handler) => handler(event)));
    }
  }
}
