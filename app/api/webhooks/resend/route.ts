import { getDb } from "../../../../db";
import { resendWebhookEvents } from "../../../../db/schema";

const MAX_SKEW_SECONDS = 300;

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left[index] ^ right[index];
  return result === 0;
}

function decodeBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function verifySignature(request: Request, payload: string) {
  const secret = process.env.RESEND_WEBHOOK_SECRET || "";
  const eventId = request.headers.get("svix-id") || "";
  const timestamp = request.headers.get("svix-timestamp") || "";
  const signatures = request.headers.get("svix-signature") || "";
  const timestampSeconds = Number(timestamp);
  if (!secret || !eventId || !Number.isSafeInteger(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > MAX_SKEW_SECONDS) return false;
  const secretBytes = decodeBase64(secret.replace(/^whsec_/, ""));
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = new TextEncoder().encode(`${eventId}.${timestamp}.${payload}`);
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, signed));
  return signatures.split(" ").some((value) => {
    const [version, encoded] = value.split(",", 2);
    return version === "v1" && encoded && constantTimeEqual(expected, decodeBase64(encoded));
  });
}

export async function POST(request: Request) {
  const payload = await request.text();
  if (!(await verifySignature(request, payload))) return new Response("Invalid webhook", { status: 400 });

  let body: { type?: string; created_at?: string; data?: { email_id?: string } };
  try {
    body = JSON.parse(payload) as typeof body;
  } catch {
    return new Response("Invalid webhook", { status: 400 });
  }
  const providerEventId = request.headers.get("svix-id") as string;
  if (!body.type) return new Response("Invalid webhook", { status: 400 });
  const result = await getDb().insert(resendWebhookEvents).values({
    providerEventId,
    eventType: body.type,
    providerEmailId: body.data?.email_id || null,
    occurredAt: body.created_at || null,
    receivedAt: new Date().toISOString(),
  }).onConflictDoNothing({ target: resendWebhookEvents.providerEventId }).run();
  return Response.json({ ok: true, duplicate: (result.meta?.changes ?? 0) !== 1 });
}

export async function GET() {
  return Response.json({ ok: true, configured: Boolean(process.env.RESEND_WEBHOOK_SECRET) });
}
