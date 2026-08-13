import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import { NUTRIFLOW_DEFAULT_FEATURE_FLAGS, NUTRIFLOW_FEATURE_FLAGS } from "../modules/nutriflow/config/feature-flags.ts";
import { parseSearchTrainingExerciseLibraryQueryV1 } from "../modules/nutriflow/contracts/v1/validation.ts";
import { TRAINING_EXERCISE_LIBRARY_MAX_RESULTS } from "../modules/nutriflow/contracts/v1/training.ts";
import { assertTrainingPrescriptionMetric } from "../modules/nutriflow/domain/training/training-prescription.ts";
import { D1TrainingLibraryRepository } from "../modules/nutriflow/infrastructure/d1/d1-training-library-repository.ts";
import { D1TrainingEditorRepository } from "../modules/nutriflow/infrastructure/d1/d1-training-editor-repository.ts";
import { D1PatientTrainingRepository } from "../modules/nutriflow/infrastructure/d1/d1-patient-training-repository.ts";
import { D1TrainingMediaRepository } from "../modules/nutriflow/infrastructure/d1/d1-training-media-repository.ts";
import { GetPatientTraining } from "../modules/nutriflow/application/training/get-patient-training.ts";
import { NutriFlowApplicationError } from "../modules/nutriflow/application/errors/nutriflow-application-error.ts";
import { parseTrainingRoutineContentV1 } from "../modules/nutriflow/contracts/v1/validation.ts";
import { assertCuratedTrainingMediaBytes, assertTrainingMediaUpload, classifyGlobalTrainingMediaImport, globalTrainingCatalogSlug, parseGlobalTrainingMediaImportManifest, publicationReferencesTrainingMedia } from "../modules/nutriflow/domain/training/training-media.ts";
import { addMuscleGroup, addTrainingExercise, moveTrainingExercise } from "../app/admin/clientes/[email]/training/training-editor-state.ts";
import { validateTrainingMediaBatch } from "../scripts/validate-training-media-batch.mjs";

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

class TrainingDatabase {
  readonly sqlite: DatabaseSync;
  constructor(sqlite: DatabaseSync) { this.sqlite = sqlite; }
  prepare(query: string) { return new SqliteStatement(query, this.sqlite); }
  async batch(statements: SqliteStatement[]) { return Promise.all(statements.map((statement) => statement.run())); }
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
  apply(sqlite, "0045_nutriflow_training_anamnesis.sql");
  return sqlite;
}

function trainingEditorDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON; CREATE TABLE clients (id INTEGER PRIMARY KEY, organization_id INTEGER)");
  apply(sqlite, "0020_parallel_lucky_pierre.sql");
  sqlite.exec("INSERT INTO clients (id, organization_id) VALUES (10, 1), (20, 2)");
  sqlite.exec("INSERT INTO nf_organizations (public_id, name) VALUES ('org_training_editor', 'OrganizaÃ§Ã£o Training'), ('org_training_other', 'Outra organizaÃ§Ã£o')");
  apply(sqlite, "0040_nutriflow_training_foundation.sql");
  apply(sqlite, "0045_nutriflow_training_anamnesis.sql");
  return new TrainingDatabase(sqlite);
}

function trainingMediaDatabase() {
  const database = trainingEditorDatabase();
  apply(database.sqlite, "0041_nutriflow_training_media.sql");
  apply(database.sqlite, "0043_nutriflow_training_media_provenance.sql");
  database.sqlite.exec("INSERT INTO nf_training_exercises (public_id, organization_id, scope, name, primary_muscle_group, aliases_json, status) VALUES ('tr_ex_org_media_one', 1, 'organization', 'ExercÃ­cio privado um', 'peito', '[]', 'active'), ('tr_ex_org_media_two', 2, 'organization', 'ExercÃ­cio privado dois', 'costas', '[]', 'active')");
  return database;
}

function editorRepository(database = trainingEditorDatabase()) {
  let sequence = 0;
  return new D1TrainingEditorRepository({
    database,
    generatePublicId: (kind) => `${kind}_${++sequence}`,
    now: () => new Date("2026-08-09T12:00:00.000Z"),
    hashJson: async (value) => `hash_${JSON.stringify(value).length}`,
  });
}

function editorExercise() {
  return {
    apiVersion: "v1" as const,
    publicId: "tr_ex_global_supino_reto",
    name: "Supino reto",
    primaryMuscleGroup: "peito",
    aliases: [],
    instructions: null,
    scope: "global" as const,
    media: null,
  };
}

function query(value: string, muscleGroup: string | null = null, limit = 12) {
  return parseSearchTrainingExerciseLibraryQueryV1({
    apiVersion: "v1",
    query: value,
    muscleGroup,
    limit,
    offset: 0,
    correlationId: "corr_training_library",
  });
}

test("training migration is additive, idempotent and keeps the feature disabled by default", () => {
  const sqlite = trainingDatabase();
  apply(sqlite, "0040_nutriflow_training_foundation.sql");
  const globalExercises = sqlite.prepare("SELECT count(*) AS total FROM nf_training_exercises WHERE scope = 'global'").get() as { total: number };
  assert.equal(globalExercises.total, 12);
  const migrationSql = readFileSync(new URL("../drizzle/0040_nutriflow_training_foundation.sql", import.meta.url), "utf8");
  assert.equal(migrationSql.includes("UNION ALL"), false);
  assert.equal(NUTRIFLOW_DEFAULT_FEATURE_FLAGS[NUTRIFLOW_FEATURE_FLAGS.TRAINING], false);
});

test("Training media migration keeps bytes in object storage metadata and is safe under the migration ledger", () => {
  const sqlite = trainingDatabase();
  apply(sqlite, "0041_nutriflow_training_media.sql");
  const columns = sqlite.prepare("PRAGMA table_info(nf_training_exercise_media)").all() as { name: string }[];
  assert.deepEqual(columns.filter((column) => ["poster_mime_type", "byte_size", "poster_byte_size"].includes(column.name)).map((column) => column.name), ["poster_mime_type", "byte_size", "poster_byte_size"]);
  // SQLite cannot conditionally add a column. The deployment migration ledger
  // is therefore the idempotency boundary: 0041 is applied once, while all
  // DDL it creates after the columns is repeat-safe.
  assert.throws(() => apply(sqlite, "0041_nutriflow_training_media.sql"), /duplicate column name/);
});

