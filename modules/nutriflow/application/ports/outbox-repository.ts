import type { DomainEvent } from "../../domain/events/domain-event.ts";

export type ClaimedOutboxEvent = Readonly<{
  event: DomainEvent;
  leaseToken: string;
  attempts: number;
}>;

export interface OutboxRepository {
  claimNext(input: Readonly<{
    now: string;
    staleBefore: string;
    leaseToken: string;
  }>): Promise<ClaimedOutboxEvent | null>;
  markProcessed(input: Readonly<{
    eventId: string;
    leaseToken: string;
    processedAt: string;
  }>): Promise<void>;
  scheduleRetry(input: Readonly<{
    eventId: string;
    leaseToken: string;
    availableAt: string;
    safeErrorCode: string;
  }>): Promise<void>;
  markDeadLetter(input: Readonly<{
    eventId: string;
    leaseToken: string;
    failedAt: string;
    safeErrorCode: string;
  }>): Promise<void>;
}

export type EventConsumptionClaim = "acquired" | "already-processed" | "busy";

export interface EventConsumptionRepository {
  claim(input: Readonly<{
    eventId: string;
    consumerName: string;
    now: string;
    staleBefore: string;
    leaseToken: string;
  }>): Promise<EventConsumptionClaim>;
  complete(input: Readonly<{
    eventId: string;
    consumerName: string;
    leaseToken: string;
    processedAt: string;
  }>): Promise<void>;
  fail(input: Readonly<{
    eventId: string;
    consumerName: string;
    leaseToken: string;
    failedAt: string;
    safeErrorCode: string;
    availableAt: string;
  }>): Promise<void>;
}
