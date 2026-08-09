type DeliveryClaim = Readonly<{ claimed: boolean; current_status: string; attempt_count: number }>;

function config() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("COMMUNICATION_IDEMPOTENCY_NOT_CONFIGURED");
  return { url, key };
}

async function request(path: string, init: RequestInit) {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    signal: AbortSignal.timeout(8_000),
    headers: { authorization: `Bearer ${key}`, apikey: key, "content-type": "application/json", ...(init.headers || {}) },
  });
  if (!response.ok) throw new Error("COMMUNICATION_IDEMPOTENCY_STORE_FAILED");
  return response;
}

export async function claimEmailDelivery(input: Readonly<{ key: string; type: string; recipient: string }>) {
  const response = await request("rpc/claim_communication_delivery", {
    method: "POST",
    body: JSON.stringify({ p_delivery_key: input.key, p_channel: "email", p_notification_type: input.type, p_recipient: input.recipient }),
  });
  const rows = await response.json() as DeliveryClaim[];
  return rows[0] || { claimed: false, current_status: "unknown", attempt_count: 0 };
}

export async function markEmailSent(key: string, providerMessageId: string | null) {
  await request(`communication_deliveries?delivery_key=eq.${encodeURIComponent(key)}&status=eq.processing`, {
    method: "PATCH",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ status: "sent", provider_message_id: providerMessageId, sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  });
}

export async function markEmailFailed(key: string, errorCode: string) {
  await request(`communication_deliveries?delivery_key=eq.${encodeURIComponent(key)}&status=eq.processing`, {
    method: "PATCH",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ status: "failed", last_error: errorCode.slice(0, 120), updated_at: new Date().toISOString() }),
  });
}

export function resendHeaders(apiKey: string, idempotencyKey: string) {
  return { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "Idempotency-Key": idempotencyKey };
}
