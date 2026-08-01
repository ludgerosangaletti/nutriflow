import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import {
  D1NutriFlowUnitOfWork,
  type D1PreparedStatementLike,
} from "../modules/nutriflow/infrastructure/d1/d1-unit-of-work.ts";
import { planDraftCreated } from "../modules/nutriflow/domain/plans/plan-events.ts";
import { ConfigureFeatureFlagOverride } from "../modules/nutriflow/application/feature-flags/configure-feature-flag-override.ts";
import { evaluateFeatureFlag } from "../modules/nutriflow/application/feature-flags/evaluate-feature-flag.ts";
import { NUTRIFLOW_FEATURE_FLAGS } from "../modules/nutriflow/config/feature-flags.ts";
import { D1FeatureFlagRepository } from "../modules/nutriflow/infrastructure/d1/d1-feature-flag-repository.ts";
import { CreateFoodPlanDraft } from "../modules/nutriflow/application/plans/create-food-plan-draft.ts";
import { GetFoodPlanDraft } from "../modules/nutriflow/application/plans/get-food-plan-draft.ts";
import { D1FoodPlanReadRepository } from "../modules/nutriflow/infrastructure/d1/d1-food-plan-read-repository.ts";
import { CreateFoodPlanDraftOperation } from "../modules/nutriflow/application/plans/create-food-plan-draft-operation.ts";
import { NutriFlowOperationRunner } from "../modules/nutriflow/application/operations/run-nutriflow-operation.ts";
import { D1IdempotencyRepository } from "../modules/nutriflow/infrastructure/d1/d1-idempotency-repository.ts";
import { D1FoodPlanDraftStore } from "../modules/nutriflow/infrastructure/d1/d1-food-plan-draft-store.ts";
import { SaveFoodPlanDraft } from "../modules/nutriflow/application/plans/save-food-plan-draft.ts";
import { SaveFoodPlanDraftOperation } from "../modules/nutriflow/application/plans/save-food-plan-draft-operation.ts";
import { PublishFoodPlanVersion } from "../modules/nutriflow/application/plans/publish-food-plan-version.ts";
import { D1FoodPlanPublicationStore } from "../modules/nutriflow/infrastructure/d1/d1-food-plan-publication-store.ts";
import { ConfigureControlledHomologation, CONTROLLED_HOMOLOGATION_FLAGS } from "../modules/nutriflow/application/homologation/configure-controlled-homologation.ts";
import { ensurePrimaryOwnerMembership } from "../modules/nutriflow/infrastructure/d1/d1-admin-membership-bootstrap.ts";

class SqliteStatement implements D1PreparedStatementLike {
  readonly query: string;
  readonly sqlite: DatabaseSync;
  values: unknown[] = [];
  constructor(query: string, sqlite: DatabaseSync) {
    this.query = query;
    this.sqlite = sqlite;
  }
  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }
  async first<T>() {
    return (
      (this.sqlite.prepare(this.query).get(...this.sqlValues()) as T | undefined) ??
      null
    );
  }
  async all<T>() {
    return { results: this.sqlite.prepare(this.query).all(...this.sqlValues()) as T[] };
  }
  async run() {
    const result = this.sqlite.prepare(this.query).run(...this.sqlValues());
    return { meta: { changes: Number(result.changes) } };
  }
  sqlValues() {
    return this.values.map(toSqlInputValue);
  }
}

class SqliteD1Database {
  readonly sqlite: DatabaseSync;

  constructor(sqlite: DatabaseSync) {
    this.sqlite = sqlite;
  }
  prepare(query: string) {
    return new SqliteStatement(query, this.sqlite);
  }
  async batch(statements: SqliteStatement[]) {
    this.sqlite.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((statement) =>
        this.sqlite
          .prepare(statement.query)
          .run(...statement.sqlValues()),
      );
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}

function toSqlInputValue(value: unknown): SQLInputValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    ArrayBuffer.isView(value)
  ) {
    return value as SQLInputValue;
  }
  throw new Error("Unsupported SQL input value in integration test");
}

