import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import { D1FoodCatalogReadRepository } from "../modules/nutriflow/infrastructure/d1/d1-food-catalog-read-repository.ts";
import { parseSearchFoodCatalogQueryV1 } from "../modules/nutriflow/contracts/v1/validation.ts";
import { NUTRIFLOW_EDITOR_TOOLS } from "../modules/nutriflow/config/editor-tools.ts";
import { NUTRIFLOW_DEFAULT_FEATURE_FLAGS } from "../modules/nutriflow/config/feature-flags.ts";

class SqliteStatement {
  private readonly query: string;
  private readonly sqlite: DatabaseSync;
  private values: unknown[] = [];
  constructor(query: string, sqlite: DatabaseSync) { this.query = query; this.sqlite = sqlite; }
  bind(...values: unknown[]) { this.values = values; return this; }
  async first<T>() { return (this.sqlite.prepare(this.query).get(...this.sqlValues()) as T | undefined) ?? null; }
  async all<T>() { return { results: this.sqlite.prepare(this.query).all(...this.sqlValues()) as T[] }; }
  async run() { const result = this.sqlite.prepare(this.query).run(...this.sqlValues()); return { meta: { changes: Number(result.changes) } }; }
  private sqlValues() { return this.values.map((value) => value as SQLInputValue); }
}

class CountingDatabase {
  readonly sqlite: DatabaseSync;
  prepareCount = 0;
  constructor(sqlite: DatabaseSync) { this.sqlite = sqlite; }
  prepare(query: string) { this.prepareCount += 1; return new SqliteStatement(query, this.sqlite); }
}

function apply(database: DatabaseSync, migrationName: string) {
  const migration = readFileSync(new URL(`../drizzle/${migrationName}`, import.meta.url), "utf8");
  for (const statement of migration.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) database.exec(statement);
}

function catalogDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON; CREATE TABLE clients (id INTEGER PRIMARY KEY)");
  apply(sqlite, "0020_parallel_lucky_pierre.sql");
  apply(sqlite, "0021_true_cerise.sql");
  apply(sqlite, "0023_nutriflow_base_units.sql");
  apply(sqlite, "0024_nutriflow_global_food_catalog.sql");
  sqlite.exec("INSERT INTO nf_organizations (public_id, name) VALUES ('org_catalog_01', 'Organização catálogo')");
  return sqlite;
}

function query(search: string, categoryCode: string | null = null) {
  return parseSearchFoodCatalogQueryV1({ apiVersion: "v1", query: search, categoryCode, limit: 12, correlationId: "corr_catalog_01" });
}

test("global catalog migration is additive, idempotent and releases curated foods", () => {
  const sqlite = catalogDatabase();
  apply(sqlite, "0024_nutriflow_global_food_catalog.sql");
  const foods = sqlite.prepare("SELECT count(*) AS total FROM nf_foods WHERE scope = 'global'").get() as { total: number };
  const released = sqlite.prepare("SELECT count(*) AS total FROM nf_food_revisions WHERE state = 'released'").get() as { total: number };
  assert.equal(foods.total, 30);
  assert.equal(released.total, 30);
});

test("food search uses one query, ranks name and aliases and preserves the released revision", async () => {
  const database = new CountingDatabase(catalogDatabase());
  const repository = new D1FoodCatalogReadRepository(database);
  database.prepareCount = 0;
  const banana = await repository.search({ organizationId: 1, query: query("banana prata") });
  assert.equal(database.prepareCount, 1);
  assert.equal(banana.items[0]?.name, "Banana");
  assert.deepEqual(banana.items[0]?.aliases.includes("banana prata"), true);
  assert.equal(banana.items[0]?.revisionNumber, 1);
  assert.equal(banana.items[0]?.referenceUnit.code, "g");

  const proteins = await repository.search({ organizationId: 1, query: query("", "proteins") });
  assert.equal(proteins.items.every((item) => item.categoryCode === "proteins"), true);
  assert.equal(proteins.items.some((item) => item.name === "Peito de frango grelhado"), true);
});

test("editor tool registry makes recipes and templates available without enabling them", () => {
  assert.deepEqual(NUTRIFLOW_EDITOR_TOOLS.map(({ id, implementationState }) => [id, implementationState]), [
    ["food-library", "available"],
    ["recipes", "available"],
    ["meal-templates", "available"],
  ]);
  for (const tool of NUTRIFLOW_EDITOR_TOOLS) {
    assert.equal(NUTRIFLOW_DEFAULT_FEATURE_FLAGS[tool.featureFlag as keyof typeof NUTRIFLOW_DEFAULT_FEATURE_FLAGS], false);
  }
});

test("catalog query contract bounds search cost", () => {
  assert.throws(() => parseSearchFoodCatalogQueryV1({ apiVersion: "v1", query: "banana", categoryCode: null, limit: 26, correlationId: "corr_catalog_limit" }));
  assert.equal(parseSearchFoodCatalogQueryV1({ apiVersion: "v1", query: "", categoryCode: null, limit: 1, correlationId: "corr_catalog_limit_ok" }).limit, 1);
});