test("programmatic global media import records provenance and resolves idempotent versions", () => {
  const sqlite = trainingDatabase();
  apply(sqlite, "0041_nutriflow_training_media.sql");
  apply(sqlite, "0043_nutriflow_training_media_provenance.sql");
  const columns = sqlite.prepare("PRAGMA table_info(nf_training_exercise_media)").all() as { name: string }[];
  assert.deepEqual(
    columns.filter((column) => ["content_sha256", "poster_sha256", "source_url", "credit", "license", "license_url"].includes(column.name)).map((column) => column.name),
    ["content_sha256", "poster_sha256", "source_url", "credit", "license", "license_url"],
  );
  assert.equal(classifyGlobalTrainingMediaImport({ activeMediaPublicId: null, activeContentSha256: null, activePosterSha256: null, contentSha256: "a", posterSha256: "b", allowNewVersion: false }), "created");
  assert.equal(classifyGlobalTrainingMediaImport({ activeMediaPublicId: "tr_media_existing", activeContentSha256: "a", activePosterSha256: "b", contentSha256: "a", posterSha256: "b", allowNewVersion: false }), "already_present");
  assert.equal(classifyGlobalTrainingMediaImport({ activeMediaPublicId: "tr_media_existing", activeContentSha256: null, activePosterSha256: null, contentSha256: "a", posterSha256: "b", allowNewVersion: false }), "skipped");
  assert.equal(classifyGlobalTrainingMediaImport({ activeMediaPublicId: "tr_media_existing", activeContentSha256: "old", activePosterSha256: "old", contentSha256: "a", posterSha256: "b", allowNewVersion: true }), "updated_version");
});

test("Training Global Library 1.0 persists exactly the reconciled 100 exercises", () => {
  const sqlite = trainingDatabase();
  apply(sqlite, "0042_nutriflow_training_global_library.sql");
  apply(sqlite, "0042_nutriflow_training_global_library.sql");
  const exercises = sqlite.prepare(`SELECT public_id, name FROM nf_training_exercises
    WHERE scope = 'global' AND organization_id IS NULL ORDER BY public_id`).all() as { public_id: string; name: string }[];
  const publicIds = new Set(exercises.map((exercise) => exercise.public_id));
  const slugs = new Set(exercises.map((exercise) => globalTrainingCatalogSlug(exercise.public_id)));
  const semanticNames = new Set(exercises.map((exercise) => exercise.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()));
  assert.equal(exercises.length, 100);
  assert.equal(publicIds.size, 100);
  assert.equal(slugs.size, 100);
  assert.equal(semanticNames.size, 100);
  assert.equal(sqlite.prepare("SELECT name FROM nf_training_exercises WHERE public_id = 'tr_ex_global_crucifixo'").get()!.name, "Crucifixo reto com halteres");
  assert.equal(sqlite.prepare("SELECT name FROM nf_training_exercises WHERE public_id = 'tr_ex_global_puxada_frente'").get()!.name, "Puxada frontal pronada");
});

test("Training Global Library expands Abdômen and Cardio without duplicating reconciled exercises", () => {
  const sqlite = trainingDatabase();
  apply(sqlite, "0042_nutriflow_training_global_library.sql");
  const originalPublicIds = new Set((sqlite.prepare(`SELECT public_id FROM nf_training_exercises
    WHERE scope = 'global' AND organization_id IS NULL`).all() as { public_id: string }[]).map((exercise) => exercise.public_id));

  apply(sqlite, "0046_nutriflow_training_abdomen_cardio.sql");
  apply(sqlite, "0046_nutriflow_training_abdomen_cardio.sql");

  const exercises = sqlite.prepare(`SELECT public_id, name, primary_muscle_group FROM nf_training_exercises
    WHERE scope = 'global' AND organization_id IS NULL ORDER BY public_id`).all() as { public_id: string; name: string; primary_muscle_group: string }[];
  const normalizedNames = new Set(exercises.map((exercise) => exercise.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()));
  assert.equal(exercises.length, 109);
  assert.equal(new Set(exercises.map((exercise) => exercise.public_id)).size, 109);
  assert.equal(normalizedNames.size, 109);
  assert.ok([...originalPublicIds].every((publicId) => exercises.some((exercise) => exercise.public_id === publicId)));
  assert.equal(exercises.filter((exercise) => exercise.primary_muscle_group === "abdomen").length, 10);
  assert.equal(exercises.filter((exercise) => exercise.primary_muscle_group === "cardio").length, 3);
  assert.deepEqual(exercises.filter((exercise) => exercise.primary_muscle_group === "core").map((exercise) => exercise.name).sort(), ["Ab wheel", "Pallof press", "Prancha", "Prancha lateral"]);
  assert.deepEqual(
    exercises.filter((exercise) => ["tr_ex_global_crunch-abdominal", "tr_ex_global_crunch-cabo", "tr_ex_global_elevacao-pernas", "tr_ex_global_elevacao-joelhos-suspenso"].includes(exercise.public_id)).map((exercise) => exercise.name).sort(),
    ["Abdominal crunch", "Abdominal crunch no cabo", "Elevação de joelhos na barra", "Elevação de pernas na barra"],
  );
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
  assert.equal(query("supino", null, TRAINING_EXERCISE_LIBRARY_MAX_RESULTS).limit, TRAINING_EXERCISE_LIBRARY_MAX_RESULTS);
  assert.equal(query("supino").offset, 0);
  assert.throws(() => query("supino", null, TRAINING_EXERCISE_LIBRARY_MAX_RESULTS + 1));
});

test("training library paginates the full catalog in stable 25-item batches", async () => {
  const database = new CountingDatabase(trainingDatabase());
  apply(database.sqlite, "0042_nutriflow_training_global_library.sql");
  const repository = new D1TrainingLibraryRepository(database);
  const firstQuery = { ...query("", null, TRAINING_EXERCISE_LIBRARY_MAX_RESULTS), offset: 0 };
  const secondQuery = { ...firstQuery, offset: TRAINING_EXERCISE_LIBRARY_MAX_RESULTS };
  const first = await repository.search({ organizationId: 1, query: firstQuery });
  const second = await repository.search({ organizationId: 1, query: secondQuery });
  assert.equal(first.items.length, 25);
  assert.equal(second.items.length, 25);
  assert.equal(first.hasMore, true);
  assert.equal(new Set([...first.items, ...second.items].map((item) => item.publicId)).size, 50);
});

test("training library filters use canonical catalog values", async () => {
  const database = new CountingDatabase(trainingDatabase());
  apply(database.sqlite, "0042_nutriflow_training_global_library.sql");
  const repository = new D1TrainingLibraryRepository(database);
  for (const muscleGroup of ["biceps", "triceps", "quadriceps", "posterior_coxa", "gluteos"]) {
    const result = await repository.search({ organizationId: 1, query: { ...query("", muscleGroup, 25), offset: 0 } });
    assert.ok(result.items.length > 0, muscleGroup);
    assert.ok(result.items.every((item) => item.primaryMuscleGroup === muscleGroup), muscleGroup);
  }
});

