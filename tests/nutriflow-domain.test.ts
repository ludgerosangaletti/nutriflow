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
import { FoodPlanDraft } from "../modules/nutriflow/domain/plans/food-plan-draft.ts";
import {
  publicId,
  quantityMilli,
  revisionToken,
  sortOrder,
  unitCode,
  versionNumber,
} from "../modules/nutriflow/domain/shared/value-objects.ts";

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

function createDraft() {
  return FoodPlanDraft.create(
    {
      organizationPublicId: publicId("org_01"),
      clientId: 1,
      planPublicId: publicId("plan_01"),
      planVersionPublicId: publicId("version_01"),
      versionNumber: versionNumber(1),
      title: "Plano inicial",
      notes: null,
    },
    {
      eventId: "evt_draft_01",
      occurredAt: "2026-07-31T12:00:00.000Z",
      actor: { authUserId: "auth_01", role: "nutritionist" },
      correlationId: "corr_01",
      metadata: {
        organizationPublicId: "org_01",
        environment: "test",
        source: "unit-test",
      },
    },
  );
}

test("draft changes require the current revision token", () => {
  const draft = createDraft();
  draft.rename("Plano atualizado", revisionToken(1));

  assert.equal(draft.revision, 2);
  assert.throws(
    () => draft.rename("Conflito", revisionToken(1)),
    /NUTRIFLOW_REVISION_CONFLICT/,
  );
});

test("review rejects empty meals and published snapshots remain immutable", () => {
  const draft = createDraft();
  draft.addMeal(
    {
      publicId: publicId("meal_01"),
      planDayPublicId: null,
      title: "Café da manhã",
      scheduledTime: "08:00",
      instructions: null,
      sourceTemplatePublicId: null,
      sourceTemplateVersionNumber: null,
      sortOrder: sortOrder(0),
      items: [],
      substitutions: [],
    },
    revisionToken(1),
  );

  assert.throws(
    () => draft.requestReview(revisionToken(2)),
    /NUTRIFLOW_PLAN_REVIEW_BLOCKED:emptyMeal/,
  );

  draft.addMealItem(
    publicId("meal_01"),
    {
      publicId: publicId("item_01"),
      source: { type: "manual", publicId: null, revisionNumber: null },
      displayName: "Banana",
      quantityMilli: quantityMilli(1000),
      unitPublicId: publicId("unit_01"),
      unitCode: unitCode("un"),
      unitLabel: "unidade",
      preparation: null,
      notes: null,
      sortOrder: sortOrder(0),
    },
    revisionToken(2),
  );
  draft.requestReview(revisionToken(3));
  const snapshot = draft.createSnapshot();

  assert.equal(snapshot.meals[0].items[0].displayName, "Banana");
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.meals[0].items[0].source), true);

  draft.confirmPublication({
    expectedRevision: revisionToken(4),
    publicationPublicId: publicId("publication_01"),
    contentHash: "sha256:content",
    event: {
      eventId: "evt_publish_01",
      occurredAt: "2026-07-31T12:05:00.000Z",
      actor: { authUserId: "auth_01", role: "nutritionist" },
      correlationId: "corr_01",
      metadata: {
        organizationPublicId: "org_01",
        environment: "test",
        source: "unit-test",
      },
    },
  });

  assert.equal(draft.state, "published");
  assert.throws(
    () => draft.rename("Não permitido", revisionToken(5)),
    /NUTRIFLOW_PLAN_NOT_EDITABLE/,
  );
});

test("scaled quantities reject zero, fractions and unsafe integers", () => {
  assert.throws(() => quantityMilli(0), /NUTRIFLOW_INVALID_VALUE:quantityMilli/);
  assert.throws(() => quantityMilli(1.5), /NUTRIFLOW_INVALID_VALUE:quantityMilli/);
  assert.equal(quantityMilli(1250), 1250);
});