function countRows(sqlite: DatabaseSync, table: string) {
  const allowed = new Set([
    "nf_plans",
    "nf_plan_versions",
    "nf_audit_entries",
    "nf_outbox_events",
    "nf_feature_flag_overrides",
    "nf_plan_days",
    "nf_meals",
    "nf_meal_items",
    "nf_plan_notes",
    "nf_publications",
  ]);
  if (!allowed.has(table)) throw new Error("Unsupported test table");
  const row = sqlite.prepare(`SELECT count(*) AS total FROM ${table}`).get();
  if (!row || typeof row.total !== "number") throw new Error("Missing count result");
  return row.total;
}

function apply(database: DatabaseSync, migrationName: string) {
  const migration = readFileSync(
    new URL(`../drizzle/${migrationName}`, import.meta.url),
    "utf8",
  );
  for (const statement of migration
    .split("--> statement-breakpoint")
    .map((value) => value.trim())
    .filter(Boolean)) {
    database.exec(statement);
  }
}

function databaseWithNutriFlowSchema() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("CREATE TABLE clients (id INTEGER PRIMARY KEY)");
  apply(database, "0020_parallel_lucky_pierre.sql");
  apply(database, "0021_true_cerise.sql");
  database.exec(
    "INSERT INTO clients (id) VALUES (1); INSERT INTO nf_organizations (public_id, name) VALUES ('org_01', 'Organização teste')",
  );
  return database;
}

const event = planDraftCreated({
  eventId: "evt_integration_01",
  aggregatePublicId: "plan_integration_01",
  aggregateVersion: 1,
  occurredAt: "2026-07-31T12:00:00.000Z",
  actor: { authUserId: "auth_01", role: "nutritionist" },
  correlationId: "corr_integration_01",
  metadata: {
    organizationPublicId: "org_01",
    environment: "test",
    source: "integration-test",
  },
  payload: {
    planPublicId: "plan_integration_01",
    planVersionPublicId: "version_integration_01",
    clientId: 1,
    title: "Plano integração",
  },
});

test("D1 adapter persists state, audit and outbox atomically in the real schema", async () => {
  const sqlite = databaseWithNutriFlowSchema();
  const unitOfWork = new D1NutriFlowUnitOfWork(new SqliteD1Database(sqlite), {
    organizationId: 1,
    organizationPublicId: "org_01",
  });

  await unitOfWork.run(async (transaction) => {
    transaction.plans.insertPlan({
      publicId: "plan_integration_01",
      clientId: 1,
      title: "Plano integração",
      status: "draft",
      createdByAuthUserId: "auth_01",
      createdAt: "2026-07-31T12:00:00.000Z",
    });
    transaction.plans.insertPlanVersion({
      publicId: "version_integration_01",
      planPublicId: "plan_integration_01",
      versionNumber: 1,
      revision: 1,
      schemaVersion: 1,
      state: "draft",
      title: "Plano integração",
      notes: null,
      snapshotJson: null,
      contentHash: null,
      createdByAuthUserId: "auth_01",
      publishedByAuthUserId: null,
      publishedAt: null,
      createdAt: "2026-07-31T12:00:00.000Z",
    });
    transaction.audit.append({
      publicId: "audit_integration_01",
      actorAuthUserId: "auth_01",
      actorRole: "nutritionist",
      action: "plan.draft.created",
      entityType: "food-plan",
      entityPublicId: "plan_integration_01",
      correlationId: "corr_integration_01",
      beforeJson: null,
      afterJson: '{"state":"draft"}',
      occurredAt: "2026-07-31T12:00:00.000Z",
    });
    transaction.enqueueDomainEvents([event]);
  });

  assert.equal(countRows(sqlite, "nf_plans"), 1);
  assert.equal(countRows(sqlite, "nf_plan_versions"), 1);
  assert.equal(countRows(sqlite, "nf_audit_entries"), 1);
  assert.equal(countRows(sqlite, "nf_outbox_events"), 1);
});

