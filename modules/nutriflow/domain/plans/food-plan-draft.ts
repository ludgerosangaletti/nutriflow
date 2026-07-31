import { AggregateRoot } from "../aggregate-root.ts";
import type {
  DomainEventActor,
  DomainEventMetadata,
} from "../events/domain-event.ts";
import {
  publicId,
  revisionToken,
  type PublicId,
  type RevisionToken,
  type VersionNumber,
} from "../shared/value-objects.ts";
import type {
  Meal,
  MealItem,
  PlanDay,
  PlanNote,
  PlanVersionState,
  PublishedFoodPlanSnapshotV1,
} from "./food-plan-content.ts";
import {
  planDraftCreated,
  planVersionPublished,
} from "./plan-events.ts";

export type DomainEventContext = Readonly<{
  eventId: string;
  occurredAt: string;
  actor: DomainEventActor;
  correlationId: string;
  causationId?: string;
  metadata: DomainEventMetadata;
}>;

export type FoodPlanDraftProps = Readonly<{
  organizationPublicId: PublicId;
  clientId: number;
  planPublicId: PublicId;
  planVersionPublicId: PublicId;
  versionNumber: VersionNumber;
  revision: RevisionToken;
  state: PlanVersionState;
  title: string;
  notes: string | null;
  days: readonly PlanDay[];
  meals: readonly Meal[];
  planNotes: readonly PlanNote[];
}>;

function requiredText(value: string, field: string) {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`NUTRIFLOW_INVALID_PLAN:${field}`);
  }
  return normalized;
}

function assertUniquePublicIds(values: readonly { publicId: PublicId }[], field: string) {
  const ids = new Set(values.map(({ publicId: value }) => value));
  if (ids.size !== values.length) {
    throw new Error(`NUTRIFLOW_INVALID_PLAN:${field}.duplicatePublicId`);
  }
}

function freezeMeal(meal: Meal): Meal {
  return Object.freeze({
    ...meal,
    items: Object.freeze(
      meal.items.map((item) =>
        Object.freeze({ ...item, source: Object.freeze({ ...item.source }) }),
      ),
    ),
    substitutions: Object.freeze(
      meal.substitutions.map((group) =>
        Object.freeze({
          ...group,
          options: Object.freeze(
            group.options.map((option) =>
              Object.freeze({
                ...option,
                source: Object.freeze({ ...option.source }),
              }),
            ),
          ),
        }),
      ),
    ),
  });
}

export class FoodPlanDraft extends AggregateRoot {
  readonly #organizationPublicId: PublicId;
  readonly #clientId: number;
  readonly #planPublicId: PublicId;
  readonly #planVersionPublicId: PublicId;
  readonly #versionNumber: VersionNumber;
  #revision: RevisionToken;
  #state: PlanVersionState;
  #title: string;
  #notes: string | null;
  #days: PlanDay[];
  #meals: Meal[];
  #planNotes: PlanNote[];

  private constructor(props: FoodPlanDraftProps) {
    super();
    if (!Number.isSafeInteger(props.clientId) || props.clientId < 1) {
      throw new Error("NUTRIFLOW_INVALID_PLAN:clientId");
    }
    assertUniquePublicIds(props.days, "days");
    assertUniquePublicIds(props.meals, "meals");
    assertUniquePublicIds(props.planNotes, "planNotes");

    this.#organizationPublicId = props.organizationPublicId;
    this.#clientId = props.clientId;
    this.#planPublicId = props.planPublicId;
    this.#planVersionPublicId = props.planVersionPublicId;
    this.#versionNumber = props.versionNumber;
    this.#revision = props.revision;
    this.#state = props.state;
    this.#title = requiredText(props.title, "title");
    this.#notes = props.notes?.trim() || null;
    this.#days = props.days.map((day) => Object.freeze({ ...day }));
    this.#meals = props.meals.map(freezeMeal);
    this.#planNotes = props.planNotes.map((note) => Object.freeze({ ...note }));
  }

  static create(
    props: Omit<FoodPlanDraftProps, "revision" | "state" | "days" | "meals" | "planNotes">,
    event: DomainEventContext,
  ) {
    const draft = new FoodPlanDraft({
      ...props,
      revision: revisionToken(1),
      state: "draft",
      days: [],
      meals: [],
      planNotes: [],
    });
    draft.recordDomainEvent(
      planDraftCreated({
        ...event,
        aggregatePublicId: props.planPublicId,
        aggregateVersion: 1,
        payload: {
          planPublicId: props.planPublicId,
          planVersionPublicId: props.planVersionPublicId,
          clientId: props.clientId,
          title: props.title,
        },
      }),
    );
    return draft;
  }

  static rehydrate(props: FoodPlanDraftProps) {
    return new FoodPlanDraft(props);
  }

  get revision(): RevisionToken {
    return this.#revision;
  }

  get state(): PlanVersionState {
    return this.#state;
  }

