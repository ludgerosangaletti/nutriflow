import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrationUrl = new URL(
  "../drizzle/0020_parallel_lucky_pierre.sql",
  import.meta.url,
);

function applyMigration() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("CREATE TABLE clients (id INTEGER PRIMARY KEY)");

  const migration = readFileSync(migrationUrl, "utf8");
  for (const statement of migration
    .split("--> statement-breakpoint")
    .map((value) => value.trim())
    .filter(Boolean)) {
    database.exec(statement);
  }

  return database;
}

test("the NutriFlow migration is additive and creates its isolated schema", () => {
  const database = applyMigration();
  const tables = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'nf_%' ORDER BY name",
    )
    .all()
    .map(({ name }) => name);

  assert.deepEqual(tables, [
    "nf_audit_entries",
    "nf_event_consumptions",
    "nf_feature_flag_overrides",
    "nf_organization_members",
    "nf_organizations",
    "nf_outbox_events",
    "nf_plan_versions",
    "nf_plans",
    "nf_publications",
  ]);
  assert.equal(
    database.prepare("SELECT name FROM sqlite_master WHERE name = 'clients'").get()
      .name,
    "clients",
  );
});

test("published snapshots and audit entries are protected by database guards", () => {
  const database = applyMigration();
  database.exec(
    "INSERT INTO nf_organizations (public_id, name) VALUES ('org_01', 'Organização teste')",
  );
  database.exec(
    "INSERT INTO clients (id) VALUES (1); INSERT INTO nf_plans (public_id, organization_id, client_id, title, created_by_auth_user_id) VALUES ('plan_01', 1, 1, 'Plano', 'auth_01')",
  );
  database.exec(
    "INSERT INTO nf_plan_versions (public_id, plan_id, version_number, state, title, snapshot_json, content_hash, created_by_auth_user_id, published_by_auth_user_id, published_at) VALUES ('version_01', 1, 1, 'published', 'Plano', '{}', 'sha256:test', 'auth_01', 'auth_01', '2026-07-31T12:00:00.000Z')",
  );
  database.exec(
    "INSERT INTO nf_audit_entries (public_id, organization_id, actor_auth_user_id, actor_role, action, entity_type, entity_public_id, correlation_id, occurred_at) VALUES ('audit_01', 1, 'auth_01', 'nutritionist', 'plan.published', 'food-plan', 'plan_01', 'corr_01', '2026-07-31T12:00:00.000Z')",
  );

  assert.throws(
    () => database.exec("UPDATE nf_plan_versions SET title = 'Alterado' WHERE id = 1"),
    /NF_PUBLICATION_IMMUTABLE/,
  );
  assert.throws(
    () => database.exec("DELETE FROM nf_audit_entries WHERE id = 1"),
    /NF_AUDIT_APPEND_ONLY/,
  );
});
