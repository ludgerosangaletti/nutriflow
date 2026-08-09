import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("produção habilita somente capacidades estáveis no escopo da organização", () => {
  const migration = fs.readFileSync(new URL("../drizzle/0039_enable_stable_nutriflow_by_organization.sql", import.meta.url), "utf8");
  for (const flag of ["nutriflow.editor.enabled", "nutriflow.catalog.global.enabled", "nutriflow.meal_templates.enabled", "nutriflow.recipes.enabled", "nutriflow.patient_view.enabled"]) assert.match(migration, new RegExp(flag.replaceAll(".", "\\.")));
  assert.match(migration, /organization\.status = 'active'/);
  assert.match(migration, /client_id IS NULL/);
  assert.doesNotMatch(migration, /controlled-homologation/);
});

test("flags experimentais permanecem fora da habilitação de produção", () => {
  const migration = fs.readFileSync(new URL("../drizzle/0039_enable_stable_nutriflow_by_organization.sql", import.meta.url), "utf8");
  for (const flag of ["nutriflow.realtime_updates.enabled", "nutriflow.domain_events.enabled", "nutriflow.smart_substitutions.enabled"]) assert.doesNotMatch(migration, new RegExp(flag.replaceAll(".", "\\.")));
});