test("training library UI requests incremental pages and centralizes canonical filter values", () => {
  const editor = readFileSync(new URL("../app/admin/clientes/[email]/training/training-editor.tsx", import.meta.url), "utf8");
  assert.match(editor, /offset: String\(offset\)/);
  assert.match(editor, /result\.data\.hasMore/);
  assert.match(editor, /"Carregar mais"/);
  for (const mapping of [
    '{ label: "Bíceps", value: "biceps" }',
    '{ label: "Tríceps", value: "triceps" }',
    '{ label: "Quadríceps", value: "quadriceps" }',
    '{ label: "Posterior", value: "posterior_coxa" }',
    '{ label: "Glúteos", value: "gluteos" }',
    '{ label: "Abdômen", value: "abdomen" }',
    '{ label: "Cardio", value: "cardio" }',
  ]) assert.ok(editor.includes(mapping), mapping);
});

test("Training media validates mobile-safe upload bounds and publication references", () => {
  assert.doesNotThrow(() => assertTrainingMediaUpload({ kind: "video", mediaName: "supino.mp4", mediaType: "video/mp4", mediaBytes: 512_000, posterName: "supino.webp", posterType: "image/webp", posterBytes: 24_000, durationMs: 15_000 }));
  assert.throws(() => assertTrainingMediaUpload({ kind: "video", mediaName: "supino.mov", mediaType: "video/quicktime", mediaBytes: 512_000, posterName: "supino.webp", posterType: "image/webp", posterBytes: 24_000, durationMs: 15_000 }), /video-format/);
  assert.throws(() => assertTrainingMediaUpload({ kind: "video", mediaName: "supino.mp4", mediaType: "video/mp4", mediaBytes: 512_000, posterName: "supino.gif", posterType: "image/gif", posterBytes: 24_000, durationMs: 15_000 }), /poster-format/);
  const content = parseTrainingRoutineContentV1({ schemaVersion: 1, days: [{ weekday: "mon", muscleGroups: [{ publicId: "group", name: "Peito", sortOrder: 0, exercises: [{ publicId: "exercise", exercise: { publicId: "catalog", name: "Supino", primaryMuscleGroup: "peito", instructions: null, mediaPublicId: "training_media_snapshot", posterObjectKey: "poster", mediaObjectKey: "video", mediaKind: "video" }, prescription: { sets: 3, repetitions: { min: 8, max: 10 }, durationSeconds: null, restSeconds: 60, notes: null }, sortOrder: 0 }] }] }] });
  assert.equal(publicationReferencesTrainingMedia(content, "training_media_snapshot"), true);
  assert.equal(publicationReferencesTrainingMedia(content, "training_media_other_org"), false);
});

test("global Training media manifest maps stable slugs and rejects ambiguous batches", () => {
  assert.equal(globalTrainingCatalogSlug("tr_ex_global_crucifixo"), "crucifixo-reto-halteres");
  assert.equal(globalTrainingCatalogSlug("tr_ex_global_supino-inclinado-barra"), "supino-inclinado-barra");
  const manifest = parseGlobalTrainingMediaImportManifest({
    apiVersion: 1,
    items: [
      { slug: "supino_reto", videoFile: "supino_reto.mp4", posterFile: "supino_reto.webp", durationSeconds: 15 },
      { slug: "triceps-pulley-corda", exercisePublicId: "tr_ex_global_triceps_pulley", videoFile: "triceps_pulley.mp4", posterFile: "triceps_pulley.jpg", durationSeconds: 12.5 },
    ],
  });
  assert.deepEqual(manifest.items.map((item) => item.exercisePublicId), ["tr_ex_global_supino_reto", "tr_ex_global_triceps_pulley"]);
  assert.equal(manifest.items[1]!.durationMs, 12_500);
  assert.throws(() => parseGlobalTrainingMediaImportManifest({ apiVersion: 1, items: [
    { slug: "supino_reto", videoFile: "one.mp4", posterFile: "one.webp", durationSeconds: 15 },
    { slug: "supino_reto", videoFile: "two.mp4", posterFile: "two.webp", durationSeconds: 15 },
  ] }), /slug-duplicate/);
  assert.throws(() => parseGlobalTrainingMediaImportManifest({ apiVersion: 1, items: [
    { slug: "Supino Reto", videoFile: "supino.mp4", posterFile: "supino.webp", durationSeconds: 15 },
  ] }), /slug/);
  assert.throws(() => parseGlobalTrainingMediaImportManifest({ apiVersion: 1, items: [
    { slug: "supino_reto", videoFile: "shared.mp4", posterFile: "shared.webp", durationSeconds: 15 },
    { slug: "crucifixo", videoFile: "shared.mp4", posterFile: "other.webp", durationSeconds: 15 },
  ] }), /file-duplicate/);
});

test("global Training media manifest accepts the controlled validation batch and enforces every boundary", () => {
  const items = [
    ["supino_reto", 12],
    ["puxada_frente", 15],
    ["desenvolvimento", 18],
    ["agachamento", 20],
    ["prancha", 30],
  ].map(([slug, durationSeconds]) => ({
    slug,
    videoFile: `${slug}.mp4`,
    posterFile: `${slug}.webp`,
    durationSeconds,
  }));
  const manifest = parseGlobalTrainingMediaImportManifest({ apiVersion: 1, items });
  assert.deepEqual(manifest.items.map((item) => item.exercisePublicId), [
    "tr_ex_global_supino_reto",
    "tr_ex_global_puxada_frente",
    "tr_ex_global_desenvolvimento",
    "tr_ex_global_agachamento",
    "tr_ex_global_prancha",
  ]);
  assert.throws(() => parseGlobalTrainingMediaImportManifest({ apiVersion: 2, items }), /manifest-shape/);
  assert.throws(() => parseGlobalTrainingMediaImportManifest({ apiVersion: 1, items: [] }), /manifest-shape/);
  assert.throws(() => parseGlobalTrainingMediaImportManifest({ apiVersion: 1, items: Array.from({ length: 25 }, (_, index) => ({ slug: `exercise_${index}`, videoFile: `video-${index}.mp4`, posterFile: `poster-${index}.webp`, durationSeconds: 10 })) }), /manifest-shape/);
  assert.throws(() => parseGlobalTrainingMediaImportManifest({ apiVersion: 1, items: [{ slug: "supino_reto", videoFile: "supino.mov", posterFile: "supino.webp", durationSeconds: 15 }] }), /videoFile/);
  assert.throws(() => parseGlobalTrainingMediaImportManifest({ apiVersion: 1, items: [{ slug: "supino_reto", videoFile: "supino.mp4", posterFile: "supino.gif", durationSeconds: 15 }] }), /posterFile/);
  assert.throws(() => parseGlobalTrainingMediaImportManifest({ apiVersion: 1, items: [{ slug: "supino_reto", videoFile: "supino.mp4", posterFile: "supino.webp", durationSeconds: 0.9 }] }), /durationSeconds/);
  assert.throws(() => parseGlobalTrainingMediaImportManifest({ apiVersion: 1, items: [{ slug: "supino_reto", videoFile: "supino.mp4", posterFile: "supino.webp", durationSeconds: 90.1 }] }), /durationSeconds/);
});