test("official admin bootstraps the primary NutriFlow owner membership once", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON; CREATE TABLE clients (id INTEGER PRIMARY KEY)");
  apply(sqlite, "0020_parallel_lucky_pierre.sql");
  apply(sqlite, "0021_true_cerise.sql");
  const database = new SqliteD1Database(sqlite);
  const input = {
    database,
    authUserId: "auth_admin_01",
    email: "ADMIN@example.com",
    expectedAdminEmail: "admin@example.com",
    environment: "test",
    now: new Date("2026-08-01T12:00:00.000Z"),
  } as const;

  const first = await ensurePrimaryOwnerMembership(input);
  const repeated = await ensurePrimaryOwnerMembership(input);

  assert.equal(first?.role, "owner");
  assert.equal(repeated?.organization_public_id, first?.organization_public_id);
  assert.equal((sqlite.prepare("SELECT count(*) AS total FROM nf_organizations").get() as { total: number }).total, 1);
  assert.equal((sqlite.prepare("SELECT count(*) AS total FROM nf_organization_members").get() as { total: number }).total, 1);
  assert.equal((sqlite.prepare("SELECT count(*) AS total FROM nf_audit_entries WHERE action = 'organization.owner.bootstrapped'").get() as { total: number }).total, 1);
  assert.equal((sqlite.prepare("SELECT count(*) AS total FROM nf_outbox_events WHERE event_type = 'organization.owner.bootstrapped'").get() as { total: number }).total, 1);
});

test("non-admin identity cannot bootstrap a NutriFlow membership", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON; CREATE TABLE clients (id INTEGER PRIMARY KEY)");
  apply(sqlite, "0020_parallel_lucky_pierre.sql");
  const result = await ensurePrimaryOwnerMembership({
    database: new SqliteD1Database(sqlite),
    authUserId: "auth_patient_01",
    email: "patient@example.com",
    expectedAdminEmail: "admin@example.com",
    environment: "test",
  });

  assert.equal(result, null);
  assert.equal((sqlite.prepare("SELECT count(*) AS total FROM nf_organizations").get() as { total: number }).total, 0);
  assert.equal((sqlite.prepare("SELECT count(*) AS total FROM nf_organization_members").get() as { total: number }).total, 0);
});

test("a statement failure rolls back every staged D1 write", async () => {
  const sqlite = databaseWithNutriFlowSchema();
  const unitOfWork = new D1NutriFlowUnitOfWork(new SqliteD1Database(sqlite), {
    organizationId: 1,
    organizationPublicId: "org_01",
  });

  await assert.rejects(
    unitOfWork.run(async (transaction) => {
      const plan = {
        publicId: "duplicate_plan_01",
        clientId: 1,
        title: "Plano",
        status: "draft" as const,
        createdByAuthUserId: "auth_01",
        createdAt: "2026-07-31T12:00:00.000Z",
      };
      transaction.plans.insertPlan(plan);
      transaction.plans.insertPlan(plan);
    }),
  );

  assert.equal(countRows(sqlite, "nf_plans"), 0);
});

const owner = Object.freeze({
  kind: "staff" as const,
  authUserId: "auth_owner_01",
  organizationPublicId: "org_01",
  role: "owner" as const,
  membershipStatus: "active" as const,
});

