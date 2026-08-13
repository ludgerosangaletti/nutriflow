import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { patientActivationMessages } from "../../../../db/schema";
import { getSubscriptionsForClient } from "../../../../lib/push/push-subscriptions-repo";
import { sendPushToSubscription } from "../../../../lib/push/send-web-push";
import { sendReturnReminderWhatsApp } from "../../../whatsapp-return-reminder";

type Channel = "whatsapp" | "push";

function safeEqual(received: string, expected: string) {
  if (!expected || received.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validTestId(value: string) {
  return /^[a-z0-9][a-z0-9_-]{7,79}$/.test(value);
}

function deliveryKey(channel: Channel, testId: string) {
  return `controlled-test:${channel}:${testId}`;
}

async function currentDelivery(channel: Channel, testId: string) {
  const [delivery] = await getDb().select({
    status: patientActivationMessages.status,
    providerId: patientActivationMessages.providerId,
    error: patientActivationMessages.error,
    updatedAt: patientActivationMessages.updatedAt,
  }).from(patientActivationMessages).where(eq(patientActivationMessages.deliveryKey, deliveryKey(channel, testId))).limit(1);
  return delivery || null;
}

export async function POST(request: Request) {
  const suppliedSecret = request.headers.get("x-checkin-reminder-secret") || "";
  const expectedSecret = env.CHECKIN_REMINDER_SECRET || "";
  if (!safeEqual(suppliedSecret, expectedSecret)) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    action?: "preflight" | "send" | "status";
    channel?: Channel;
    testId?: string;
    email?: string;
    recipient?: string;
    firstName?: string;
  } | null;
  const action = body?.action;
  const channel = body?.channel;
  const testId = String(body?.testId || "").trim().toLowerCase();
  const email = String(body?.email || "").trim().toLowerCase();
  if (!action || !channel || !["whatsapp", "push"].includes(channel) || !validTestId(testId) || !validEmail(email)) {
    return Response.json({ error: "invalid_test_request" }, { status: 400 });
  }

  if (action === "status") {
    return Response.json({ ok: true, channel, delivery: await currentDelivery(channel, testId) });
  }

  if (action === "preflight") {
    const subscriptions = channel === "push" ? await getSubscriptionsForClient(email) : [];
    return Response.json({
      ok: true,
      channel,
      ready: channel === "whatsapp"
        ? Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_RETURN_TEMPLATE_NAME)
        : subscriptions.length > 0 && Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
      activeSubscriptions: channel === "push" ? subscriptions.length : undefined,
      existingDelivery: await currentDelivery(channel, testId),
    });
  }

  if (action !== "send") return Response.json({ error: "invalid_test_action" }, { status: 400 });
  const subscriptions = channel === "push" ? await getSubscriptionsForClient(email) : [];
  if (channel === "push" && subscriptions.length === 0) {
    return Response.json({ error: "push_subscription_missing" }, { status: 409 });
  }
  const now = new Date().toISOString();
  const key = deliveryKey(channel, testId);
  const claim = await env.DB.prepare(
    "INSERT OR IGNORE INTO patient_activation_messages (client_email, delivery_key, kind, channel, status, attempt_count, created_at, updated_at) VALUES (?, ?, 'controlled_test', ?, 'processing', 1, ?, ?)",
  ).bind(email, key, channel, now, now).run();
  if ((claim.meta?.changes ?? 0) !== 1) {
    return Response.json({ ok: true, channel, duplicate: true, delivery: await currentDelivery(channel, testId) });
  }

  try {
    if (channel === "whatsapp") {
      const result = await sendReturnReminderWhatsApp({
        accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
        templateName: process.env.WHATSAPP_RETURN_TEMPLATE_NAME,
        recipient: String(body.recipient || ""),
        patientName: String(body.firstName || "Ludgero"),
        appointmentAt: new Date(Date.now() + 86_400_000).toISOString(),
      });
      await getDb().update(patientActivationMessages).set({
        status: result.status,
        providerId: result.providerId || null,
        error: result.error || null,
        sentAt: result.status === "sent" ? now : null,
        updatedAt: now,
      }).where(eq(patientActivationMessages.deliveryKey, key));
      return Response.json({ ok: result.status === "sent", channel, duplicate: false, status: result.status, providerId: result.providerId || null, error: result.error || null }, { status: result.status === "sent" ? 202 : 502 });
    }

    const latest = [...subscriptions].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    const result = await sendPushToSubscription(latest, {
      title: "Teste de notificação NutriFlow",
      body: "Canal Push validado com um único envio controlado.",
      url: "/area-cliente",
      tag: `controlled-test-${testId}`,
    });
    await getDb().update(patientActivationMessages).set({ status: result.status, sentAt: result.status === "sent" ? now : null, error: result.status === "expired" ? "PUSH_SUBSCRIPTION_EXPIRED" : null, updatedAt: now }).where(eq(patientActivationMessages.deliveryKey, key));
    return Response.json({ ok: result.status === "sent", channel, duplicate: false, status: result.status }, { status: result.status === "sent" ? 202 : 410 });
  } catch (error) {
    const safeError = error instanceof Error ? error.message.slice(0, 160) : "CONTROLLED_TEST_FAILED";
    await getDb().update(patientActivationMessages).set({ status: "failed", error: safeError, updatedAt: new Date().toISOString() }).where(eq(patientActivationMessages.deliveryKey, key));
    return Response.json({ ok: false, channel, error: safeError }, { status: 502 });
  }
}