test("global Training media batch verifies MP4 H.264 and poster signatures", () => {
  const h264Mp4 = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x61, 0x76, 0x63, 0x31]);
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  assert.doesNotThrow(() => assertCuratedTrainingMediaBytes(h264Mp4, webp, "image/webp"));
  assert.throws(() => assertCuratedTrainingMediaBytes(new Uint8Array([0, 0, 0, 8, 0x66, 0x74, 0x79, 0x70]), webp, "image/webp"), /video-container|video-codec-h264/);
  assert.throws(() => assertCuratedTrainingMediaBytes(h264Mp4, new Uint8Array([0, 1, 2]), "image/webp"), /poster-signature/);
});

test("Training media accepts exact mobile limits and rejects bytes, duration and poster overflow", () => {
  const exact = {
    kind: "video" as const,
    mediaName: "demonstration.mp4",
    mediaType: "video/mp4",
    mediaBytes: 8 * 1024 * 1024,
    posterName: "poster.webp",
    posterType: "image/webp",
    posterBytes: 500 * 1024,
    durationMs: 90_000,
  };
  assert.doesNotThrow(() => assertTrainingMediaUpload(exact));
  assert.throws(() => assertTrainingMediaUpload({ ...exact, mediaBytes: exact.mediaBytes + 1 }), /video-size/);
  assert.throws(() => assertTrainingMediaUpload({ ...exact, posterBytes: exact.posterBytes + 1 }), /poster-size/);
  assert.throws(() => assertTrainingMediaUpload({ ...exact, durationMs: 90_001 }), /video-duration/);
  assert.throws(() => assertTrainingMediaUpload({ ...exact, durationMs: 999 }), /video-duration/);

  const avc3Mp4 = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x61, 0x76, 0x63, 0x33]);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xdb]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.doesNotThrow(() => assertCuratedTrainingMediaBytes(avc3Mp4, jpeg, "image/jpeg"));
  assert.doesNotThrow(() => assertCuratedTrainingMediaBytes(avc3Mp4, png, "image/png"));
  assert.throws(() => assertCuratedTrainingMediaBytes(avc3Mp4, jpeg, "image/png"), /poster-signature/);
});