test("Marco 1.1 creates and recovers an empty draft with audit and outbox atomically", async () => {
  const sqlite = databaseWithNutriFlowSchema();
  apply(sqlite, "0022_fantastic_martin_li.sql");
  const database = new SqliteD1Database(sqlite);
  sqlite.exec(
    "INSERT INTO nf_feature_flag_overrides (public_id, flag_key, organization_id, client_id, enabled, variant, reason, created_by_auth_user_id) VALUES ('flag_marco_11', 'nutriflow.editor.enabled', 1, 1, 1, 'integration-test', 'validação automatizada', 'auth_owner_01')",
  );
  const identifiers = [
    "plan_marco_11",
    "version_marco_11",
    "audit_marco_11",
    "event_marco_11",
  ];
  const create = new CreateFoodPlanDraft({
    unitOfWork: new D1NutriFlowUnitOfWork(database, {
      organizationId: 1,
      organizationPublicId: "org_01",
    }),
    generatePublicId: () => identifiers.shift() ?? "missing_id",
    clock: () => new Date("2026-07-31T16:00:00.000Z"),
    environment: "test",
  });
  const operation = new CreateFoodPlanDraftOperation({
    runner: new NutriFlowOperationRunner({
      flags: new D1FeatureFlagRepository(database),
      idempotency: new D1IdempotencyRepository(database),
      telemetry: { record: () => undefined },
      generateCorrelationId: () => "corr_marco_11_create",
      clock: () => new Date("2026-07-31T16:00:00.000Z"),
    }),
    createDraft: create,
  });
  const command = {
    actor: owner,
    organizationId: 1,
    organizationPublicId: "org_01",
    clientId: 1,
    title: "Plano alimentar inicial",
    idempotencyKey: "idem_marco_11_create",
    requestHash: "hash_marco_11_create",
  } as const;
  const first = await operation.execute(command);
  const replay = await operation.execute(command);
  const created = first.data;
  assert.deepEqual(replay, first);
  assert.equal(first.correlationId, "corr_marco_11_create");

  assert.equal(created.state, "draft");
  assert.equal(created.revision, 1);
  assert.deepEqual(created.content.meals, []);
  assert.equal(countRows(sqlite, "nf_plans"), 1);
  assert.equal(countRows(sqlite, "nf_plan_versions"), 1);
  assert.equal(countRows(sqlite, "nf_audit_entries"), 1);
  assert.equal(countRows(sqlite, "nf_outbox_events"), 1);

  const recovered = await new GetFoodPlanDraft(
    new D1FoodPlanReadRepository(database),
  ).execute({
    actor: owner,
    organizationId: 1,
    organizationPublicId: "org_01",
    clientId: 1,
    now: new Date("2026-07-31T16:01:00.000Z"),
  });
  assert.deepEqual(recovered, created);
});

