import webpush from "web-push";
import { env } from "cloudflare:workers";
import { getSubscriptionsForClient, removeSubscription } from "./push-subscriptions-repo";
export type PushNotificationPayload = Readonly<{ title: string; body: string; url?: string; tag?: string }>;
function configureWebPush() { if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) throw new Error("NF_PUSH_VAPID_NOT_CONFIGURED"); webpush.setVapidDetails(env.VAPID_SUBJECT || "mailto:contato@ludgerosangaletti.com.br", env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY); }
export async function sendPushToSubscription(subscription: Awaited<ReturnType<typeof getSubscriptionsForClient>>[number], payload: PushNotificationPayload) {
  configureWebPush();
  try {
    await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(payload));
    return { status: "sent" as const };
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await removeSubscription(subscription.endpoint);
      return { status: "expired" as const };
    }
    console.error("NF_PUSH_SEND_FAILED", { status: statusCode, error: error instanceof Error ? error.message : "unknown" });
    throw new Error("NF_PUSH_DELIVERY_TRANSIENT_FAILURE");
  }
}
export async function sendPushToClient(clientEmail: string, payload: PushNotificationPayload) {
  const subscriptions = await getSubscriptionsForClient(clientEmail);
  if (subscriptions.length === 0) return;
  const failures: unknown[] = [];
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await sendPushToSubscription(subscription, payload);
    } catch (error) {
      failures.push(error);
    }
  }));
  if (failures.length > 0) throw new Error("NF_PUSH_DELIVERY_TRANSIENT_FAILURE");
}
