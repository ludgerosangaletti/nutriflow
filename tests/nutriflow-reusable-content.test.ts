import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import { D1ReusableContentRepository } from "../modules/nutriflow/infrastructure/d1/d1-reusable-content-repository.ts";

class Statement {
  values: unknown[] = [];
  readonly query: string;
  readonly sqlite: DatabaseSync;
  constructor(query: string, sqlite: DatabaseSync) { this.query = query; this.sqlite = sqlite; }
  bind(...values: unknown[]) { this.values = values; return this; }
  private sqlValues() { return this.values.map((value) => value as SQLInputValue); }
  async first<T>() { return (this.sqlite.prepare(this.query).get(...this.sqlValues()) as T | undefined) ?? null; }
  async all<T>() { return { results: this.sqlite.prepare(this.query).all(...this.sqlValues()) as T[] }; }
  async run() { const result = this.sqlite.prepare(this.query).run(...this.sqlValues()); return { meta: { changes: Number(result.changes) } }; }
}

class Database {
  readonly sqlite: DatabaseSync;
  constructor(sqlite: DatabaseSync) { this.sqlite = sqlite; }
  prepare(query: string) { return new Statement(query, this.sqlite); }
  async batch(statements: Statement[]) {
    this.sqlite.exec("BEGIN IMMEDIATE");
    try { const results = statements.map((statement) => this.sqlite.prepare(statement.query).run(...statement.values.map((value) => value as SQLInputValue))); this.sqlite.exec("COMMIT"); return results; }
    catch (error) { this.sqlite.exec("ROLLBACK"); throw error; }
  }
}

function apply(sqlite: DatabaseSync, name: string) {
  const sql = readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
  for (const statement of sql.split("--> statement-breakpoint").map((entry) => entry.trim()).filter(Boolean)) sqlite.exec(statement);
}

function setup() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON; CREATE TABLE clients (id INTEGER PRIMARY KEY)");
  apply(sqlite, "0020_parallel_lucky_pierre.sql");
  apply(sqlite, "0021_true_cerise.sql");
  apply(sqlite, "0023_nutriflow_base_units.sql");
  apply(sqlite, "0024_nutriflow_global_food_catalog.sql");
  apply(sqlite, "0025_nutriflow_clinical_productivity.sql");
  sqlite.exec("INSERT INTO clients (id) VALUES (1); INSERT INTO nf_organizations (public_id, name) VALUES ('org_01', 'Organização teste')");
  return { sqlite, repository: new D1ReusableContentRepository(new Database(sqlite)) };
}

let sequence = 0;
function context() {
  return {
    organizationId: 1, organizationPublicId: "org_01", correlationId: `corr_${sequence + 1}`, occurredAt: "2026-08-01T14:00:00.000Z", environment: "test",
    actor: { kind: "staff" as const, authUserId: "auth_01", organizationPublicId: "org_01", role: "nutritionist" as const, membershipStatus: "active" as const },
    generatePublicId: (kind: string) => `${kind}_${++sequence}`,
  };
}

const egg = { publicId: "item_source_01", source: { type: "food" as const, publicId: "food_global_egg", revisionNumber: 1 }, displayName: "Ovo", quantityMilli: 2000, unit: { publicId: "unit_piece", code: "piece", label: "unidade" }, preparation: "mexido", notes: null, sortOrder: 0 };

test("meal templates are created, versioned, searched and audited atomically", async () => {
  const { sqlite, repository } = setup();
  const first = await repository.saveMealTemplate({ context: context(), command: { apiVersion: "v1", templatePublicId: null, name: "Café proteico", suggestedTime: "08:00", instructions: "Preparar na hora", items: [egg], release: true, correlationId: "corr_template_01" } });
  assert.equal(first.versionNumber, 1); assert.equal(first.state, "released");
  const second = await repository.saveMealTemplate({ context: context(), command: { apiVersion: "v1", templatePublicId: first.templatePublicId, name: "Café proteico atualizado", suggestedTime: "08:30", instructions: null, items: [egg], release: false, correlationId: "corr_template_02" } });
  assert.equal(second.versionNumber, 2); assert.equal(second.state, "draft");
  const search = await repository.searchMealTemplates({ organizationId: 1, query: { apiVersion: "v1", query: "proteico", limit: 10, correlationId: "corr_search_01" } });
  assert.equal(search.items.length, 1); assert.equal(search.items[0].versionNumber, 2); assert.equal(search.items[0].items.length, 1);
  assert.equal((sqlite.prepare("SELECT count(*) AS total FROM nf_meal_template_versions").get() as { total: number }).total, 2);
  assert.equal((sqlite.prepare("SELECT count(*) AS total FROM nf_audit_entries").get() as { total: number }).total, 2);
  assert.equal((sqlite.prepare("SELECT count(*) AS total FROM nf_outbox_events").get() as { total: number }).total, 2);
});

test("recipes preserve released food revisions, yield and audit history", async () => {
  const { sqlite, repository } = setup();
  const banana = { publicId: "ingredient_01", source: { type: "food" as const, publicId: "food_global_banana", revisionNumber: 1 }, displayName: "Banana", quantityMilli: 100000, unit: { publicId: "unit_gram", code: "g", label: "grama" }, preparation: "amassada", notes: null, sortOrder: 0 };
  const recipe = await repository.saveRecipe({ context: context(), command: { apiVersion: "v1", recipePublicId: null, name: "Banana cremosa", instructions: "Misturar", yieldQuantityMilli: 1000, yieldUnit: { publicId: "unit_portion", code: "portion", label: "porção" }, ingredients: [banana], release: true, correlationId: "corr_recipe_01" } });
  assert.equal(recipe.versionNumber, 1); assert.equal(recipe.ingredients[0].source.publicId, "food_global_banana");
  const search = await repository.searchRecipes({ organizationId: 1, query: { apiVersion: "v1", query: "banana", limit: 10, correlationId: "corr_search_02" } });
  assert.equal(search.items.length, 1); assert.equal(search.items[0].yieldUnit.code, "portion"); assert.equal(search.items[0].ingredients.length, 1);
  await repository.archiveRecipe({ context: context(), command: { apiVersion: "v1", publicId: recipe.recipePublicId, correlationId: "corr_archive_01" } });
  assert.equal((sqlite.prepare("SELECT status FROM nf_recipes WHERE public_id = ?").get(recipe.recipePublicId) as { status: string }).status, "archived");
  assert.equal((sqlite.prepare("SELECT count(*) AS total FROM nf_outbox_events").get() as { total: number }).total, 2);
});
