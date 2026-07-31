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
