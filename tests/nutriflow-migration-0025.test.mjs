import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(new URL("../drizzle/0025_nutriflow_clinical_productivity.sql", import.meta.url), "utf8");

test("Sprint 4 migration is additive, idempotent and limited to performance indexes", () => {
  assert.match(sql, /CREATE INDEX IF NOT EXISTS `nf_food_revisions_catalog_lookup_idx`/);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS `nf_meal_template_versions_latest_idx`/);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS `nf_recipe_versions_latest_idx`/);
  assert.doesNotMatch(sql, /DROP\s+(TABLE|COLUMN|INDEX)|DELETE\s+FROM|ALTER\s+TABLE/i);
});
