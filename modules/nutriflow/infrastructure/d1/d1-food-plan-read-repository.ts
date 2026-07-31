import type {
  FoodPlanDraftRecord,
  FoodPlanReadRepository,
} from "../../application/ports/food-plan-repository.ts";
import type { D1OperationDatabaseLike } from "./d1-operation-database.ts";

type DraftRow = Readonly<{
  public_id: string;
  plan_public_id: string;
  client_id: number;
  version_number: number;
  revision: number;
  state: "draft" | "in_review";
  title: string;
  notes: string | null;
  updated_at: string;
}>;

export class D1FoodPlanReadRepository implements FoodPlanReadRepository {
  private readonly database: D1OperationDatabaseLike;
  constructor(database: D1OperationDatabaseLike) {
    this.database = database;
  }

  async findLatestDraft(input: Readonly<{ organizationId: number; clientId: number }>): Promise<FoodPlanDraftRecord | null> {
    const row = await this.database
      .prepare(
        "SELECT version.public_id, plan.public_id AS plan_public_id, plan.client_id, version.version_number, version.revision, version.state, version.title, version.notes, version.updated_at FROM nf_plan_versions AS version INNER JOIN nf_plans AS plan ON plan.id = version.plan_id WHERE plan.organization_id = ? AND plan.client_id = ? AND plan.status = 'draft' AND version.state IN ('draft', 'in_review') ORDER BY version.updated_at DESC, version.id DESC LIMIT 1",
      )
      .bind(input.organizationId, input.clientId)
      .first<DraftRow>();
    if (!row) return null;
    return Object.freeze({
      publicId: row.public_id,
      planPublicId: row.plan_public_id,
      clientId: row.client_id,
      versionNumber: row.version_number,
      revision: row.revision,
      state: row.state,
      title: row.title,
      planNotes: row.notes,
      updatedAt: row.updated_at,
    });
  }
}
