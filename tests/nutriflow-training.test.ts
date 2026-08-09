import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import { NUTRIFLOW_DEFAULT_FEATURE_FLAGS, NUTRIFLOW_FEATURE_FLAGS } from "../modules/nutriflow/config/feature-flags.ts";
import { parseSearchTrainingExerciseLibraryQueryV1 } from "../modules/nutriflow/contracts/v1/validation.ts";
import { assertTrainingPrescriptionMetric } from "../modules/nutriflow/domain/training/training-prescription.ts";
import { D1TrainingLibraryRepository } from "../modules/nutriflow/infrastructure/d1/d1-training-library-repository.ts";
import { D1TrainingEditorRepository } from "../modules/nutriflow/infrastructure/d1/d1-training-editor-repository.ts";
import { D1PatientTrainingRepository } from "../modules/nutriflow/infrastructure/d1/d1-patient-training-repository.ts";
import { D1TrainingMediaRepository } from "../modules/nutriflow/infrastructure/d1/d1-training-media-repository.ts";
import { GetPatientTraining } from "../modules/nutriflow/application/training/get-patient-training.ts";
import { NutriFlowApplicationError } from "../modules/nutriflow/application/errors/nutriflow-application-error.ts";
import { parseTrainingRoutineContentV1 } from "../modules/nutriflow/contracts/v1/validation.ts";
import { assertTrainingMediaUpload, publicationReferencesTrainingMedia } from "../modules/nutriflow/domain/training/training-media.ts";
import { addMuscleGroup, addTrainingExercise, moveTrainingExercise } from "../app/admin/clientes/[email]/training/training-editor-state.ts";

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
  return sqlite;
}

function trainingEditorDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON; CREATE TABLE clients (id INTEGER PRIMARY KEY, organization_id INTEGER)");
  apply(sqlite, "0020_parallel_lucky_pierre.sql");
  sqlite.exec("INSERT INTO clients (id, organization_id) VALUES (10, 1), (20, 2)");
  sqlite.exec("INSERT INTO nf_organizations (public_id, name) VALUES ('org_training_editor', 'OrganizaÃ§Ã£o Training'), ('org_training_other', 'Outra organizaÃ§Ã£o')");
  apply(sqlite, "0040_nutriflow_training_foundation.sql");
  return new TrainingDatabase(sqlite);
}

function trainingMediaDatabase() {
  const database = trainingEditorDatabase();
  apply(database.sqlite, "0041_nutriflow_training_media.sql");
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

test("Training media migration keeps bytes in object storage metadata and remains additive", () => {
  const sqlite = trainingDatabase();
  apply(sqlite, "0041_nutriflow_training_media.sql");
  const columns = sqlite.prepare("PRAGMA table_info(nf_training_exercise_media)").all() as { name: string }[];
  assert.deepEqual(columns.filter((column) => ["poster_mime_type", "byte_size", "poster_byte_size"].includes(column.name)).map((column) => column.name), ["poster_mime_type", "byte_size", "poster_byte_size"]);
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

test("Training media validates mobile-safe upload bounds and publication references", () => {
  assert.doesNotThrow(() => assertTrainingMediaUpload({ kind: "video", mediaName: "supino.mp4", mediaType: "video/mp4", mediaBytes: 512_000, posterName: "supino.webp", posterType: "image/webp", posterBytes: 24_000, durationMs: 15_000 }));
  assert.throws(() => assertTrainingMediaUpload({ kind: "video", mediaName: "supino.mov", mediaType: "video/quicktime", mediaBytes: 512_000, posterName: "supino.webp", posterType: "image/webp", posterBytes: 24_000, durationMs: 15_000 }), /video-format/);
  assert.throws(() => assertTrainingMediaUpload({ kind: "video", mediaName: "supino.mp4", mediaType: "video/mp4", mediaBytes: 512_000, posterName: "supino.gif", posterType: "image/gif", posterBytes: 24_000, durationMs: 15_000 }), /poster-format/);
  const content = parseTrainingRoutineContentV1({ schemaVersion: 1, days: [{ weekday: "mon", muscleGroups: [{ publicId: "group", name: "Peito", sortOrder: 0, exercises: [{ publicId: "exercise", exercise: { publicId: "catalog", name: "Supino", primaryMuscleGroup: "peito", instructions: null, mediaPublicId: "training_media_snapshot", posterObjectKey: "poster", mediaObjectKey: "video", mediaKind: "video" }, prescription: { sets: 3, repetitions: { min: 8, max: 10 }, durationSeconds: null, restSeconds: 60, notes: null }, sortOrder: 0 }] }] }] });
  assert.equal(publicationReferencesTrainingMedia(content, "training_media_snapshot"), true);
  assert.equal(publicationReferencesTrainingMedia(content, "training_media_other_org"), false);
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
