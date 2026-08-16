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

test("plan publication keeps push and email without a paid WhatsApp notification", () => {
  const workflowSource = readFileSync(
    new URL("../modules/nutriflow/application/events/handlers/send-workflow-notifications.ts", import.meta.url),
    "utf8",
  );
  const cronSource = readFileSync(
    new URL("../app/api/cron/process-outbox/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(workflowSource, /emailHandler\(PLAN_VERSION_PUBLISHED, "diet"\)/);
  assert.doesNotMatch(workflowSource, /whatsappHandler\(PLAN_VERSION_PUBLISHED, "diet"\)/);
  assert.match(workflowSource, /whatsappHandler\(TRAINING_ROUTINE_PUBLISHED, "training"\)/);
  assert.match(cronSource, /sendPushOnPlanPublished/);
});
