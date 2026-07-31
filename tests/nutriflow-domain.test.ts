import assert from "node:assert/strict";
import test from "node:test";
import {
  NUTRIFLOW_DEFAULT_FEATURE_FLAGS,
  NUTRIFLOW_FEATURE_FLAGS,
  isNutriFlowFeatureEnabled,
} from "../modules/nutriflow/config/feature-flags.ts";
import { AggregateRoot } from "../modules/nutriflow/domain/aggregate-root.ts";
import { InMemoryDomainEventDispatcher } from "../modules/nutriflow/application/ports/domain-event-dispatcher.ts";
import {
  PLAN_DRAFT_CREATED,
  planDraftCreated,
} from "../modules/nutriflow/domain/plans/plan-events.ts";
import { serializeDomainEventForOutbox } from "../modules/nutriflow/infrastructure/outbox/serialize-domain-event.ts";

const baseEventInput = {
  eventId: "evt_01",
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
    planVersionPublicId: "plan_version_01",
    clientId: 1,
    title: "Plano inicial",
  },
} as const;

test("NutriFlow feature flags are disabled by default", () => {
  for (const enabled of Object.values(NUTRIFLOW_DEFAULT_FEATURE_FLAGS)) {
    assert.equal(enabled, false);
  }

  assert.equal(
    isNutriFlowFeatureEnabled(NUTRIFLOW_FEATURE_FLAGS.ADMIN_EDITOR),
    false,
  );
});

test("feature flags can be enabled by an explicit scoped override", () => {
  assert.equal(
    isNutriFlowFeatureEnabled(NUTRIFLOW_FEATURE_FLAGS.ADMIN_EDITOR, {
      [NUTRIFLOW_FEATURE_FLAGS.ADMIN_EDITOR]: true,
    }),
    true,
  );
});

test("a plan domain event has a versioned immutable envelope", () => {
  const event = planDraftCreated(baseEventInput);

  assert.equal(event.eventType, PLAN_DRAFT_CREATED);
  assert.equal(event.eventVersion, 1);
  assert.equal(event.aggregateType, "food-plan");
  assert.equal(Object.isFrozen(event), true);
  assert.equal(Object.isFrozen(event.payload), true);
});

test("an invalid domain event is rejected before persistence", () => {
  assert.throws(
    () => planDraftCreated({ ...baseEventInput, correlationId: "" }),
    /NUTRIFLOW_INVALID_DOMAIN_EVENT:correlationId/,
  );
});

test("aggregate events are pulled once", () => {
  class TestAggregate extends AggregateRoot {
    emit() {
      this.recordDomainEvent(planDraftCreated(baseEventInput));
    }
  }

  const aggregate = new TestAggregate();
  aggregate.emit();

  assert.equal(aggregate.peekDomainEvents().length, 1);
  assert.equal(aggregate.pullDomainEvents().length, 1);
  assert.equal(aggregate.pullDomainEvents().length, 0);
});

test("outbox serialization preserves traceability fields", () => {
  const row = serializeDomainEventForOutbox(planDraftCreated(baseEventInput));

  assert.equal(row.eventId, "evt_01");
  assert.equal(row.correlationId, "corr_01");
  assert.equal(row.status, "pending");
  assert.deepEqual(JSON.parse(row.payloadJson), baseEventInput.payload);
});

test("committed events are dispatched only through the explicit post-commit port", async () => {
  const dispatcher = new InMemoryDomainEventDispatcher();
  const received: string[] = [];
  dispatcher.subscribe(PLAN_DRAFT_CREATED, async (event) => {
    received.push(event.eventId);
  });

  assert.deepEqual(received, []);
  await dispatcher.dispatchCommitted([planDraftCreated(baseEventInput)]);
  assert.deepEqual(received, ["evt_01"]);
});
