import type { FoodPlanContentV1 } from "../../contracts/v1/plans.ts";
import type {
  FoodPlanDraftRecord,
  FoodPlanReadRepository,
} from "../../application/ports/food-plan-repository.ts";
import type { D1OperationDatabaseLike } from "./d1-operation-database.ts";

type DraftRow = Readonly<{ public_id: string; plan_public_id: string; client_id: number; version_number: number; revision: number; state: "draft" | "in_review"; title: string; notes: string | null; updated_at: string }>;
type DayRow = Readonly<{ public_id: string; label: string; day_index: number | null; sort_order: number }>;
type MealRow = Readonly<{ public_id: string; plan_day_public_id: string | null; title: string; scheduled_time: string | null; instructions: string | null; sort_order: number }>;
type ItemRow = Readonly<{ public_id: string; meal_public_id: string; source_type: "manual" | "food" | "recipe"; source_public_id: string | null; source_revision_number: number | null; display_name_snapshot: string; quantity_milli: number; unit_public_id: string; unit_code_snapshot: string; unit_label_snapshot: string; preparation: string | null; notes: string | null; sort_order: number }>;
type NoteRow = Readonly<{ public_id: string; meal_public_id: string | null; kind: "general" | "preparation" | "clinical" | "patient"; content: string; sort_order: number }>;

export class D1FoodPlanReadRepository implements FoodPlanReadRepository {
  private readonly database: D1OperationDatabaseLike;
  constructor(database: D1OperationDatabaseLike) { this.database = database; }

  findLatestDraft(input: Readonly<{ organizationId: number; clientId: number }>) {
    return this.findOne(input, "", []);
  }

  findDraftByVersion(input: Readonly<{ organizationId: number; clientId: number; planVersionPublicId: string }>) {
    return this.findOne(input, " AND version.public_id = ?", [input.planVersionPublicId]);
  }

  private async findOne(
    input: Readonly<{ organizationId: number; clientId: number }>,
    extraWhere: string,
    extraBindings: unknown[],
  ): Promise<FoodPlanDraftRecord | null> {
    const row = await this.database.prepare(
      `SELECT version.public_id, plan.public_id AS plan_public_id, plan.client_id, version.version_number, version.revision, version.state, version.title, version.notes, version.updated_at
       FROM nf_plan_versions AS version INNER JOIN nf_plans AS plan ON plan.id = version.plan_id
       WHERE plan.organization_id = ? AND plan.client_id = ? AND plan.status = 'draft' AND version.state IN ('draft', 'in_review')${extraWhere}
       ORDER BY version.updated_at DESC, version.id DESC LIMIT 1`,
    ).bind(input.organizationId, input.clientId, ...extraBindings).first<DraftRow>();
    if (!row) return null;

    const [daysResult, mealsResult, itemsResult, notesResult] = await Promise.all([
      this.database.prepare("SELECT public_id, label, day_index, sort_order FROM nf_plan_days WHERE plan_version_id = (SELECT id FROM nf_plan_versions WHERE public_id = ?) ORDER BY sort_order, id").bind(row.public_id).all<DayRow>(),
      this.database.prepare("SELECT meal.public_id, day.public_id AS plan_day_public_id, meal.title, meal.scheduled_time, meal.instructions, meal.sort_order FROM nf_meals AS meal LEFT JOIN nf_plan_days AS day ON day.id = meal.plan_day_id WHERE meal.plan_version_id = (SELECT id FROM nf_plan_versions WHERE public_id = ?) ORDER BY meal.sort_order, meal.id").bind(row.public_id).all<MealRow>(),
      this.database.prepare("SELECT item.public_id, meal.public_id AS meal_public_id, item.source_type, item.source_public_id, item.source_revision_number, item.display_name_snapshot, item.quantity_milli, unit.public_id AS unit_public_id, item.unit_code_snapshot, item.unit_label_snapshot, item.preparation, item.notes, item.sort_order FROM nf_meal_items AS item INNER JOIN nf_meals AS meal ON meal.id = item.meal_id INNER JOIN nf_units AS unit ON unit.id = item.unit_id WHERE meal.plan_version_id = (SELECT id FROM nf_plan_versions WHERE public_id = ?) ORDER BY item.sort_order, item.id").bind(row.public_id).all<ItemRow>(),
      this.database.prepare("SELECT note.public_id, meal.public_id AS meal_public_id, note.kind, note.content, note.sort_order FROM nf_plan_notes AS note LEFT JOIN nf_meals AS meal ON meal.id = note.meal_id WHERE note.plan_version_id = (SELECT id FROM nf_plan_versions WHERE public_id = ?) ORDER BY note.sort_order, note.id").bind(row.public_id).all<NoteRow>(),
    ]);
    const itemsByMeal = new Map<string, FoodPlanContentV1["meals"][number]["items"] extends readonly (infer T)[] ? T[] : never>();
    for (const item of itemsResult.results) {
      const items = itemsByMeal.get(item.meal_public_id) ?? [];
      items.push(Object.freeze({ publicId: item.public_id, source: Object.freeze({ type: item.source_type, publicId: item.source_public_id, revisionNumber: item.source_revision_number }), displayName: item.display_name_snapshot, quantityMilli: item.quantity_milli, unit: Object.freeze({ publicId: item.unit_public_id, code: item.unit_code_snapshot, label: item.unit_label_snapshot }), preparation: item.preparation, notes: item.notes, sortOrder: item.sort_order }));
      itemsByMeal.set(item.meal_public_id, items);
    }
    const content: FoodPlanContentV1 = Object.freeze({
      schemaVersion: 1,
      days: Object.freeze(daysResult.results.map((day) => Object.freeze({ publicId: day.public_id, label: day.label, dayIndex: day.day_index, sortOrder: day.sort_order }))),
      meals: Object.freeze(mealsResult.results.map((meal) => Object.freeze({ publicId: meal.public_id, planDayPublicId: meal.plan_day_public_id, title: meal.title, scheduledTime: meal.scheduled_time, instructions: meal.instructions, sortOrder: meal.sort_order, items: Object.freeze(itemsByMeal.get(meal.public_id) ?? []) }))),
      notes: Object.freeze(notesResult.results.map((note) => Object.freeze({ publicId: note.public_id, mealPublicId: note.meal_public_id, kind: note.kind, content: note.content, sortOrder: note.sort_order }))),
    });
    return Object.freeze({ publicId: row.public_id, planPublicId: row.plan_public_id, clientId: row.client_id, versionNumber: row.version_number, revision: row.revision, state: row.state, title: row.title, planNotes: row.notes, content, updatedAt: row.updated_at });
  }
}
