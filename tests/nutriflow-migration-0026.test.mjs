import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

test("Sprint 5 migration is additive and creates portal read indexes", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("CREATE TABLE patient_documents (client_email TEXT, document_type TEXT, is_current INTEGER, published_at TEXT); CREATE TABLE check_ins (client_email TEXT, week_start TEXT); CREATE TABLE nf_publications (organization_id INTEGER, client_id INTEGER, status TEXT, published_at TEXT)");
  const migration = readFileSync(new URL("../drizzle/0026_nutriflow_patient_portal.sql", import.meta.url), "utf8");
  for (const statement of migration.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) database.exec(statement);
  const indexes = database.prepare("SELECT name FROM sqlite_master WHERE type = 'index' ORDER BY name").all().map((row) => row.name);
  assert.deepEqual(indexes, ["check_ins_client_week_read_idx", "nf_publications_patient_latest_idx", "patient_documents_client_type_current_idx"]);
});

