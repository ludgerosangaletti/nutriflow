import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import { executeIdempotently } from "../modules/nutriflow/application/idempotency/execute-idempotently.ts";
import { evaluateFeatureFlag } from "../modules/nutriflow/application/feature-flags/evaluate-feature-flag.ts";
import { ReliableDomainEventDispatcher } from "../modules/nutriflow/application/events/reliable-domain-event-dispatcher.ts";
import { OutboxProcessor } from "../modules/nutriflow/application/events/process-outbox.ts";
import { NUTRIFLOW_FEATURE_FLAGS } from "../modules/nutriflow/config/feature-flags.ts";
import { planDraftCreated } from "../modules/nutriflow/domain/plans/plan-events.ts";
import { D1IdempotencyRepository } from "../modules/nutriflow/infrastructure/d1/d1-idempotency-repository.ts";
import { D1FeatureFlagRepository } from "../modules/nutriflow/infrastructure/d1/d1-feature-flag-repository.ts";
import {
  D1EventConsumptionRepository,
  D1OutboxRepository,
} from "../modules/nutriflow/infrastructure/d1/d1-outbox-repository.ts";
import {
  D1NutriFlowUnitOfWork,
  type D1PreparedStatementLike,
} from "../modules/nutriflow/infrastructure/d1/d1-unit-of-work.ts";

class SqliteStatement implements D1PreparedStatementLike {
  values: unknown[] = [];
  readonly query: string;
  private readonly sqlite: DatabaseSync;
  constructor(query: string, sqlite: DatabaseSync) {
    this.query = query;
    this.sqlite = sqlite;
  }
  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }
  async first<T>() {
    return (this.sqlite.prepare(this.query).get(...this.sqlValues()) as T | undefined) ?? null;
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
        this.sqlite.prepare(statement.query).run(...statement.sqlValues()),
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
  ) return value as SQLInputValue;
  throw new Error("Unsupported SQL value");
}

function apply(database: DatabaseSync, migrationName: string) {
  const migration = readFileSync(new URL(`../drizzle/${migrationName}`, import.meta.url), "utf8");
  for (const statement of migration.split("--> statement-breakpoint").map((v) => v.trim()).filter(Boolean)) {
    database.exec(statement);
  }
}

function setup() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON; CREATE TABLE clients (id INTEGER PRIMARY KEY)");
  apply(sqlite, "0020_parallel_lucky_pierre.sql");
  apply(sqlite, "0021_true_cerise.sql");
  apply(sqlite, "0022_fantastic_martin_li.sql");
  sqlite.exec(
    "INSERT INTO clients (id) VALUES (1); INSERT INTO nf_organizations (public_id, name) VALUES ('org_01', 'Org')",
  );
  return { sqlite, database: new SqliteD1Database(sqlite) };
}

test("persisted idempotency replays a completed response without executing twice", async () => {
  const { database } = setup();
  const repository = new D1IdempotencyRepository(database);
  let executions = 0;
  const input = {
    repository,
    organizationId: 1,
    operation: "plan.create",
    idempotencyKey: "idem_01",
    requestHash: "hash_01",
    correlationId: "corr_01",
    now: new Date("2026-07-31T12:00:00.000Z"),
    deserialize: (value: string) => JSON.parse(value) as { planId: string },
    execute: async () => ({ planId: `plan_${++executions}` }),
  };
  assert.deepEqual(await executeIdempotently(input), { planId: "plan_1" });
  assert.deepEqual(await executeIdempotently(input), { planId: "plan_1" });
  assert.equal(executions, 1);
});

test("persisted idempotency rejects reuse with a different request", async () => {
  const { database } = setup();
  const repository = new D1IdempotencyRepository(database);
  await repository.begin({
    organizationId: 1,
    operation: "plan.create",
    idempotencyKey: "idem_02",
    requestHash: "hash_a",
    correlationId: "corr_a",
    expiresAt: "2026-08-01T12:00:00.000Z",
    now: "2026-07-31T12:00:00.000Z",
  });
  await assert.rejects(
    executeIdempotently({
      repository,
      organizationId: 1,
      operation: "plan.create",
      idempotencyKey: "idem_02",
      requestHash: "hash_b",
      correlationId: "corr_b",
      now: new Date("2026-07-31T12:01:00.000Z"),
      deserialize: JSON.parse,
      execute: async () => ({ ok: true }),
    }),
    (error: unknown) => error instanceof Error && error.message.includes("idempotência"),
  );
});

test("feature flags resolve client before organization and remain off by default", async () => {
  const { sqlite, database } = setup();
  sqlite.exec(
    "INSERT INTO nf_feature_flag_overrides (public_id, flag_key, organization_id, client_id, enabled, reason, created_by_auth_user_id) VALUES ('flag_org', 'nutriflow.editor.enabled', 1, NULL, 0, 'controle', 'auth_01'), ('flag_client', 'nutriflow.editor.enabled', 1, 1, 1, 'conta teste', 'auth_01')",
  );
  const repository = new D1FeatureFlagRepository(database);
  const enabled = await evaluateFeatureFlag({
    flag: NUTRIFLOW_FEATURE_FLAGS.ADMIN_EDITOR,
    context: { organizationId: 1, clientId: 1, correlationId: "corr_flag", now: new Date() },
    repository,
  });
  assert.equal(enabled.enabled, true);
  assert.equal(enabled.scope, "client");
  const defaultOff = await evaluateFeatureFlag({
    flag: NUTRIFLOW_FEATURE_FLAGS.PATIENT_STRUCTURED_PLAN,
    context: { organizationId: 1, clientId: 1, correlationId: "corr_flag", now: new Date() },
    repository,
  });
  assert.equal(defaultOff.enabled, false);
  assert.equal(defaultOff.source, "default");
});