test("Sprint 1 saves normalized draft content idempotently and rejects stale revisions", async () => {
  const sqlite = databaseWithNutriFlowSchema();
  apply(sqlite, "0022_fantastic_martin_li.sql");
  apply(sqlite, "0023_nutriflow_base_units.sql");
  const database = new SqliteD1Database(sqlite);
  sqlite.exec("INSERT INTO nf_feature_flag_overrides (public_id, flag_key, organization_id, client_id, enabled, reason, created_by_auth_user_id) VALUES ('flag_sprint_01', 'nutriflow.editor.enabled', 1, 1, 1, 'teste', 'auth_owner_01')");
  const createIds = ["plan_sprint_01", "version_sprint_01", "audit_sprint_create", "event_sprint_create"];
  const createOperation = new CreateFoodPlanDraftOperation({
    runner: new NutriFlowOperationRunner({ flags: new D1FeatureFlagRepository(database), idempotency: new D1IdempotencyRepository(database), telemetry: { record: () => undefined }, generateCorrelationId: () => "corr_sprint_create" }),
    createDraft: new CreateFoodPlanDraft({ unitOfWork: new D1NutriFlowUnitOfWork(database, { organizationId: 1, organizationPublicId: "org_01" }), generatePublicId: () => createIds.shift() ?? "missing_id", clock: () => new Date("2026-07-31T17:00:00.000Z"), environment: "test" }),
  });
  const created = (await createOperation.execute({ actor: owner, organizationId: 1, organizationPublicId: "org_01", clientId: 1, title: "Plano inicial", idempotencyKey: "idem_sprint_create", requestHash: "hash_sprint_create" })).data;
  const saveIds = ["event_sprint_save", "audit_sprint_save"];
  const saveOperation = new SaveFoodPlanDraftOperation({
    runner: new NutriFlowOperationRunner({ flags: new D1FeatureFlagRepository(database), idempotency: new D1IdempotencyRepository(database), telemetry: { record: () => undefined }, generateCorrelationId: () => "corr_sprint_save", clock: () => new Date("2026-07-31T17:05:00.000Z") }),
    saveDraft: new SaveFoodPlanDraft({ plans: new D1FoodPlanReadRepository(database), store: new D1FoodPlanDraftStore(database), generatePublicId: () => saveIds.shift() ?? "missing_id", clock: () => new Date("2026-07-31T17:05:00.000Z"), environment: "test" }),
  });
  const content = Object.freeze({ schemaVersion: 1 as const, days: Object.freeze([{ publicId: "day_sprint_01", label: "Dia padrão", dayIndex: 1, sortOrder: 0 }]), meals: Object.freeze([{ publicId: "meal_sprint_01", planDayPublicId: "day_sprint_01", title: "Café da manhã", scheduledTime: "08:00", instructions: null, sourceTemplate: null, sortOrder: 0, items: Object.freeze([{ publicId: "item_sprint_01", source: Object.freeze({ type: "manual" as const, publicId: null, revisionNumber: null }), displayName: "Banana", quantityMilli: 1000, unit: Object.freeze({ publicId: "unit_piece", code: "piece", label: "unidade" }), preparation: null, notes: null, sortOrder: 0 }]) }]), notes: Object.freeze([{ publicId: "note_sprint_01", mealPublicId: null, kind: "general" as const, content: "Hidratação ao longo do dia.", sortOrder: 0 }]) });
  const command = { actor: owner, organizationId: 1, organizationPublicId: "org_01", clientId: 1, command: { apiVersion: "v1" as const, planPublicId: created.planPublicId, planVersionPublicId: created.publicId, expectedRevision: 1, title: "Plano editado", planNotes: "Observação clínica", content, correlationId: "corr_sprint_save" }, idempotencyKey: "idem_sprint_save", requestHash: "hash_sprint_save" } as const;
  const saved = await saveOperation.execute(command);
  const replay = await saveOperation.execute(command);
  assert.deepEqual(replay, saved);
  assert.equal(saved.data.revision, 2);
  assert.equal(countRows(sqlite, "nf_plan_days"), 1);
  assert.equal(countRows(sqlite, "nf_meals"), 1);
  assert.equal(countRows(sqlite, "nf_meal_items"), 1);
  assert.equal(countRows(sqlite, "nf_plan_notes"), 1);
  assert.equal(countRows(sqlite, "nf_audit_entries"), 2);
  assert.equal(countRows(sqlite, "nf_outbox_events"), 2);
  const recovered = await new GetFoodPlanDraft(new D1FoodPlanReadRepository(database)).execute({ actor: owner, organizationId: 1, organizationPublicId: "org_01", clientId: 1 });
  assert.deepEqual(recovered.content, content);
  await assert.rejects(saveOperation.execute({ ...command, command: { ...command.command, correlationId: "corr_stale" }, idempotencyKey: "idem_stale", requestHash: "hash_stale" }), (error: unknown) => error instanceof Error && "code" in error && error.code === "NF_VERSION_CONFLICT");
  assert.equal(countRows(sqlite, "nf_audit_entries"), 2);
  assert.equal(countRows(sqlite, "nf_outbox_events"), 2);
  const invalidContent = { ...content, meals: [{ ...content.meals[0], items: [{ ...content.meals[0].items[0], unit: { publicId: "unit_missing", code: "missing", label: "inexistente" } }] }] };
  await assert.rejects(saveOperation.execute({ ...command, command: { ...command.command, expectedRevision: 2, content: invalidContent, correlationId: "corr_invalid_unit" }, idempotencyKey: "idem_invalid_unit", requestHash: "hash_invalid_unit" }));
  const afterRollback = await new GetFoodPlanDraft(new D1FoodPlanReadRepository(database)).execute({ actor: owner, organizationId: 1, organizationPublicId: "org_01", clientId: 1 });
  assert.equal(afterRollback.revision, 2);
  assert.deepEqual(afterRollback.content, content);
  assert.equal(countRows(sqlite, "nf_audit_entries"), 2);
  assert.equal(countRows(sqlite, "nf_outbox_events"), 2);
});

