import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import { NUTRIFLOW_DEFAULT_FEATURE_FLAGS, NUTRIFLOW_FEATURE_FLAGS } from "../modules/nutriflow/config/feature-flags.ts";
import { parseSearchTrainingExerciseLibraryQueryV1 } from "../modules/nutriflow/contracts/v1/validation.ts";
import { assertTrainingPrescriptionMetric } from "../modules/nutriflow/domain/training/training-prescription.ts";
import { D1TrainingLibraryRepository } from "../modules/nutriflow/infrastructure/d1/d1-training-library-repository.ts";

class SqliteStatement {
  private readonly query: string;
  private readonly sqlite: DatabaseSync;
  private values: unknown[] = [];

  constructor(query: string, sqlite: DatabaseSync) {
    this.query = query;
    this.sqlite = sqlite;
  }

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

function apply(database: DatabaseSync, name: string) {
  const sql = readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
  for (const statement of sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) {
    database.exec(statement);
  }
}

function trainingDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON; CREATE TABLE clients (id INTEGER PRIMARY KEY)");
  apply(sqlite, "0020_parallel_lucky_pierre.sql");
  sqlite.exec("INSERT INTO clients (id) VALUES (10), (20)");
  sqlite.exec("INSERT INTO nf_organizations (public_id, name) VALUES ('org_train_one', 'OrganizaÃ§Ã£o um'), ('org_train_two', 'OrganizaÃ§Ã£o dois')");
  apply(sqlite, "0040_nutriflow_training_foundation.sql");
  return sqlite;
}

function query(value: string, muscleGroup: string | null = null, limit = 12) {
  return parseSearchTrainingExerciseLibraryQueryV1({
    apiVersion: "v1",
    query: value,
    muscleGroup,
    limit,
    correlationId: "corr_training_library",
  });
}

test("training migration is additive, idempotent and keeps the feature disabled by default", () => {
  const sqlite = trainingDatabase();
  apply(sqlite, "0040_nutriflow_training_foundation.sql");
  const globalExercises = sqlite.prepare("SELECT count(*) AS total FROM nf_training_exercises WHERE scope = 'global'").get() as { total: number };
  assert.equal(globalExercises.total, 12);
  assert.equal(NUTRIFLOW_DEFAULT_FEATURE_FLAGS[NUTRIFLOW_FEATURE_FLAGS.TRAINING], false);
});

test("training library exposes global plus only the requesting organization's private exercises", async () => {
  const database = new CountingDatabase(trainingDatabase());
  database.sqlite.exec("INSERT INTO nf_training_exercises (public_id, organization_id, scope, name, primary_muscle_group, aliases_json, status) VALUES ('tr_ex_org_one', 1, 'organization', 'Remada da OrganizaÃ§Ã£o Um', 'costas', '[\"remada especial\"]', 'active'), ('tr_ex_org_two', 2, 'organization', 'Remada da OrganizaÃ§Ã£o Dois', 'costas', '[]', 'active')");
  const repository = new D1TrainingLibraryRepository(database);
  database.prepareCount = 0;

  const results = await repository.search({ organizationId: 1, query: query("remada") });
  assert.equal(database.prepareCount, 1);
  assert.deepEqual(results.items.map((item) => item.publicId), ["tr_ex_org_one", "tr_ex_global_remada_baixa"]);
  assert.equal(results.items.some((item) => item.publicId === "tr_ex_org_two"), false);

  const alias = await repository.search({ organizationId: 1, query: query("especial", "costas") });
  assert.deepEqual(alias.items.map((item) => item.publicId), ["tr_ex_org_one"]);
});

test("published routine versions and publications are protected as immutable snapshots", () => {
  const sqlite = trainingDatabase();
  sqlite.exec("INSERT INTO nf_training_routines (public_id, organization_id, client_id, title, created_by_auth_user_id) VALUES ('tr_routine_one', 1, 10, 'Rotina A', 'auth_admin')");
  sqlite.exec("INSERT INTO nf_training_routine_versions (public_id, routine_id, version_number, state, snapshot_json, created_by_auth_user_id) VALUES ('tr_version_one', 1, 1, 'published', '{\"exercise\":\"Supino reto\"}', 'auth_admin')");
  sqlite.exec("INSERT INTO nf_training_publications (public_id, organization_id, client_id, routine_id, routine_version_id, published_by_auth_user_id, published_at) VALUES ('tr_publication_one', 1, 10, 1, 1, 'auth_admin', CURRENT_TIMESTAMP)");

  assert.throws(() => sqlite.exec("UPDATE nf_training_routine_versions SET snapshot_json = '{}' WHERE id = 1"), /NF_PUBLICATION_IMMUTABLE/);
  assert.throws(() => sqlite.exec("DELETE FROM nf_training_publications WHERE id = 1"), /NF_PUBLICATION_IMMUTABLE/);
});

test("training prescription accepts repetitions or time and rejects an empty execution metric", () => {
  assert.doesNotThrow(() => assertTrainingPrescriptionMetric({ sets: 3, repetitions: { min: 8, max: 12 }, durationSeconds: null, restSeconds: 60, notes: null }));
  assert.doesNotThrow(() => assertTrainingPrescriptionMetric({ sets: null, repetitions: null, durationSeconds: 45, restSeconds: null, notes: "Prancha" }));
  assert.throws(() => assertTrainingPrescriptionMetric({ sets: 3, repetitions: null, durationSeconds: null, restSeconds: 60, notes: null }), /NUTRIFLOW_TRAINING_EXECUTION_METRIC_REQUIRED/);
});

test("training library contract bounds query cost", () => {
  assert.equal(query("supino", "peito", 1).limit, 1);
  assert.throws(() => query("supino", null, 26));
});
