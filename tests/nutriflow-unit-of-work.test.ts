import assert from "node:assert/strict";
import test from "node:test";
import { D1NutriFlowUnitOfWork } from "../modules/nutriflow/infrastructure/d1/d1-unit-of-work.ts";
import { planDraftCreated } from "../modules/nutriflow/domain/plans/plan-events.ts";

class FakeStatement {
  values: unknown[] = [];
  readonly query: string;
  constructor(query: string) {
    this.query = query;
  }
  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }
}

class FakeDatabase {
  readonly batches: FakeStatement[][] = [];
  shouldFail = false;
  prepare(query: string) {
    return new FakeStatement(query);
  }
  async batch(statements: FakeStatement[]) {
    if (this.shouldFail) throw new Error("D1_BATCH_FAILED");
    this.batches.push(statements);
    return statements.map(() => ({}));
  }
}

const domainEvent = planDraftCreated({
  eventId: "evt_uow_01",
  aggregatePublicId: "plan_01",
  aggregateVersion: 1,
  occurredAt: "2026-07-31T12:00:00.000Z",
  actor: { authUserId: "auth_01", role: "nutritionist" },
  correlationId: "corr_01",
  metadata: {
    organizationPublicId: "org_01",
    environment: "test",
    source: "unit-test",
  },
  payload: {
    planPublicId: "plan_01",
    planVersionPublicId: "version_01",
    clientId: 1,
    title: "Plano",
  },
});

test("D1 Unit of Work commits clinical state, audit and outbox in one batch", async () => {
  const database = new FakeDatabase();
  const unitOfWork = new D1NutriFlowUnitOfWork(database, {
    organizationId: 1,
    organizationPublicId: "org_01",
  });

  await unitOfWork.run(async (transaction) => {
    transaction.plans.insertPlan({
      publicId: "plan_01",
      clientId: 1,
      title: "Plano",
      status: "draft",
      createdByAuthUserId: "auth_01",
      createdAt: "2026-07-31T12:00:00.000Z",
    });
    transaction.plans.insertPlanVersion({
      publicId: "version_01",
      planPublicId: "plan_01",
      versionNumber: 1,
      revision: 1,
      schemaVersion: 1,
      state: "draft",
      title: "Plano",
      notes: null,
      snapshotJson: null,
      contentHash: null,
      createdByAuthUserId: "auth_01",
      publishedByAuthUserId: null,
      publishedAt: null,
      createdAt: "2026-07-31T12:00:00.000Z",
    });
    transaction.audit.append({
      publicId: "audit_01",
      actorAuthUserId: "auth_01",
      actorRole: "nutritionist",
      action: "plan.draft.created",
      entityType: "food-plan",
      entityPublicId: "plan_01",
      correlationId: "corr_01",
      beforeJson: null,
      afterJson: '{"state":"draft"}',
      occurredAt: "2026-07-31T12:00:00.000Z",
    });
    transaction.enqueueDomainEvents([domainEvent]);
  });

  assert.equal(database.batches.length, 1);
  assert.equal(database.batches[0].length, 4);
  const sql = database.batches[0].map(({ query }) => query).join("\n");
  assert.match(sql, /INSERT INTO nf_plans/);
  assert.match(sql, /INSERT INTO nf_plan_versions/);
  assert.match(sql, /INSERT INTO nf_audit_entries/);
  assert.match(sql, /INSERT INTO nf_outbox_events/);
});

test("D1 Unit of Work rejects cross-organization events before commit", async () => {
  const database = new FakeDatabase();
  const unitOfWork = new D1NutriFlowUnitOfWork(database, {
    organizationId: 1,
    organizationPublicId: "org_other",
  });

  await assert.rejects(
    unitOfWork.run(async (transaction) => {
      transaction.enqueueDomainEvents([domainEvent]);
    }),
    /NUTRIFLOW_CROSS_ORGANIZATION_EVENT/,
  );
  assert.equal(database.batches.length, 0);
});

test("a D1 batch failure rejects the complete Unit of Work", async () => {
  const database = new FakeDatabase();
  database.shouldFail = true;
  const unitOfWork = new D1NutriFlowUnitOfWork(database, {
    organizationId: 1,
    organizationPublicId: "org_01",
  });

  await assert.rejects(
    unitOfWork.run(async (transaction) => {
      transaction.enqueueDomainEvents([domainEvent]);
    }),
    /D1_BATCH_FAILED/,
  );
  assert.equal(database.batches.length, 0);
});
