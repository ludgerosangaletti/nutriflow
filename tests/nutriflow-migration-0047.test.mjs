import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

function apply(database, name) {
  const migration = readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
  for (const statement of migration.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) database.exec(statement);
}

function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON; CREATE TABLE clients (id INTEGER PRIMARY KEY)");
  for (const migration of [
    "0020_parallel_lucky_pierre.sql",
    "0021_true_cerise.sql",
    "0023_nutriflow_base_units.sql",
    "0024_nutriflow_global_food_catalog.sql",
    "0027_nutriflow_beverages_and_flexible_unit.sql",
    "0029_nutriflow_taco_catalog.sql",
  ]) apply(sqlite, migration);
  sqlite.exec("INSERT OR IGNORE INTO nf_organizations (public_id,name,status) VALUES ('org_ludgero_sangaletti','Ludgero Sangaletti','active')");
  return sqlite;
}

test("migration 0047 imports TBCA 7.3 additively, preserves reconciled public ids and is idempotent", () => {
  const sqlite = database();
  const preexistingGlobalFoods = sqlite.prepare("SELECT count(*) AS total FROM nf_foods WHERE scope = 'global'").get().total;
  apply(sqlite, "0047_nutriflow_tbca_7_3.sql");
  apply(sqlite, "0047_nutriflow_tbca_7_3.sql");

  assert.equal(preexistingGlobalFoods, 634);
  assert.equal(sqlite.prepare("SELECT count(*) AS total FROM nf_foods WHERE scope = 'global'").get().total, 6411);
  assert.equal(sqlite.prepare("SELECT count(*) AS total FROM nf_foods WHERE source = 'tbca'").get().total, 5777);
  assert.equal(sqlite.prepare("SELECT count(*) AS total FROM nf_food_revisions WHERE json_extract(source_metadata_json, '$.sourceCode') = 'tbca'").get().total, 5863);
  assert.equal(sqlite.prepare("SELECT count(*) AS total FROM nf_foods AS food LEFT JOIN nf_food_revisions AS revision ON revision.food_id = food.id WHERE revision.id IS NULL").get().total, 0);

  const source = sqlite.prepare("SELECT version, usage_status, file_sha256 FROM nf_food_data_sources WHERE code = 'tbca'").get();
  assert.deepEqual({ ...source }, {
    version: "7.3",
    usage_status: "active_noncommercial_nutritional_calculation",
    file_sha256: "7711e2736c1b9f307405700d1fa451fa58ddc5b0e7d7b5421650a3156a8a6277",
  });
  assert.equal(sqlite.prepare("SELECT enabled FROM nf_feature_flag_overrides WHERE flag_key = 'nutriflow.nutrition_totals.enabled'").get().enabled, 1);
});

test("TBCA revisions keep the five calculation values and transparent provenance", () => {
  const sqlite = database();
  apply(sqlite, "0047_nutriflow_tbca_7_3.sql");

  const revision = sqlite.prepare(`SELECT revision.id, revision.name, revision.source_metadata_json
    FROM nf_food_revisions AS revision
    WHERE json_extract(revision.source_metadata_json, '$.externalCode') = 'BRC0001C'`).get();
  assert.equal(revision.name, "Abacate, polpa, in natura, Brasil");
  const metadata = JSON.parse(revision.source_metadata_json);
  assert.equal(metadata.sourceCode, "tbca");
  assert.equal(metadata.sourceVersion, "7.3");
  assert.equal(metadata.referenceBase, "100 g de parte comestível");
  assert.match(metadata.mirrorUrl, /DiegoLins10\/web-scrapping-alimentos/);

  const nutrients = sqlite.prepare(`SELECT nutrient.code, value.amount_scaled
    FROM nf_food_nutrients AS value
    INNER JOIN nf_nutrients AS nutrient ON nutrient.id = value.nutrient_id
    WHERE value.food_revision_id = ? ORDER BY nutrient.code`).all(revision.id);
  assert.deepEqual(nutrients.map((row) => row.code), ["carbohydrate", "energy_kcal", "fiber", "lipids", "protein"]);
  assert.equal(Object.fromEntries(nutrients.map((row) => [row.code, row.amount_scaled])).energy_kcal, 76000);
});
