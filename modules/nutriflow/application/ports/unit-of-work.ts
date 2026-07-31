import type { DomainEvent } from "../../domain/events/domain-event.ts";
import type { AuditWriteRepository } from "./audit-repository.ts";
import type { FoodPlanWriteRepository } from "./food-plan-repository.ts";

export interface NutriFlowTransaction {
  readonly plans: FoodPlanWriteRepository;
  readonly audit: AuditWriteRepository;
  enqueueDomainEvents(events: readonly DomainEvent[]): void;
}

export interface NutriFlowUnitOfWork {
  run<T>(operation: (transaction: NutriFlowTransaction) => Promise<T>): Promise<T>;
}

// Implementations must commit domain state and outbox rows atomically. Event
// dispatch is only allowed after run() resolves successfully.