test("outbox delivery is leased and each consumer is idempotent", async () => {
  const { database, sqlite } = setup();
  const event = planDraftCreated({
    eventId: "evt_dispatch_01",
    aggregatePublicId: "plan_dispatch_01",
    aggregateVersion: 1,
    occurredAt: "2026-07-31T12:00:00.000Z",
    actor: { authUserId: "auth_01", role: "nutritionist" },
    correlationId: "corr_dispatch_01",
    metadata: { organizationPublicId: "org_01", environment: "test", source: "test" },
    payload: {
      planPublicId: "plan_dispatch_01",
      planVersionPublicId: "version_dispatch_01",
      clientId: 1,
      title: "Plano",
    },
  });
  const unitOfWork = new D1NutriFlowUnitOfWork(database, {
    organizationId: 1,
    organizationPublicId: "org_01",
  });
  await unitOfWork.run(async (transaction) => transaction.enqueueDomainEvents([event]));

  let handled = 0;
  let sequence = 0;
  const dispatcher = new ReliableDomainEventDispatcher(
    new D1EventConsumptionRepository(database),
    [{ consumerName: "projection.status", eventType: event.eventType, handle: async () => { handled += 1; } }],
    () => `consumer_lease_${++sequence}`,
  );
  const processor = new OutboxProcessor(
    new D1OutboxRepository(database),
    dispatcher,
    () => `outbox_lease_${++sequence}`,
  );
  assert.equal((await processor.processNext(new Date("2026-07-31T12:00:01.000Z"))).outcome, "processed");
  assert.equal(handled, 1);

  sqlite.exec("UPDATE nf_outbox_events SET status = 'retry', available_at = '2026-07-31T12:01:00.000Z', processed_at = NULL WHERE event_id = 'evt_dispatch_01'");
  assert.equal((await processor.processNext(new Date("2026-07-31T12:01:01.000Z"))).outcome, "processed");
  assert.equal(handled, 1);
});

test("outbox skips malformed legacy rows without changing or retrying them", async () => {
  const { database, sqlite } = setup();
  sqlite.exec(
    `INSERT INTO nf_outbox_events (event_id, organization_id, event_type, event_version, aggregate_type, aggregate_public_id, aggregate_version, actor_auth_user_id, correlation_id, occurred_at, payload_json, metadata_json, status, attempts, available_at)
     VALUES
       ('evt_invalid_01', 1, 'energy-expenditure.calculated', 1, 'energy-expenditure-calculation', 'energy_01', 1, 'auth_01', 'corr_invalid_01', '2026-07-31T11:59:00.000Z', '{"publicId":"energy_01"}', '{"source":"admin-clinical-calculator"}', 'pending', 0, '2026-07-31T11:59:00.000Z'),
       ('evt_valid_01', 1, 'plan.draft.created', 1, 'food-plan', 'plan_valid_01', 1, 'auth_01', 'corr_valid_01', '2026-07-31T12:00:00.000Z', '{"planPublicId":"plan_valid_01"}', '{"organizationPublicId":"org_01","environment":"test","source":"test"}', 'pending', 0, '2026-07-31T12:00:00.000Z')`,
  );

  const claimed = await new D1OutboxRepository(database).claimNext({
    now: "2026-07-31T12:00:01.000Z",
    staleBefore: "2026-07-31T11:55:01.000Z",
    leaseToken: "outbox_valid_lease",
  });

  assert.equal(claimed?.event.eventId, "evt_valid_01");
  const malformed = sqlite.prepare("SELECT status, attempts FROM nf_outbox_events WHERE event_id = 'evt_invalid_01'").get();
  assert.equal(malformed?.status, "pending");
  assert.equal(malformed?.attempts, 0);
});

test("outbox schedules retry and isolates permanent failure in dead letter", async () => {
  const { database, sqlite } = setup();
  sqlite.exec(
    "INSERT INTO nf_outbox_events (event_id, organization_id, event_type, event_version, aggregate_type, aggregate_public_id, aggregate_version, actor_auth_user_id, correlation_id, occurred_at, payload_json, metadata_json, status, attempts, available_at) VALUES ('evt_fail_01', 1, 'plan.draft.created', 1, 'food-plan', 'plan_01', 1, 'auth_01', 'corr_01', '2026-07-31T12:00:00.000Z', '{\"planPublicId\":\"plan_01\"}', '{\"organizationPublicId\":\"org_01\",\"environment\":\"test\",\"source\":\"test\"}', 'pending', 0, '2026-07-31T12:00:00.000Z')",
  );
  let sequence = 0;
  const dispatcher = new ReliableDomainEventDispatcher(
    new D1EventConsumptionRepository(database),
    [{ consumerName: "failing.consumer", eventType: "plan.draft.created", handle: async () => { throw new Error("provider detail"); } }],
    () => `consumer_fail_${++sequence}`,
  );
  const processor = new OutboxProcessor(
    new D1OutboxRepository(database),
    dispatcher,
    () => `outbox_fail_${++sequence}`,
    2,
  );
  assert.equal((await processor.processNext(new Date("2026-07-31T12:00:01.000Z"))).outcome, "retry-scheduled");
  assert.equal((await processor.processNext(new Date("2026-07-31T12:01:02.000Z"))).outcome, "dead-letter");
  const row = sqlite.prepare("SELECT status, last_error FROM nf_outbox_events WHERE event_id = 'evt_fail_01'").get();
  assert.equal(row?.status, "dead_letter");
  assert.equal(row?.last_error, "NF_OUTBOX_DISPATCH_FAILED");
});
