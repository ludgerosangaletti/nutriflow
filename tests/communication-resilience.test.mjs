import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

function apply(database, name) {
  const sql = readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
  for (const statement of sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) database.exec(statement);
}

test("WhatsApp and Resend webhook event stores reject duplicate provider IDs", () => {
  const database = new DatabaseSync(":memory:");
  apply(database, "0036_whatsapp_webhook_idempotency.sql");
  apply(database, "0037_resend_webhook_events.sql");

  database.prepare("INSERT INTO whatsapp_webhook_events (provider_event_id, received_at) VALUES (?, ?)").run("wamid.test", "2026-01-01T00:00:00.000Z");
  assert.throws(() => database.prepare("INSERT INTO whatsapp_webhook_events (provider_event_id, received_at) VALUES (?, ?)").run("wamid.test", "2026-01-01T00:00:01.000Z"));

  database.prepare("INSERT INTO resend_webhook_events (provider_event_id, event_type, received_at) VALUES (?, ?, ?)").run("msg_test", "email.delivered", "2026-01-01T00:00:00.000Z");
  assert.throws(() => database.prepare("INSERT INTO resend_webhook_events (provider_event_id, event_type, received_at) VALUES (?, ?, ?)").run("msg_test", "email.delivered", "2026-01-01T00:00:01.000Z"));
});
