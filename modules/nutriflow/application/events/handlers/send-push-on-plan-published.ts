import { eq } from "drizzle-orm";
import type { DomainEvent } from "../../../domain/events/domain-event.ts";
import { PLAN_VERSION_PUBLISHED, type PlanVersionPublishedPayload } from "../../../domain/plans/plan-events.ts";
import type { NamedDomainEventHandler } from "../reliable-domain-event-dispatcher.ts";
import { getDb } from "../../../../../db";
import { clients } from "../../../../../db/schema";
import { sendPushToClient } from "../../../../../lib/push/send-web-push";
export const sendPushOnPlanPublished: NamedDomainEventHandler = { consumerName: "push.plan-version-published", eventType: PLAN_VERSION_PUBLISHED, handle: async (event: DomainEvent) => { const payload = event.payload as PlanVersionPublishedPayload; const [client] = await getDb().select({ email: clients.email }).from(clients).where(eq(clients.id, payload.clientId)).limit(1); if (!client) return; await sendPushToClient(client.email, { title: "Novo plano alimentar disponível", body: "Seu nutricionista publicou uma atualização no seu plano. Toque para ver.", url: "/plano-alimentar", tag: `plan-published-${payload.planVersionPublicId}` }); } };
