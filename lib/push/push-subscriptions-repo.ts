import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { pushSubscriptions } from "../../db/schema";
export type PushSubscriptionInput = Readonly<{ clientEmail: string; endpoint: string; keys: Readonly<{ p256dh: string; auth: string }>; userAgent?: string | null }>;
export async function saveSubscription(input: PushSubscriptionInput) { const now = new Date().toISOString(); await getDb().insert(pushSubscriptions).values({ clientEmail: input.clientEmail, endpoint: input.endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent: input.userAgent ?? null, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { clientEmail: input.clientEmail, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent: input.userAgent ?? null, updatedAt: now } }); }
export async function removeSubscription(endpoint: string) { await getDb().delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)); }
export async function getSubscriptionsForClient(clientEmail: string) { return getDb().select().from(pushSubscriptions).where(eq(pushSubscriptions.clientEmail, clientEmail)); }
