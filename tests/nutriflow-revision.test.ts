import assert from "node:assert/strict";
import test from "node:test";
import { CreateFoodPlanRevision } from "../modules/nutriflow/application/plans/create-food-plan-revision.ts";
import type { FoodPlanReadRepository, PublishedFoodPlanRecord } from "../modules/nutriflow/application/ports/food-plan-repository.ts";
import type { NutriFlowTransaction, NutriFlowUnitOfWork } from "../modules/nutriflow/application/ports/unit-of-work.ts";

test("a published plan is copied into a new auditable draft for adjustments", async () => {
  const published: PublishedFoodPlanRecord = Object.freeze({ publicId: "version_old", planPublicId: "plan_01", clientId: 9, versionNumber: 1, revision: 3, state: "published", title: "Plano", planNotes: "nota", updatedAt: "2026-08-01T10:00:00.000Z", content: Object.freeze({ schemaVersion: 1, days: Object.freeze([{ publicId: "day_old", label: "Dia 1", dayIndex: 1, sortOrder: 0 }]), meals: Object.freeze([{ publicId: "meal_old", planDayPublicId: "day_old", title: "Café", scheduledTime: "08:00", instructions: null, sourceTemplate: null, sortOrder: 0, items: Object.freeze([{ publicId: "item_old", source: Object.freeze({ type: "food" as const, publicId: "food_01", revisionNumber: 1 }), displayName: "Café", quantityMilli: 150000, unit: Object.freeze({ publicId: "unit_milliliter", code: "ml", label: "mililitro" }), preparation: null, notes: null, sortOrder: 0 }]) }]), notes: Object.freeze([]) }) });
  const plans: FoodPlanReadRepository = { findLatestDraft: async () => null, findDraftByVersion: async () => null, findLatestPublished: async () => published };
  const staged = { versions: [] as unknown[], days: [] as unknown[], meals: [] as unknown[], items: [] as unknown[], audits: [] as unknown[], events: [] as unknown[] };
  const unitOfWork: NutriFlowUnitOfWork = { run: async (operation) => operation({ plans: { insertPlan() {}, insertPlanVersion: (row) => staged.versions.push(row), insertPlanDay: (row) => staged.days.push(row), insertMeal: (row) => staged.meals.push(row), insertMealItem: (row) => staged.items.push(row), insertPlanNote() {} }, audit: { append: (row) => staged.audits.push(row) }, featureFlags: { insertOverride() {} }, enqueueDomainEvents: (events) => staged.events.push(...events) } satisfies NutriFlowTransaction) };
  let sequence = 0;
  const result = await new CreateFoodPlanRevision({ plans, unitOfWork, generatePublicId: (kind) => `${kind}_${++sequence}`, environment: "test", clock: () => new Date("2026-08-01T12:00:00.000Z") }).execute({ actor: { kind: "staff", authUserId: "auth_admin", organizationPublicId: "org_01", role: "nutritionist", membershipStatus: "active" }, organizationId: 1, organizationPublicId: "org_01", clientId: 9, correlationId: "corr_01" });
  assert.equal(result.versionNumber, 2);
  assert.equal(result.state, "draft");
  assert.notEqual(result.content.days[0].publicId, published.content.days[0].publicId);
  assert.notEqual(result.content.meals[0].items[0].publicId, published.content.meals[0].items[0].publicId);
  assert.equal(published.content.meals[0].items[0].publicId, "item_old");
  assert.equal(staged.versions.length, 1);
  assert.equal(staged.audits.length, 1);
  assert.equal(staged.events.length, 1);
});
