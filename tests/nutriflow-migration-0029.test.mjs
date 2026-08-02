import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

function apply(database, name) {
  const sql = readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
  for (const statement of sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) database.exec(statement);
}

function tacoDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON; CREATE TABLE clients (id INTEGER PRIMARY KEY)");
  apply(database, "0020_parallel_lucky_pierre.sql");
  apply(database, "0021_true_cerise.sql");
  apply(database, "0023_nutriflow_base_units.sql");
  apply(database, "0024_nutriflow_global_food_catalog.sql");
  return database;
}

test("migration 0029 imports the official TACO catalog additively and idempotently", () => {
  const database = tacoDatabase();
  apply(database, "0029_nutriflow_taco_catalog.sql");
  apply(database, "0029_nutriflow_taco_catalog.sql");

  assert.equal(database.prepare("SELECT count(*) AS total FROM nf_foods WHERE source = 'taco'").get().total, 597);
  assert.equal(database.prepare("SELECT count(*) AS total FROM nf_food_revisions AS revision INNER JOIN nf_foods AS food ON food.id = revision.food_id WHERE food.source = 'taco' AND revision.state = 'released'").get().total, 597);
  assert.equal(database.prepare("SELECT count(*) AS total FROM nf_food_categories WHERE status = 'active'").get().total, 15);
  assert.equal(database.prepare("SELECT count(*) AS total FROM nf_food_nutrients AS value INNER JOIN nf_food_revisions AS revision ON revision.id = value.food_revision_id INNER JOIN nf_foods AS food ON food.id = revision.food_id WHERE food.source = 'taco'").get().total, 13407);

  const source = database.prepare("SELECT file_sha256, usage_status FROM nf_food_data_sources WHERE code = 'taco' AND version = '4a-edicao'").get();
  assert.equal(source.file_sha256, "a66b8ec528daeabc63bc2b015fc9bd8c6d76b941c2fc0ed93a4311d449302d14");
  assert.equal(source.usage_status, "active_internal_clinical_use");
  assert.equal(database.prepare("SELECT usage_status FROM nf_food_data_sources WHERE code = 'tbca'").get().usage_status, "blocked_pending_commercial_authorization");
});

test("TACO values preserve unavailable, trace and numeric semantics", () => {
  const database = tacoDatabase();
  apply(database, "0029_nutriflow_taco_catalog.sql");

  const values = database.prepare(`SELECT nutrient.code, value.amount_scaled, value.source
    FROM nf_food_nutrients AS value
    INNER JOIN nf_nutrients AS nutrient ON nutrient.id = value.nutrient_id
    INNER JOIN nf_food_revisions AS revision ON revision.id = value.food_revision_id
    WHERE revision.public_id = 'foodrev_taco_0003_v1'`).all();
  const byCode = Object.fromEntries(values.map((row) => [row.code, row]));

  assert.equal(byCode.energy_kcal.amount_scaled, 128258);
  assert.equal(byCode.protein.amount_scaled, 2521);
  assert.equal(byCode.carbohydrate.amount_scaled, 28060);
  assert.equal(byCode.thiamin.code, "thiamin");
  assert.equal(byCode.thiamin.amount_scaled, 0);
  assert.equal(byCode.thiamin.source, "taco:trace");
  assert.equal(byCode.cholesterol, undefined);
});