  private assertEditable(expectedRevision: RevisionToken) {
    if (this.#state !== "draft") {
      throw new Error("NUTRIFLOW_PLAN_NOT_EDITABLE");
    }
    if (expectedRevision !== this.#revision) {
      throw new Error("NUTRIFLOW_REVISION_CONFLICT");
    }
  }

  private advanceRevision() {
    this.#revision = revisionToken(this.#revision + 1);
  }

  rename(title: string, expectedRevision: RevisionToken) {
    this.assertEditable(expectedRevision);
    this.#title = requiredText(title, "title");
    this.advanceRevision();
  }

  addDay(day: PlanDay, expectedRevision: RevisionToken) {
    this.assertEditable(expectedRevision);
    assertUniquePublicIds([...this.#days, day], "days");
    this.#days.push(Object.freeze({ ...day }));
    this.advanceRevision();
  }

  addMeal(meal: Meal, expectedRevision: RevisionToken) {
    this.assertEditable(expectedRevision);
    requiredText(meal.title, "meal.title");
    assertUniquePublicIds([...this.#meals, meal], "meals");
    if (
      meal.planDayPublicId &&
      !this.#days.some(({ publicId: value }) => value === meal.planDayPublicId)
    ) {
      throw new Error("NUTRIFLOW_INVALID_PLAN:meal.planDayPublicId");
    }
    assertUniquePublicIds(meal.items, "meal.items");
    this.#meals.push(freezeMeal(meal));
    this.advanceRevision();
  }

  addMealItem(
    mealPublicId: PublicId,
    item: MealItem,
    expectedRevision: RevisionToken,
  ) {
    this.assertEditable(expectedRevision);
    const mealIndex = this.#meals.findIndex(({ publicId: value }) => value === mealPublicId);
    if (mealIndex < 0) {
      throw new Error("NUTRIFLOW_PLAN_MEAL_NOT_FOUND");
    }
    const meal = this.#meals[mealIndex];
    requiredText(item.displayName, "mealItem.displayName");
    assertUniquePublicIds([...meal.items, item], "meal.items");
    this.#meals[mealIndex] = freezeMeal({
      ...meal,
      items: [...meal.items, item],
    });
    this.advanceRevision();
  }

  requestReview(expectedRevision: RevisionToken) {
    this.assertEditable(expectedRevision);
    if (this.#meals.length === 0 || this.#meals.some((meal) => meal.items.length === 0)) {
      throw new Error("NUTRIFLOW_PLAN_REVIEW_BLOCKED:emptyMeal");
    }
    this.#state = "in_review";
    this.advanceRevision();
  }

  returnToDraft(expectedRevision: RevisionToken) {
    if (this.#state !== "in_review") {
      throw new Error("NUTRIFLOW_INVALID_PLAN_STATE");
    }
    if (expectedRevision !== this.#revision) {
      throw new Error("NUTRIFLOW_REVISION_CONFLICT");
    }
    this.#state = "draft";
    this.advanceRevision();
  }

  createSnapshot(): PublishedFoodPlanSnapshotV1 {
    if (this.#state !== "in_review") {
      throw new Error("NUTRIFLOW_PLAN_NOT_READY_TO_PUBLISH");
    }
    return Object.freeze({
      schemaVersion: 1,
      organizationPublicId: this.#organizationPublicId,
      clientId: this.#clientId,
      planPublicId: this.#planPublicId,
      planVersionPublicId: this.#planVersionPublicId,
      versionNumber: this.#versionNumber,
      title: this.#title,
      notes: this.#notes,
      days: Object.freeze(this.#days.map((day) => Object.freeze({ ...day }))),
      meals: Object.freeze(this.#meals.map(freezeMeal)),
      planNotes: Object.freeze(
        this.#planNotes.map((note) => Object.freeze({ ...note })),
      ),
    });
  }

  confirmPublication(input: {
    expectedRevision: RevisionToken;
    publicationPublicId: PublicId;
    contentHash: string;
    event: DomainEventContext;
  }) {
    if (this.#state !== "in_review") {
      throw new Error("NUTRIFLOW_PLAN_NOT_READY_TO_PUBLISH");
    }
    if (input.expectedRevision !== this.#revision) {
      throw new Error("NUTRIFLOW_REVISION_CONFLICT");
    }
    requiredText(input.contentHash, "contentHash");
    publicId(input.publicationPublicId);
    this.#state = "published";
    this.advanceRevision();
    this.recordDomainEvent(
      planVersionPublished({
        ...input.event,
        aggregatePublicId: this.#planPublicId,
        aggregateVersion: this.#revision,
        payload: {
          planPublicId: this.#planPublicId,
          planVersionPublicId: this.#planVersionPublicId,
          publicationPublicId: input.publicationPublicId,
          clientId: this.#clientId,
          contentHash: input.contentHash,
        },
      }),
    );
  }
}