test("Sprint 5 publishes snapshot, audit and outbox atomically", async () => {
  const sqlite = databaseWithNutriFlowSchema();
  apply(sqlite, "0022_fantastic_martin_li.sql");
  apply(sqlite, "0023_nutriflow_base_units.sql");
  const database = new SqliteD1Database(sqlite);
  sqlite.exec(`
    INSERT INTO nf_plans (public_id, organization_id, client_id, title, status, created_by_auth_user_id) VALUES ('plan_publish_01', 1, 1, 'Plano para publicar', 'draft', 'auth_owner_01');
    INSERT INTO nf_plan_versions (public_id, plan_id, version_number, revision, state, title, created_by_auth_user_id) VALUES ('version_publish_01', (SELECT id FROM nf_plans WHERE public_id = 'plan_publish_01'), 1, 1, 'draft', 'Plano para publicar', 'auth_owner_01');
    INSERT INTO nf_plan_days (public_id, plan_version_id, label, day_index, sort_order) VALUES ('day_publish_01', (SELECT id FROM nf_plan_versions WHERE public_id = 'version_publish_01'), 'Dia padrão', 1, 0);
    INSERT INTO nf_meals (public_id, plan_version_id, plan_day_id, title, scheduled_time, sort_order) VALUES ('meal_publish_01', (SELECT id FROM nf_plan_versions WHERE public_id = 'version_publish_01'), (SELECT id FROM nf_plan_days WHERE public_id = 'day_publish_01'), 'Café da manhã', '08:00', 0);
    INSERT INTO nf_meal_items (public_id, meal_id, source_type, display_name_snapshot, quantity_milli, unit_id, unit_code_snapshot, unit_label_snapshot, sort_order) VALUES ('item_publish_01', (SELECT id FROM nf_meals WHERE public_id = 'meal_publish_01'), 'manual', 'Banana', 1000, (SELECT id FROM nf_units WHERE public_id = 'unit_piece'), 'piece', 'unidade', 0);
  `);
  const ids = ["publication_01", "event_publish_01", "audit_publish_01"];
  const published = await new PublishFoodPlanVersion({
    plans: new D1FoodPlanReadRepository(database),
    store: new D1FoodPlanPublicationStore(database),
    generatePublicId: () => ids.shift() ?? "missing_id",
    hashJson: async () => "sha256_publish_01",
    clock: () => new Date("2026-08-01T12:00:00.000Z"),
    environment: "test",
  }).execute({
    actor: owner,
    organizationId: 1,
    organizationPublicId: "org_01",
    clientId: 1,
    command: { apiVersion: "v1", planPublicId: "plan_publish_01", planVersionPublicId: "version_publish_01", expectedRevision: 1, correlationId: "corr_publish_01" },
  });

  assert.equal(published.publicationPublicId, "publication_01");
  assert.equal(countRows(sqlite, "nf_publications"), 1);
  assert.equal(countRows(sqlite, "nf_audit_entries"), 1);
  assert.equal(countRows(sqlite, "nf_outbox_events"), 1);
  const version = sqlite.prepare("SELECT state, revision, snapshot_json, content_hash FROM nf_plan_versions WHERE public_id = 'version_publish_01'").get();
  assert.equal(version?.state, "published");
  assert.equal(version?.revision, 3);
  assert.equal(version?.content_hash, "sha256_publish_01");
  assert.match(String(version?.snapshot_json), /Plano para publicar/);
  assert.throws(() => sqlite.prepare("UPDATE nf_plan_versions SET title = 'alterado' WHERE public_id = 'version_publish_01'").run(), /NF_PUBLICATION_IMMUTABLE/);
});

