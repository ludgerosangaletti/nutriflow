import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

function apply(database, name) {
  const sql = readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
  for (const statement of sql.split("--> statement-breakpoint").map((v) => v.trim()).filter(Boolean)) {
    database.exec(statement);
  }
}

test("migration 0022 is additive and preserves existing NutriFlow records", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON; CREATE TABLE clients (id INTEGER PRIMARY KEY)");
  apply(database, "0020_parallel_lucky_pierre.sql");
  apply(database, "0021_true_cerise.sql");
  database.exec("INSERT INTO clients (id) VALUES (1); INSERT INTO nf_organizations (public_id, name) VALUES ('org_01', 'Org'); INSERT INTO nf_outbox_events (event_id, organization_id, event_type, event_version, aggregate_type, aggregate_public_id, aggregate_version, actor_auth_user_id, correlation_id, occurred_at, payload_json, metadata_json, status, attempts, available_at) VALUES ('evt_existing', 1, 'plan.draft.created', 1, 'food-plan', 'plan_01', 1, 'auth_01', 'corr_01', '2026-07-31T12:00:00.000Z', '{}', '{}', 'pending', 0, '2026-07-31T12:00:00.000Z')");
  apply(database, "0022_fantastic_martin_li.sql");
  assert.equal(database.prepare("SELECT count(*) AS total FROM nf_outbox_events").get().total, 1);
  assert.ok(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'nf_idempotency_keys'").get());
  assert.ok(database.prepare("SELECT processing_started_at, lease_token FROM nf_outbox_events WHERE event_id = 'evt_existing'").get());
});
