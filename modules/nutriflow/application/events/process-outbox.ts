import type { OutboxRepository } from "../ports/outbox-repository.ts";
import { ReliableDomainEventDispatcher } from "./reliable-domain-event-dispatcher.ts";

export type OutboxProcessResult =
  | Readonly<{ outcome: "empty" }>
  | Readonly<{ outcome: "processed"; eventId: string }>
  | Readonly<{ outcome: "retry-scheduled"; eventId: string; attempts: number }>
  | Readonly<{ outcome: "dead-letter"; eventId: string; attempts: number }>;

export class OutboxProcessor {
  private readonly outbox: OutboxRepository;
  private readonly dispatcher: ReliableDomainEventDispatcher;
  private readonly createLeaseToken: () => string;
  private readonly maxAttempts: number;
  constructor(
    outbox: OutboxRepository,
    dispatcher: ReliableDomainEventDispatcher,
    createLeaseToken: () => string,
    maxAttempts = 5,
  ) {
    this.outbox = outbox;
    this.dispatcher = dispatcher;
    this.createLeaseToken = createLeaseToken;
    this.maxAttempts = maxAttempts;
  }

  async processNext(now = new Date()): Promise<OutboxProcessResult> {
    const leaseToken = this.createLeaseToken();
    const claimed = await this.outbox.claimNext({
      now: now.toISOString(),
      staleBefore: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
      leaseToken,
    });
    if (!claimed) return Object.freeze({ outcome: "empty" });

    try {
      await this.dispatcher.dispatch(claimed.event, now);
      await this.outbox.markProcessed({
        eventId: claimed.event.eventId,
        leaseToken,
        processedAt: new Date().toISOString(),
      });
      return Object.freeze({ outcome: "processed", eventId: claimed.event.eventId });
    } catch (error) {
      const safeCode = safeErrorCode(error);
      if (claimed.attempts >= this.maxAttempts) {
        await this.outbox.markDeadLetter({
          eventId: claimed.event.eventId,
          leaseToken,
          failedAt: new Date().toISOString(),
          safeErrorCode: safeCode,
        });
        return Object.freeze({
          outcome: "dead-letter",
          eventId: claimed.event.eventId,
          attempts: claimed.attempts,
        });
      }
      const backoffMs = Math.min(60 * 60 * 1000, 30_000 * 2 ** (claimed.attempts - 1));
      await this.outbox.scheduleRetry({
        eventId: claimed.event.eventId,
        leaseToken,
        availableAt: new Date(now.getTime() + backoffMs).toISOString(),
        safeErrorCode: safeCode,
      });
      return Object.freeze({
        outcome: "retry-scheduled",
        eventId: claimed.event.eventId,
        attempts: claimed.attempts,
      });
    }
  }
}

function safeErrorCode(error: unknown) {
  if (error instanceof Error && /^NF_[A-Z0-9_]+$/.test(error.message)) {
    return error.message;
  }
  return "NF_OUTBOX_DISPATCH_FAILED";
}
