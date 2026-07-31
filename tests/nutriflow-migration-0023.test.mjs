import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

function apply(database, name) {
  const sql = readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
  for (const statement of sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) database.exec(statement);
}

test("migration 0023 seeds reusable global units idempotently", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON; CREATE TABLE clients (id INTEGER PRIMARY KEY)");
  apply(database, "0020_parallel_lucky_pierre.sql");
  apply(database, "0021_true_cerise.sql");
  apply(database, "0023_nutriflow_base_units.sql");
  apply(database, "0023_nutriflow_base_units.sql");
  assert.equal(database.prepare("SELECT count(*) AS total FROM nf_units WHERE organization_id IS NULL").get().total, 8);
  assert.equal(database.prepare("SELECT label FROM nf_units WHERE public_id = 'unit_gram'").get().label, "grama");
});