test("a test-account feature override and its audit entry commit atomically", async () => {
  const sqlite = databaseWithNutriFlowSchema();
  apply(sqlite, "0022_fantastic_martin_li.sql");
  const database = new SqliteD1Database(sqlite);
  const identifiers = ["flag_override_01", "audit_flag_01"];
  const configure = new ConfigureFeatureFlagOverride({
    unitOfWork: new D1NutriFlowUnitOfWork(database, {
      organizationId: 1,
      organizationPublicId: "org_01",
    }),
    generatePublicId: () => identifiers.shift() ?? "missing_id",
    clock: () => new Date("2026-07-31T15:00:00.000Z"),
  });
  await configure.execute({
    actor: owner,
    organizationPublicId: "org_01",
    flag: NUTRIFLOW_FEATURE_FLAGS.ADMIN_EDITOR,
    clientId: 1,
    enabled: true,
    variant: "test-account",
    reason: "Liberação controlada para a conta de validação.",
    expiresAt: "2026-08-31T15:00:00.000Z",
    correlationId: "corr_flag_config_01",
  });
  assert.equal(countRows(sqlite, "nf_feature_flag_overrides"), 1);
  assert.equal(countRows(sqlite, "nf_audit_entries"), 1);
  const evaluation = await evaluateFeatureFlag({
    flag: NUTRIFLOW_FEATURE_FLAGS.ADMIN_EDITOR,
    context: {
      organizationId: 1,
      clientId: 1,
      correlationId: "corr_flag_read_01",
      now: new Date("2026-08-01T12:00:00.000Z"),
    },
    repository: new D1FeatureFlagRepository(database),
  });
  assert.equal(evaluation.enabled, true);
  assert.equal(evaluation.scope, "client");

  const rollbackIdentifiers = ["flag_override_02", "audit_flag_02"];
  const disable = new ConfigureFeatureFlagOverride({
    unitOfWork: new D1NutriFlowUnitOfWork(database, {
      organizationId: 1,
      organizationPublicId: "org_01",
    }),
    generatePublicId: () => rollbackIdentifiers.shift() ?? "missing_id",
    clock: () => new Date("2026-08-01T13:00:00.000Z"),
  });
  await disable.execute({
    actor: owner,
    organizationPublicId: "org_01",
    flag: NUTRIFLOW_FEATURE_FLAGS.ADMIN_EDITOR,
    clientId: 1,
    enabled: false,
    variant: "rollback",
    reason: "Desligamento seguro sem remoção do histórico.",
    correlationId: "corr_flag_rollback_01",
  });
  const rolledBack = await evaluateFeatureFlag({
    flag: NUTRIFLOW_FEATURE_FLAGS.ADMIN_EDITOR,
    context: {
      organizationId: 1,
      clientId: 1,
      correlationId: "corr_flag_read_02",
      now: new Date("2026-08-01T14:00:00.000Z"),
    },
    repository: new D1FeatureFlagRepository(database),
  });
  assert.equal(rolledBack.enabled, false);
  assert.equal(rolledBack.variant, "rollback");
  assert.equal(countRows(sqlite, "nf_feature_flag_overrides"), 2);
  assert.equal(countRows(sqlite, "nf_audit_entries"), 2);
});

test("controlled homologation enables only the selected client with audit, outbox and idempotency", async () => {
  const sqlite = databaseWithNutriFlowSchema();
  apply(sqlite, "0022_fantastic_martin_li.sql");
  const database = new SqliteD1Database(sqlite);
  let sequence = 0;
  const configure = new ConfigureControlledHomologation({
    unitOfWork: new D1NutriFlowUnitOfWork(database, {
      organizationId: 1,
      organizationPublicId: "org_01",
    }),
    idempotency: new D1IdempotencyRepository(database),
    generatePublicId: (prefix) => `${prefix}_homologation_${++sequence}`,
    environment: "test",
    clock: () => new Date("2026-08-01T12:00:00.000Z"),
  });
  const input = {
    actor: owner,
    organizationId: 1,
    organizationPublicId: "org_01",
    clientId: 1,
    enabled: true,
    reason: "Homologação clínica controlada da conta teste.",
    expiresAt: "2026-08-31T12:00:00.000Z",
    confirmedTestAccount: true,
    correlationId: "corr_homologation_01",
    idempotencyKey: "homologation-key-01",
    requestHash: "sha256-homologation-01",
  } as const;
  const first = await configure.execute(input);
  const replay = await configure.execute(input);
  assert.deepEqual(replay, first);
  assert.equal(first.flagsConfigured, CONTROLLED_HOMOLOGATION_FLAGS.length);
  assert.equal(countRows(sqlite, "nf_feature_flag_overrides"), CONTROLLED_HOMOLOGATION_FLAGS.length);
  assert.equal(countRows(sqlite, "nf_audit_entries"), 1);
  assert.equal(countRows(sqlite, "nf_outbox_events"), 1);
  const configuredFlags = sqlite.prepare("SELECT flag_key, enabled, client_id, variant FROM nf_feature_flag_overrides ORDER BY flag_key").all();
  assert.equal(configuredFlags.length, CONTROLLED_HOMOLOGATION_FLAGS.length);
  assert.ok(configuredFlags.every((row) => row.enabled === 1 && row.client_id === 1 && row.variant === "controlled-homologation"));
});

