import type { DomainEvent } from "../../domain/events/domain-event.ts";

export interface NutriFlowTransaction {
  enqueueDomainEvents(events: readonly DomainEvent[]): Promise<void>;
}

export interface NutriFlowUnitOfWork {
  run<T>(operation: (transaction: NutriFlowTransaction) => Promise<T>): Promise<T>;
}

// Implementations must commit domain state and outbox rows atomically. Event
// dispatch is only allowed after run() resolves successfully.
