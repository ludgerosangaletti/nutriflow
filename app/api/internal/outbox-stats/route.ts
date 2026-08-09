import { env } from "cloudflare:workers";

function safeEqual(received: string, expected: string) {
  if (!expected || received.length !== expected.length) return false;
  let result = 0;
  for (let index = 0; index < expected.length; index += 1) result |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  return result === 0;
}

export async function GET(request: Request) {
  if (!safeEqual(request.headers.get("x-checkin-reminder-secret") || "", env.CHECKIN_REMINDER_SECRET || "")) return Response.json({ error: "unauthorized" }, { status: 401 });
  const counts = await env.DB.prepare("SELECT status, COUNT(*) AS total, COALESCE(SUM(attempts), 0) AS attempts FROM nf_outbox_events GROUP BY status ORDER BY status").all<{ status: string; total: number; attempts: number }>();
  const oldest = await env.DB.prepare("SELECT occurred_at, available_at, processing_started_at, attempts FROM nf_outbox_events WHERE status IN ('pending','retry','processing') ORDER BY available_at, id LIMIT 1").first<{ occurred_at: string; available_at: string; processing_started_at: string | null; attempts: number }>();
  const stale = await env.DB.prepare("SELECT COUNT(*) AS total FROM nf_outbox_events WHERE status = 'processing' AND processing_started_at < datetime('now', '-5 minutes')").first<{ total: number }>();
  return Response.json({ ok: true, counts, oldestPending: oldest || null, staleProcessing: stale?.total || 0 });
}
