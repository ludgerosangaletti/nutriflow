import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  D1NutriFlowUnitOfWork,
  type D1PreparedStatementLike,
} from "../modules/nutriflow/infrastructure/d1/d1-unit-of-work.ts";
import { planDraftCreated } from "../modules/nutriflow/domain/plans/plan-events.ts";

class SqliteStatement implements D1PreparedStatementLike {
  readonly query: string;
  values: unknown[] = [];
  constructor(query: string) {
    this.query = query;
  }
  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }
}

class SqliteD1Database {
  readonly sqlite: DatabaseSync;

  constructor(sqlite: DatabaseSync) {
    this.sqlite = sqlite;
  }
  prepare(query: string) {
    return new SqliteStatement(query);
  }
  async batch(statements: SqliteStatement[]) {
    this.sqlite.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((statement) =>
        this.sqlite.prepare(statement.query).run(...statement.values),
      );
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
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

  assert.equal(sqlite.prepare("SELECT count(*) AS total FROM nf_plans").get().total, 1);
  assert.equal(
    sqlite.prepare("SELECT count(*) AS total FROM nf_plan_versions").get().total,
    1,
  );
  assert.equal(
    sqlite.prepare("SELECT count(*) AS total FROM nf_audit_entries").get().total,
    1,
  );
  assert.equal(
    sqlite.prepare("SELECT count(*) AS total FROM nf_outbox_events").get().total,
    1,
  );
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

  assert.equal(sqlite.prepare("SELECT count(*) AS total FROM nf_plans").get().total, 0);
});
