import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

function apply(database, name) {
  const sql = readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
  for (const statement of sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) {
    database.exec(statement);
  }
}

test("migration 0030 adiciona opt-in e trilha idempotente de entregas", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("CREATE TABLE clients (id INTEGER PRIMARY KEY, email TEXT NOT NULL);");
  apply(database, "0030_patient_activation_whatsapp.sql");
  apply(database, "0048_patient_whatsapp_activation_consent.sql");

  const columns = database.prepare("PRAGMA table_info(clients)").all();
  assert.equal(columns.some((column) => column.name === "whatsapp_activation_opt_in_at"), true);
  for (const name of [
    "whatsapp_activation_opt_in_phone",
    "whatsapp_activation_opt_in_source",
    "whatsapp_activation_opt_in_version",
    "whatsapp_activation_opt_in_text",
    "whatsapp_activation_opt_in_recorded_by",
    "whatsapp_activation_opt_in_recorded_by_email",
  ]) {
    assert.equal(columns.some((column) => column.name === name), true);
  }
  database.prepare(`INSERT INTO patient_activation_messages
    (client_email, delivery_key, kind, status)
    VALUES (?, ?, ?, ?)`)
    .run("paciente@example.com", "activation:reminder-24h:paciente@example.com", "automatic_reminder_24h", "sent");
  assert.throws(() => database.prepare(`INSERT INTO patient_activation_messages
    (client_email, delivery_key, kind, status)
    VALUES (?, ?, ?, ?)`)
    .run("paciente@example.com", "activation:reminder-24h:paciente@example.com", "automatic_reminder_24h", "sent"));
});
