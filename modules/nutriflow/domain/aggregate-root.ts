import type { DomainEvent } from "./events/domain-event.ts";

export abstract class AggregateRoot {
  readonly #domainEvents: DomainEvent[] = [];

  protected recordDomainEvent(event: DomainEvent): void {
    this.#domainEvents.push(event);
  }

  peekDomainEvents(): readonly DomainEvent[] {
    return Object.freeze([...this.#domainEvents]);
  }

  pullDomainEvents(): readonly DomainEvent[] {
    const events = Object.freeze([...this.#domainEvents]);
    this.#domainEvents.length = 0;
    return events;
  }
}
