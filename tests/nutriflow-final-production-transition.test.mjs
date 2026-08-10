import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migration = readFileSync(
  new URL("../drizzle/0044_nutriflow_final_production_transition.sql", import.meta.url),
  "utf8",
);

const stableFlags = [
  "nutriflow.editor.enabled",
  "nutriflow.catalog.global.enabled",
  "nutriflow.meal_templates.enabled",
  "nutriflow.recipes.enabled",
  "nutriflow.patient_view.enabled",
  "nutriflow.training.enabled",
];

function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE nf_organizations (id INTEGER PRIMARY KEY, public_id TEXT NOT NULL, status TEXT NOT NULL);
    CREATE TABLE nf_feature_flag_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL,
      flag_key TEXT NOT NULL,
      organization_id INTEGER,
      client_id INTEGER,
      enabled INTEGER NOT NULL,
      variant TEXT,
      reason TEXT NOT NULL,
      expires_at TEXT,
      created_by_auth_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE nf_training_entitlements (id INTEGER PRIMARY KEY, organization_id INTEGER NOT NULL, client_id INTEGER NOT NULL, status TEXT NOT NULL);
    INSERT INTO nf_organizations VALUES (1, 'org_ludgero_sangaletti', 'active'), (2, 'org_other', 'active');
    INSERT INTO nf_feature_flag_overrides (public_id, flag_key, organization_id, client_id, enabled, variant, reason, expires_at, created_by_auth_user_id)
      VALUES
      ('flag_test_active', 'nutriflow.patient_view.enabled', 1, 10, 1, 'controlled-homologation', 'teste', '2026-12-31T00:00:00.000Z', 'owner'),
      ('flag_test_suspended', 'nutriflow.training.enabled', 1, 11, 0, 'homologation-suspended', 'teste', NULL, 'owner'),
      ('flag_training_off', 'nutriflow.training.enabled', 1, NULL, 0, 'off', 'pré-lançamento', NULL, 'owner'),
      ('flag_other_org', 'nutriflow.training.enabled', 2, NULL, 0, 'off', 'outra organização', NULL, 'owner');
    INSERT INTO nf_training_entitlements VALUES (1, 1, 10, 'active'), (2, 1, 11, 'inactive');
  `);
  for (const statement of migration.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) sqlite.exec(statement);
  return sqlite;
}

test("produção habilita as capacidades estáveis, inclusive Training, somente para a organização oficial", () => {
  const sqlite = database();
  const rows = sqlite.prepare(`SELECT flag_key, enabled, variant, expires_at
    FROM nf_feature_flag_overrides
    WHERE organization_id = 1 AND client_id IS NULL
    ORDER BY flag_key`).all();
  assert.deepEqual(rows.map((row) => row.flag_key), stableFlags.toSorted());
  assert.ok(rows.every((row) => row.enabled === 1 && row.variant === "production-stable" && row.expires_at === null));
  assert.deepEqual({ ...sqlite.prepare("SELECT enabled, variant FROM nf_feature_flag_overrides WHERE public_id = 'flag_other_org'").get() }, { enabled: 0, variant: "off" });
});

test("overrides de homologação deixam de participar da precedência sem apagar seu histórico", () => {
  const sqlite = database();
  const rows = sqlite.prepare("SELECT enabled, variant, expires_at FROM nf_feature_flag_overrides WHERE client_id IS NOT NULL ORDER BY client_id").all();
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.enabled === 0 && row.variant === "homologation-retired" && row.expires_at === "1970-01-01T00:00:00.000Z"));
});

test("a transição não concede nem altera entitlement individual do Training", () => {
  const sqlite = database();
  assert.deepEqual(sqlite.prepare("SELECT client_id, status FROM nf_training_entitlements ORDER BY client_id").all().map((row) => ({ ...row })), [
    { client_id: 10, status: "active" },
    { client_id: 11, status: "inactive" },
  ]);
  assert.doesNotMatch(migration, /(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+)?nf_training_entitlements/i);
});

test("a homologação 9/9 não participa mais da tela administrativa normal", () => {
  const page = readFileSync(new URL("../app/admin/clientes/[email]/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /NutriFlowHomologationPanel|getControlledHomologationSnapshot/);
});
