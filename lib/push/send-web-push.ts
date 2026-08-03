import webpush from "web-push";
import { env } from "cloudflare:workers";
import { getSubscriptionsForClient, removeSubscription } from "./push-subscriptions-repo";
export type PushNotificationPayload = Readonly<{ title: string; body: string; url?: string; tag?: string }>;
function configureWebPush() { if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) throw new Error("NF_PUSH_VAPID_NOT_CONFIGURED"); webpush.setVapidDetails(env.VAPID_SUBJECT || "mailto:contato@ludgerosangaletti.com.br", env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY); }
export async function sendPushToClient(clientEmail: string, payload: PushNotificationPayload) { configureWebPush(); await Promise.all((await getSubscriptionsForClient(clientEmail)).map(async (subscription) => { try { await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(payload)); } catch (error) { const status = (error as { statusCode?: number }).statusCode; if (status === 404 || status === 410) await removeSubscription(subscription.endpoint); else console.error("NF_PUSH_SEND_FAILED", error); } })); }
