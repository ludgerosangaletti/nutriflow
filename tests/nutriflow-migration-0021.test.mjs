import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

function apply(database, migrationName) {
  const migration = readFileSync(
    new URL(`../drizzle/${migrationName}`, import.meta.url),
    "utf8",
  );
  for (const statement of migration
    .split("--> statement-breakpoint")
    .map((value) => value.trim())
    .filter(Boolean)) {
    database.exec(statement);
  }
}

function migratedDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("CREATE TABLE clients (id INTEGER PRIMARY KEY)");
  apply(database, "0020_parallel_lucky_pierre.sql");
  apply(database, "0021_true_cerise.sql");
  return database;
}

test("Marco 0.2 adds the complete extensible content schema without changing legacy tables", () => {
  const database = migratedDatabase();
  const tables = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'nf_%' ORDER BY name",
    )
    .all()
    .map(({ name }) => name);

  assert.equal(tables.length, 27);
  for (const expected of [
    "nf_units",
    "nf_foods",
    "nf_food_revisions",
    "nf_nutrients",
    "nf_food_nutrients",
    "nf_recipes",
    "nf_recipe_versions",
    "nf_meal_templates",
    "nf_plan_days",
    "nf_meals",
    "nf_meal_items",
    "nf_substitution_groups",
    "nf_substitution_options",
    "nf_plan_notes",
    "nf_delivery_settings",
  ]) {
    assert.ok(tables.includes(expected), expected);
  }
  assert.equal(
    database.prepare("SELECT name FROM sqlite_master WHERE name = 'clients'").get()
      .name,
    "clients",
  );
});

test("released catalog revisions are immutable", () => {
  const database = migratedDatabase();
  database.exec(
    "INSERT INTO nf_foods (public_id, scope, source, created_by_auth_user_id) VALUES ('food_01', 'global', 'manual', 'auth_01')",
  );
  database.exec(
    "INSERT INTO nf_food_revisions (public_id, food_id, revision_number, state, name, created_by_auth_user_id, released_by_auth_user_id, released_at) VALUES ('food_revision_01', 1, 1, 'released', 'Banana', 'auth_01', 'auth_01', '2026-07-31T12:00:00.000Z')",
  );

  assert.throws(
    () => database.exec("UPDATE nf_food_revisions SET name = 'Outro' WHERE id = 1"),
    /NF_RELEASED_REVISION_IMMUTABLE/,
  );
});