test("global importer keeps R2 writes versioned, private and reversible before metadata commit", () => {
  const route = readFileSync(new URL("../app/api/admin/nutriflow/training/media/import/route.ts", import.meta.url), "utf8");
  assert.match(route, /training-media\/global\/\$\{item\.slug\}\/\$\{batchId\}/);
  assert.match(route, /env\.BUCKET\.put\(record\.objectKey/);
  assert.match(route, /env\.BUCKET\.put\(record\.posterObjectKey/);
  assert.match(route, /cacheControl:\s*"private, max-age=31536000, immutable"/);
  assert.match(route, /customMetadata:\s*\{ \.\.\.metadata, kind: "video" \}/);
  assert.match(route, /customMetadata:\s*\{ \.\.\.metadata, kind: "poster" \}/);
  assert.match(route, /if \(!metadataCommitted && uploadedKeys\.length\) await env\.BUCKET\.delete\(uploadedKeys\)/);
  assert.match(route, /repository\.importGlobalBatch\(/);
});

test("patient Training media stays demand-driven across fallback and day changes", () => {
  const viewer = readFileSync(new URL("../app/treino/training-patient-viewer.tsx", import.meta.url), "utf8");
  assert.match(viewer, /const \[showVideo, setShowVideo\] = useState\(false\)/);
  assert.match(viewer, /if \(showVideo && exercise\.mediaKind === "video"\)[^\n]*<video controls autoPlay muted playsInline loop preload="metadata" poster=\{poster\}/);
  assert.match(viewer, /<source src=\{mediaUrl\(publicationPublicId, exercise\.mediaPublicId, "video"\)\} type="video\/mp4"/);
  assert.match(viewer, /<img src=\{poster\} alt=\{`Poster de \$\{exercise\.name\}`\} loading="lazy" onError=\{\(\) => setUnavailable\(true\)\}/);
  assert.match(viewer, /if \(!exercise\.mediaPublicId \|\| unavailable\) return <div className="training-patient-placeholder"/);
  assert.match(viewer, /const day = portal\.publication\?\.content\.days\.find\(\(entry\) => entry\.weekday === selected\) \?\? null/);
  assert.match(viewer, /day\.muscleGroups\.map\(\(group\)/);
  assert.equal((viewer.match(/mediaUrl\(publicationPublicId, exercise\.mediaPublicId, "video"\)/g) ?? []).length, 2, "only the active video/GIF branches may request media bytes");
  assert.equal(viewer.includes("portal.publication?.content.days.flatMap"), false, "switching days must not flatten or preload the routine");
  assert.match(viewer, /<ExerciseMedia exercise=\{item\.exercise\} publicationPublicId=\{publicationPublicId\} \/><div className="training-patient-copy">/);
});

test("Training media delivery supports Range Requests without exposing unrelated assets", () => {
  const route = readFileSync(new URL("../app/api/treino/midia/route.ts", import.meta.url), "utf8");
  assert.match(route, /publicationReferencesTrainingMedia\(portal\.publication\.content, mediaPublicId\)/);
  assert.match(route, /findAssetForOrganization\(mediaPublicId, context\.organizationId\)/);
  assert.match(route, /request\.headers\.has\("range"\) && variant === "video"/);
  assert.match(route, /env\.BUCKET\.get\(objectKey, \{ range: request\.headers \}\)/);
  assert.match(route, /return new Response\(object\.body, \{ status: 206, headers \}\)/);
  assert.match(route, /"accept-ranges": "bytes"/);
  assert.match(route, /catch \{ return new Response\("Arquivo [^"]+ encontrado\.", \{ status: 404 \}\); \}/);
});

test("batch preflight reports approved and rejected media independently without importing", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nutriflow-training-media-"));
  try {
    const video = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x61, 0x76, 0x63, 0x31]);
    const poster = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    await Promise.all([
      writeFile(join(directory, "supino.mp4"), video),
      writeFile(join(directory, "supino.webp"), poster),
      writeFile(join(directory, "puxada.webp"), poster),
      writeFile(join(directory, "manifest.json"), JSON.stringify({ apiVersion: 1, items: [
        { slug: "supino_reto", videoFile: "supino.mp4", posterFile: "supino.webp", durationSeconds: 15 },
        { slug: "puxada_frente", videoFile: "puxada.mp4", posterFile: "puxada.webp", durationSeconds: 12 },
      ] })),
    ]);
    const report = await validateTrainingMediaBatch({
      batchDir: directory,
      catalogSlugs: new Set(["supino_reto", "puxada_frente"]),
      probe: async () => ({ codec: "h264", durationSeconds: 15 }),
    });
    assert.deepEqual(report.summary, { received: 2, recognized: 2, approved: 1, rejected: 1, maxItemsPerImport: 24, recommendedImportBatches: 1, requiresBatchSplit: false });
    assert.equal(report.items[0]?.approved, true);
    assert.deepEqual(report.items[1]?.reasons, ["video-missing"]);
    assert.deepEqual(report.importPlan, [{ batchNumber: 1, items: [{ index: 0, slug: "supino_reto", exercisePublicId: "tr_ex_global_supino_reto", videoFile: "supino.mp4", posterFile: "supino.webp" }] }]);
    assert.equal(report.aptForImport, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("batch preflight creates deterministic 24-item import groups in manifest order", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nutriflow-training-plan-"));
  try {
    const video = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x61, 0x76, 0x63, 0x31]);
    const poster = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    const items = Array.from({ length: 25 }, (_, index) => ({ slug: `exercise_${index}`, videoFile: `video-${index}.mp4`, posterFile: `poster-${index}.webp`, durationSeconds: 10 }));
    await Promise.all([
      ...items.flatMap((item) => [writeFile(join(directory, item.videoFile), video), writeFile(join(directory, item.posterFile), poster)]),
      writeFile(join(directory, "manifest.json"), JSON.stringify({ apiVersion: 1, items })),
    ]);
    const report = await validateTrainingMediaBatch({ batchDir: directory, catalogSlugs: new Set(items.map((item) => item.slug)), probe: async () => ({ codec: "h264", durationSeconds: 10 }) });
    assert.equal(report.summary.approved, 25);
    assert.equal(report.summary.requiresBatchSplit, true);
    assert.equal(report.summary.recommendedImportBatches, 2);
    assert.equal(report.importPlan[0]?.items.length, 24);
    assert.deepEqual(report.importPlan[0]?.items.map((item) => item.slug), items.slice(0, 24).map((item) => item.slug));
    assert.deepEqual(report.importPlan[1]?.items.map((item) => item.slug), ["exercise_24"]);
    assert.equal(report.aptForImport, false, "the current official importer still accepts at most 24 items per operation");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Training media association is scoped, auditable and keeps replaced blobs available to immutable snapshots", async () => {
  const database = trainingMediaDatabase();
  let sequence = 0;
  const repository = new D1TrainingMediaRepository(database, (kind) => `${kind}_${++sequence}`, () => new Date("2026-08-09T12:00:00.000Z"));
  const privateExercise = await repository.getManageableExercise({ organizationId: 1, exercisePublicId: "tr_ex_org_media_one", allowGlobal: false });
  await assert.rejects(() => repository.getManageableExercise({ organizationId: 1, exercisePublicId: "tr_ex_org_media_two", allowGlobal: false }), (error) => error instanceof NutriFlowApplicationError && error.code === "NF_FORBIDDEN");
  await assert.rejects(() => repository.getManageableExercise({ organizationId: 1, exercisePublicId: "tr_ex_global_supino_reto", allowGlobal: false }), (error) => error instanceof NutriFlowApplicationError && error.code === "NF_FORBIDDEN");
  const globalExercise = await repository.getManageableExercise({ organizationId: 1, exercisePublicId: "tr_ex_global_supino_reto", allowGlobal: true });
  assert.equal(globalExercise.scope, "global");
  const first = await repository.replace({ organizationId: 1, actorAuthUserId: "auth_owner", actorRole: "owner", exercise: privateExercise, mediaKind: "video", objectKey: "training-media/org/one.mp4", posterObjectKey: "training-media/org/one.webp", mimeType: "video/mp4", posterMimeType: "image/webp", byteSize: 512_000, posterByteSize: 24_000, durationMs: 15_000, correlationId: "corr_media_first" });
  const second = await repository.replace({ organizationId: 1, actorAuthUserId: "auth_owner", actorRole: "owner", exercise: privateExercise, mediaKind: "video", objectKey: "training-media/org/two.mp4", posterObjectKey: "training-media/org/two.webp", mimeType: "video/mp4", posterMimeType: "image/webp", byteSize: 520_000, posterByteSize: 25_000, durationMs: 16_000, correlationId: "corr_media_second" });
  assert.equal((await repository.findAsset(first.publicId))?.status, "replaced");
  assert.equal((await repository.findAsset(second.publicId))?.status, "active");
  const otherExercise = await repository.getManageableExercise({ organizationId: 2, exercisePublicId: "tr_ex_org_media_two", allowGlobal: false });
  const otherOrganizationMedia = await repository.replace({ organizationId: 2, actorAuthUserId: "auth_owner_two", actorRole: "owner", exercise: otherExercise, mediaKind: "gif", objectKey: "training-media/org/two.gif", posterObjectKey: "training-media/org/two.webp", mimeType: "image/gif", posterMimeType: "image/webp", byteSize: 300_000, posterByteSize: 25_000, durationMs: null, correlationId: "corr_media_other" });
  assert.equal(await repository.findAssetForOrganization(otherOrganizationMedia.publicId, 1), null);
  await repository.remove({ organizationId: 1, actorAuthUserId: "auth_owner", actorRole: "owner", exercise: privateExercise, correlationId: "corr_media_remove" });
  assert.equal((await repository.findAsset(second.publicId))?.status, "removed");
  assert.equal(database.sqlite.prepare("SELECT count(*) AS total FROM nf_audit_entries WHERE action LIKE 'training.exercise-media.%'").get().total, 4);
});

test("global Training media batch import is owner-only, auditable and never overwrites silently", async () => {
  const database = trainingMediaDatabase();
  let sequence = 0;
  const repository = new D1TrainingMediaRepository(database, (kind) => `${kind}_${++sequence}`, () => new Date("2026-08-09T12:00:00.000Z"));
  const targets = await repository.getGlobalImportTargets(["tr_ex_global_supino_reto", "tr_ex_global_crucifixo", "tr_ex_global_missing"]);
  assert.deepEqual(targets.map((target) => target.publicId), ["tr_ex_global_supino_reto", "tr_ex_global_crucifixo"]);
  const records = targets.map((target, index) => ({
    target,
    objectKey: `training-media/global/batch/video-${index}.mp4`,
    posterObjectKey: `training-media/global/batch/poster-${index}.webp`,
    mimeType: "video/mp4" as const,
    posterMimeType: "image/webp",
    byteSize: 500_000 + index,
    posterByteSize: 20_000 + index,
    durationMs: 15_000,
  }));
  await assert.rejects(() => repository.importGlobalBatch({ organizationId: 1, actorAuthUserId: "auth_admin", actorRole: "admin", records, overwriteExisting: false, correlationId: "corr_global_admin" }), (error) => error instanceof NutriFlowApplicationError && error.code === "NF_FORBIDDEN");
  const first = await repository.importGlobalBatch({ organizationId: 1, actorAuthUserId: "auth_owner", actorRole: "owner", records, overwriteExisting: false, correlationId: "corr_global_first" });
  assert.equal(first.length, 2);
  assert.equal(database.sqlite.prepare("SELECT count(*) AS total FROM nf_training_exercise_media WHERE status = 'active'").get().total, 2);
  assert.equal(database.sqlite.prepare("SELECT count(*) AS total FROM nf_audit_entries WHERE action = 'training.exercise-media.global-imported'").get().total, 2);
  const occupiedTargets = await repository.getGlobalImportTargets(targets.map((target) => target.publicId));
  const replacementRecords = records.map((record, index) => ({ ...record, target: occupiedTargets[index]!, objectKey: `${record.objectKey}.replacement` }));
  await assert.rejects(() => repository.importGlobalBatch({ organizationId: 1, actorAuthUserId: "auth_owner", actorRole: "owner", records: replacementRecords, overwriteExisting: false, correlationId: "corr_global_conflict" }), (error) => error instanceof NutriFlowApplicationError && error.code === "NF_VERSION_CONFLICT");
  await repository.importGlobalBatch({ organizationId: 1, actorAuthUserId: "auth_owner", actorRole: "owner", records: replacementRecords, overwriteExisting: true, correlationId: "corr_global_replace" });
  assert.equal(database.sqlite.prepare("SELECT count(*) AS total FROM nf_training_exercise_media WHERE status = 'active'").get().total, 2);
  assert.equal(database.sqlite.prepare("SELECT count(*) AS total FROM nf_training_exercise_media WHERE status = 'replaced'").get().total, 2);
});

test("programmatic admin-to-patient media flow keeps simulated R2 objects and published references immutable", async () => {
  const database = trainingMediaDatabase();
  let sequence = 0;
  const repository = new D1TrainingMediaRepository(database, (kind) => `${kind}_${++sequence}`, () => new Date("2026-08-09T12:00:00.000Z"));
  const objects = new Map<string, Readonly<{ bytes: Uint8Array; metadata: Record<string, string> }>>();
  const bucket = {
    async put(key: string, bytes: Uint8Array, metadata: Record<string, string>) { objects.set(key, Object.freeze({ bytes, metadata: Object.freeze(metadata) })); },
    async get(key: string) { return objects.get(key) ?? null; },
  };
  const manifest = parseGlobalTrainingMediaImportManifest({ apiVersion: 1, items: [
    { slug: "supino_reto", videoFile: "supino.mp4", posterFile: "supino.webp", durationSeconds: 15 },
  ] });
  const video = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x61, 0x76, 0x63, 0x31]);
  const poster = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  assertCuratedTrainingMediaBytes(video, poster, "image/webp");
  const target = (await repository.getGlobalImportTargets([manifest.items[0]!.exercisePublicId]))[0]!;
  const firstVideoKey = "training-media/global/supino_reto/batch-one/demonstration.mp4";
  const firstPosterKey = "training-media/global/supino_reto/batch-one/poster.webp";
  await Promise.all([
    bucket.put(firstVideoKey, video, { exerciseSlug: "supino_reto", kind: "video", curated: "true" }),
    bucket.put(firstPosterKey, poster, { exerciseSlug: "supino_reto", kind: "poster", curated: "true" }),
  ]);
  const [firstAsset] = await repository.importGlobalBatch({
    organizationId: 1, actorAuthUserId: "auth_owner", actorRole: "owner", overwriteExisting: false, correlationId: "corr_pipeline_first",
    records: [{ target, objectKey: firstVideoKey, posterObjectKey: firstPosterKey, mimeType: "video/mp4", posterMimeType: "image/webp", byteSize: video.byteLength, posterByteSize: poster.byteLength, durationMs: 15_000 }],
  });
  assert.equal((await bucket.get(firstVideoKey))?.metadata.kind, "video");
  assert.equal(firstAsset?.publicId, "training_media_1");

  const snapshot = { schemaVersion: 1, days: [{ weekday: "mon", muscleGroups: [{ publicId: "peito", name: "Peito", sortOrder: 0, exercises: [{ publicId: "supino", sortOrder: 0, exercise: { publicId: target.publicId, name: "Supino reto", primaryMuscleGroup: "peito", instructions: null, mediaPublicId: firstAsset!.publicId, posterObjectKey: firstPosterKey, mediaObjectKey: firstVideoKey, mediaKind: "video" }, prescription: { sets: 3, repetitions: { min: 8, max: 10 }, durationSeconds: null, restSeconds: 60, notes: null } }] }] }] };
  publishTrainingForPatient(database, 1, 10, snapshot);

  const occupied = (await repository.getGlobalImportTargets([target.publicId]))[0]!;
  const replacementVideoKey = "training-media/global/supino_reto/batch-two/demonstration.mp4";
  const replacementPosterKey = "training-media/global/supino_reto/batch-two/poster.webp";
  await Promise.all([
    bucket.put(replacementVideoKey, video, { exerciseSlug: "supino_reto", kind: "video", curated: "true" }),
    bucket.put(replacementPosterKey, poster, { exerciseSlug: "supino_reto", kind: "poster", curated: "true" }),
  ]);
  const [replacement] = await repository.importGlobalBatch({
    organizationId: 1, actorAuthUserId: "auth_owner", actorRole: "owner", overwriteExisting: true, correlationId: "corr_pipeline_replace",
    records: [{ target: occupied, objectKey: replacementVideoKey, posterObjectKey: replacementPosterKey, mimeType: "video/mp4", posterMimeType: "image/webp", byteSize: video.byteLength, posterByteSize: poster.byteLength, durationMs: 15_000 }],
  });
  assert.equal((await repository.findAsset(firstAsset!.publicId))?.status, "replaced");
  assert.equal((await repository.findAsset(replacement!.publicId))?.status, "active");
  assert.notEqual(replacement?.publicId, firstAsset?.publicId);
  assert.ok(await bucket.get(firstVideoKey), "historical R2 object must remain available");

  const portal = await new D1PatientTrainingRepository(database).findForPatient({ organizationId: 1, clientId: 10, now: new Date("2026-08-10T12:00:00.000Z") });
  const publishedExercise = portal.publication?.content.days[0]?.muscleGroups[0]?.exercises[0]?.exercise;
  assert.equal(publishedExercise?.mediaPublicId, firstAsset?.publicId);
  assert.equal(publishedExercise?.mediaObjectKey, firstVideoKey);
  assert.notEqual(publishedExercise?.mediaPublicId, replacement?.publicId);
});

test("administrative entitlement is auditable and revocation preserves Training history", async () => {
  const database = trainingEditorDatabase();
  const repository = editorRepository(database);
  const granted = await repository.configureEntitlement({ organizationId: 1, actorAuthUserId: "auth_admin", actorRole: "admin", command: { apiVersion: "v1", clientId: 10, active: true, reason: "ServiÃ§o contratado", correlationId: "corr_entitlement_grant" } });
  assert.equal(granted.entitlement.active, true);
  assert.equal(database.sqlite.prepare("SELECT count(*) AS total FROM nf_audit_entries WHERE action = 'training.entitlement.granted'").get().total, 1);

  const draft = await repository.createDraft({ organizationId: 1, clientId: 10, actorAuthUserId: "auth_admin", actorRole: "admin", correlationId: "corr_draft", patientName: "Ana" });
  assert.equal(draft.draft?.versionNumber, 1);

  const revoked = await repository.configureEntitlement({ organizationId: 1, actorAuthUserId: "auth_admin", actorRole: "admin", command: { apiVersion: "v1", clientId: 10, active: false, reason: "Pausa solicitada", correlationId: "corr_entitlement_revoke" } });
  assert.equal(revoked.entitlement.active, false);
  assert.equal(revoked.draft?.publicId, draft.draft?.publicId);
  assert.equal(database.sqlite.prepare("SELECT count(*) AS total FROM nf_training_routines").get().total, 1);
  assert.equal(database.sqlite.prepare("SELECT count(*) AS total FROM nf_audit_entries WHERE action = 'training.entitlement.revoked'").get().total, 1);
});

test("Training draft supports ordered exercises, validates prescriptions and publishes an immutable snapshot", async () => {
  const database = trainingEditorDatabase();
  const repository = editorRepository(database);
  await repository.configureEntitlement({ organizationId: 1, actorAuthUserId: "auth_admin", actorRole: "admin", command: { apiVersion: "v1", clientId: 10, active: true, reason: null, correlationId: "corr_grant" } });
  const created = await repository.createDraft({ organizationId: 1, clientId: 10, actorAuthUserId: "auth_admin", actorRole: "admin", correlationId: "corr_create", patientName: "Ana" });
  const initial = created.draft!;
  let content = addMuscleGroup(initial.content, "mon", "Peito");
  const groupId = content.days[0]!.muscleGroups[0]!.publicId;
  content = addTrainingExercise(content, "mon", groupId, editorExercise());
  content = addTrainingExercise(content, "mon", groupId, { ...editorExercise(), publicId: "tr_ex_global_crucifixo", name: "Crucifixo" });
  const firstId = content.days[0]!.muscleGroups[0]!.exercises[0]!.publicId;
  content = moveTrainingExercise(content, "mon", groupId, firstId, 1);
  assert.deepEqual(content.days[0]!.muscleGroups[0]!.exercises.map((exercise) => exercise.exercise.name), ["Crucifixo", "Supino reto"]);

  const saved = await repository.saveDraft({ organizationId: 1, clientId: 10, actorAuthUserId: "auth_admin", actorRole: "admin", command: { apiVersion: "v1", routinePublicId: initial.routinePublicId, routineVersionPublicId: initial.publicId, expectedRevision: initial.revision, title: "Treino semanal", content, correlationId: "corr_save" } });
  assert.equal(saved.draft?.revision, 2);
  const published = await repository.publish({ organizationId: 1, clientId: 10, actorAuthUserId: "auth_admin", actorRole: "admin", routinePublicId: saved.draft!.routinePublicId, routineVersionPublicId: saved.draft!.publicId, expectedRevision: saved.draft!.revision, correlationId: "corr_publish" });
  assert.equal(published.publication?.content.days[0]?.muscleGroups[0]?.exercises[0]?.exercise.name, "Crucifixo");
  assert.equal(database.sqlite.prepare("SELECT count(*) AS total FROM nf_training_publications WHERE status = 'active'").get().total, 1);
  assert.equal(database.sqlite.prepare("SELECT count(*) AS total FROM nf_outbox_events WHERE event_type = 'nutriflow.training-routine-published.v1'").get().total, 1);
  assert.throws(() => database.sqlite.exec("UPDATE nf_training_routine_versions SET snapshot_json = '{}' WHERE state = 'published'"), /NF_PUBLICATION_IMMUTABLE/);

  await repository.configureEntitlement({ organizationId: 1, actorAuthUserId: "auth_admin", actorRole: "admin", command: { apiVersion: "v1", clientId: 10, active: false, reason: "Pausa", correlationId: "corr_revoke" } });
  assert.equal(database.sqlite.prepare("SELECT count(*) AS total FROM nf_training_publications").get().total, 1);
  await repository.configureEntitlement({ organizationId: 1, actorAuthUserId: "auth_admin", actorRole: "admin", command: { apiVersion: "v1", clientId: 10, active: true, reason: "Retomado", correlationId: "corr_reactivate" } });
  const revision = await repository.createDraft({ organizationId: 1, clientId: 10, actorAuthUserId: "auth_admin", actorRole: "admin", correlationId: "corr_copy", patientName: "Ana" });
  assert.equal(revision.draft?.versionNumber, 2);
  assert.equal(revision.draft?.content.days[0]?.muscleGroups[0]?.exercises[0]?.exercise.name, "Crucifixo");
});

test("Training validation rejects empty groups and exercises without repetitions or time", () => {
  assert.throws(() => parseTrainingRoutineContentV1({ schemaVersion: 1, days: [{ weekday: "mon", muscleGroups: [{ publicId: "group", name: "Peito", sortOrder: 0, exercises: [] }] }] }), /muscleGroups.0.exercises/);
  assert.throws(() => parseTrainingRoutineContentV1({ schemaVersion: 1, days: [{ weekday: "mon", muscleGroups: [{ publicId: "group", name: "Peito", sortOrder: 0, exercises: [{ publicId: "exercise", exercise: { publicId: "catalog", name: "Supino", primaryMuscleGroup: "peito", instructions: null, posterObjectKey: null, mediaKind: null }, prescription: { sets: 3, repetitions: null, durationSeconds: null, restSeconds: 60, notes: null }, sortOrder: 0 }] }] }] }), /execution/);
});

function publishTrainingForPatient(database: TrainingDatabase, organizationId: number, clientId: number, content: unknown) {
  const sql = database.sqlite;
  sql.exec(`INSERT INTO nf_training_entitlements (public_id, organization_id, client_id, status) VALUES ('ent_${organizationId}_${clientId}', ${organizationId}, ${clientId}, 'active');
    INSERT INTO nf_training_routines (public_id, organization_id, client_id, title, created_by_auth_user_id) VALUES ('routine_${organizationId}_${clientId}', ${organizationId}, ${clientId}, 'Treino', 'auth_admin');
    INSERT INTO nf_training_routine_versions (public_id, routine_id, version_number, state, snapshot_json, created_by_auth_user_id) VALUES ('version_${organizationId}_${clientId}', (SELECT id FROM nf_training_routines WHERE public_id = 'routine_${organizationId}_${clientId}'), 1, 'published', '${JSON.stringify(content).replaceAll("'", "''")}', 'auth_admin');
    INSERT INTO nf_training_publications (public_id, organization_id, client_id, routine_id, routine_version_id, published_by_auth_user_id, published_at) VALUES ('publication_${organizationId}_${clientId}', ${organizationId}, ${clientId}, (SELECT id FROM nf_training_routines WHERE public_id = 'routine_${organizationId}_${clientId}'), (SELECT id FROM nf_training_routine_versions WHERE public_id = 'version_${organizationId}_${clientId}'), 'auth_admin', '2026-08-10T12:00:00.000Z');`);
}

test("patient Training contract resolves commercial, preparing, today and rest on the server", async () => {
  const database = trainingEditorDatabase();
  const repository = new D1PatientTrainingRepository(database);
  const monday = new Date("2026-08-10T12:00:00.000Z");
  assert.equal((await repository.findForPatient({ organizationId: 1, clientId: 10, now: monday })).card.state, "commercial");
  database.sqlite.exec("INSERT INTO nf_training_entitlements (public_id, organization_id, client_id, status) VALUES ('ent_preparing', 1, 10, 'active')");
  assert.equal((await repository.findForPatient({ organizationId: 1, clientId: 10, now: monday })).card.state, "preparing");
  database.sqlite.exec("DELETE FROM nf_training_entitlements WHERE public_id = 'ent_preparing'");
  publishTrainingForPatient(database, 1, 10, { schemaVersion: 1, days: [{ weekday: "mon", muscleGroups: [{ publicId: "group_1", name: "Peito", sortOrder: 0, exercises: [] }, { publicId: "group_2", name: "Tríceps", sortOrder: 1, exercises: [] }] }] });
  const today = await repository.findForPatient({ organizationId: 1, clientId: 10, now: monday });
  assert.deepEqual(today.card, { state: "today", title: "Treino de hoje", subtitle: "Peito • Tríceps", weekday: "mon" });
  database.sqlite.exec("UPDATE nf_training_publications SET status = 'revoked' WHERE public_id = 'publication_1_10'");
  assert.equal((await repository.findForPatient({ organizationId: 1, clientId: 10, now: monday })).card.state, "preparing");
  const restDatabase = trainingEditorDatabase();
  publishTrainingForPatient(restDatabase, 1, 10, { schemaVersion: 1, days: [] });
  const rest = await new D1PatientTrainingRepository(restDatabase).findForPatient({ organizationId: 1, clientId: 10, now: monday });
  assert.equal(rest.card.state, "rest");
});

test("patient Training never reads another organization or a suspended account", async () => {
  const database = trainingEditorDatabase();
  publishTrainingForPatient(database, 2, 20, { schemaVersion: 1, days: [{ weekday: "mon", muscleGroups: [{ publicId: "other", name: "Costas", sortOrder: 0, exercises: [] }] }] });
  const repository = new D1PatientTrainingRepository(database);
  const unseen = await repository.findForPatient({ organizationId: 1, clientId: 10, now: new Date("2026-08-10T12:00:00.000Z") });
  assert.equal(unseen.card.state, "commercial");
  const operation = new GetPatientTraining(repository);
  await assert.rejects(() => operation.execute({ actor: { kind: "patient", authUserId: "auth_suspended", clientId: 10, accountStatus: "suspended", entitlementEndsAt: null }, organizationId: 1, organizationPublicId: "org_training_editor" }), (error) => error instanceof NutriFlowApplicationError && error.code === "NF_FORBIDDEN");
});

test("patient Training reads the published snapshot after later library and media changes", async () => {
  const database = trainingEditorDatabase();
  apply(database.sqlite, "0041_nutriflow_training_media.sql");
  const snapshot = {
    schemaVersion: 1,
    days: [{
      weekday: "mon",
      muscleGroups: [{
        publicId: "peito", name: "Peito", sortOrder: 0,
        exercises: [{
          publicId: "supino", sortOrder: 0,
          exercise: {
            publicId: "tr_ex_global_supino_reto", name: "Supino reto",
            primaryMuscleGroup: "peito", instructions: "Controle a descida.",
            mediaPublicId: "training_media_original", posterObjectKey: "training-media/original/poster.webp",
            mediaObjectKey: "training-media/original/demo.mp4", mediaKind: "video",
          },
          prescription: { sets: 3, repetitions: { min: 8, max: 10 }, durationSeconds: null, restSeconds: 60, notes: null },
        }],
      }],
    }],
  };
  publishTrainingForPatient(database, 1, 10, snapshot);
  database.sqlite.exec(`UPDATE nf_training_exercises SET name = 'Supino revisado', instructions = 'Texto novo' WHERE public_id = 'tr_ex_global_supino_reto';
    INSERT INTO nf_training_exercise_media (public_id, exercise_id, media_kind, object_key, poster_object_key, mime_type, status)
    VALUES ('training_media_replacement', (SELECT id FROM nf_training_exercises WHERE public_id = 'tr_ex_global_supino_reto'), 'video', 'training-media/replacement/demo.mp4', 'training-media/replacement/poster.webp', 'video/mp4', 'active');`);

  const result = await new D1PatientTrainingRepository(database).findForPatient({ organizationId: 1, clientId: 10, now: new Date("2026-08-10T12:00:00.000Z") });
  const exercise = result.publication?.content.days[0]?.muscleGroups[0]?.exercises[0]?.exercise;
  assert.deepEqual(exercise, snapshot.days[0].muscleGroups[0].exercises[0].exercise);
});
