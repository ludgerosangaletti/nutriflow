import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

function apply(database, name) {
  const sql = readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
  for (const statement of sql
    .split("--> statement-breakpoint")
    .map((value) => value.trim())
    .filter(Boolean)) {
    database.exec(statement);
  }
}

test("migration 0028 supports deidentified archival of published patients", () => {
  const database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE clients (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO clients (id, email) VALUES (7, 'patient@example.com');
  `);

  apply(database, "0028_patient_reset_archival.sql");
  database.prepare(`
    UPDATE clients
    SET email = ?, archived_at = ?, archive_reason = ?
    WHERE id = ?
  `).run(
    "reset-7-1@deleted.invalid",
    "2026-08-01T12:00:00.000Z",
    "patient_requested_restart",
    7,
  );
  database.prepare("INSERT INTO clients (id, email) VALUES (?, ?)").run(
    8,
    "patient@example.com",
  );

  const archived = database
    .prepare("SELECT email, archived_at, archive_reason FROM clients WHERE id = 7")
    .get();
  assert.equal(archived.email, "reset-7-1@deleted.invalid");
  assert.equal(archived.archive_reason, "patient_requested_restart");
  assert.ok(archived.archived_at);
  assert.equal(
    database.prepare("SELECT count(*) AS total FROM clients WHERE archived_at IS NULL").get().total,
    1,
  );
});
