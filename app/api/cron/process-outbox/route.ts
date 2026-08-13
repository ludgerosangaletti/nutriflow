import { env } from "cloudflare:workers";
import { ReliableDomainEventDispatcher, OutboxProcessor, type NamedDomainEventHandler } from "../../../../modules/nutriflow";
import { D1OutboxRepository, D1EventConsumptionRepository } from "../../../../modules/nutriflow/infrastructure/d1/d1-outbox-repository";
import { sendPushOnPlanPublished } from "../../../../modules/nutriflow/application/events/handlers/send-push-on-plan-published";
import { workflowNotificationHandlers } from "../../../../modules/nutriflow/application/events/handlers/send-workflow-notifications";
const handlers: readonly NamedDomainEventHandler[] = [sendPushOnPlanPublished, ...workflowNotificationHandlers];
function safeEqual(received: string, expected: string) { if (!expected || received.length !== expected.length) return false; let diff = 0; for (let i = 0; i < expected.length; i += 1) diff |= received.charCodeAt(i) ^ expected.charCodeAt(i); return diff === 0; }
export async function POST(request: Request) { if (!safeEqual(request.headers.get("x-checkin-reminder-secret") || "", env.CHECKIN_REMINDER_SECRET || "")) return Response.json({ error: "unauthorized" }, { status: 401 }); const dispatcher = new ReliableDomainEventDispatcher(new D1EventConsumptionRepository(env.DB), handlers, () => crypto.randomUUID()); const processor = new OutboxProcessor(new D1OutboxRepository(env.DB), dispatcher, () => crypto.randomUUID()); const results = []; // pg_net has a 5-second request budget; process one event per tick for a reliable 200 response and let the next cron tick continue the backlog.
  const result = await processor.processNext();
  if (result.outcome !== "empty") results.push(result);
  return Response.json({ ok: true, processed: results.length, results }); }