test("controlled homologation rejects an unconfirmed or excessive test window", async () => {
  const sqlite = databaseWithNutriFlowSchema();
  apply(sqlite, "0022_fantastic_martin_li.sql");
  const database = new SqliteD1Database(sqlite);
  const configure = new ConfigureControlledHomologation({
    unitOfWork: new D1NutriFlowUnitOfWork(database, { organizationId: 1, organizationPublicId: "org_01" }),
    idempotency: new D1IdempotencyRepository(database),
    generatePublicId: (prefix) => `${prefix}_${crypto.randomUUID()}`,
    environment: "test",
    clock: () => new Date("2026-08-01T12:00:00.000Z"),
  });
  await assert.rejects(configure.execute({
    actor: owner,
    organizationId: 1,
    organizationPublicId: "org_01",
    clientId: 1,
    enabled: true,
    reason: "Conta sem confirmação explícita para homologação.",
    expiresAt: "2026-08-31T12:00:00.000Z",
    confirmedTestAccount: false,
    correlationId: "corr_homologation_invalid",
    idempotencyKey: "homologation-invalid",
    requestHash: "sha256-invalid",
  }), /inválidos/);
  assert.equal(countRows(sqlite, "nf_feature_flag_overrides"), 0);
  assert.equal(countRows(sqlite, "nf_audit_entries"), 0);
  assert.equal(countRows(sqlite, "nf_outbox_events"), 0);
});

test("a feature override failure leaves neither configuration nor audit", async () => {
  const sqlite = databaseWithNutriFlowSchema();
  apply(sqlite, "0022_fantastic_martin_li.sql");
  sqlite.exec(
    "INSERT INTO nf_feature_flag_overrides (public_id, flag_key, organization_id, client_id, enabled, reason, created_by_auth_user_id) VALUES ('flag_duplicate_01', 'nutriflow.editor.enabled', 1, 1, 0, 'registro preexistente', 'auth_owner_01')",
  );
  const identifiers = ["flag_duplicate_01", "audit_should_rollback_01"];
  const configure = new ConfigureFeatureFlagOverride({
    unitOfWork: new D1NutriFlowUnitOfWork(new SqliteD1Database(sqlite), {
      organizationId: 1,
      organizationPublicId: "org_01",
    }),
    generatePublicId: () => identifiers.shift() ?? "missing_id",
    clock: () => new Date("2026-07-31T15:00:00.000Z"),
  });
  await assert.rejects(
    configure.execute({
      actor: owner,
      organizationPublicId: "org_01",
      flag: NUTRIFLOW_FEATURE_FLAGS.ADMIN_EDITOR,
      clientId: 1,
      enabled: true,
      reason: "Tentativa que precisa falhar atomicamente.",
      correlationId: "corr_flag_config_02",
    }),
  );
  assert.equal(countRows(sqlite, "nf_feature_flag_overrides"), 1);
  assert.equal(countRows(sqlite, "nf_audit_entries"), 0);
});
