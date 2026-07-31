import type {
  FeatureFlagEvaluationContext,
  FeatureFlagOverride,
  FeatureFlagRepository,
} from "../../application/ports/feature-flag-repository.ts";
import type { NutriFlowFeatureFlag } from "../../config/feature-flags.ts";
import type { D1OperationDatabaseLike } from "./d1-operation-database.ts";

type FlagRow = Readonly<{
  enabled: number;
  variant: string | null;
  organization_id: number | null;
  client_id: number | null;
  expires_at: string | null;
}>;

export class D1FeatureFlagRepository implements FeatureFlagRepository {
  private readonly database: D1OperationDatabaseLike;
  constructor(database: D1OperationDatabaseLike) {
    this.database = database;
  }

  async findOverride(
    flag: NutriFlowFeatureFlag,
    context: FeatureFlagEvaluationContext,
  ): Promise<FeatureFlagOverride | null> {
    const row = await this.database
      .prepare(
        "SELECT enabled, variant, organization_id, client_id, expires_at FROM nf_feature_flag_overrides WHERE flag_key = ? AND (expires_at IS NULL OR expires_at >= ?) AND (organization_id IS NULL OR organization_id = ?) AND (client_id IS NULL OR client_id = ?) ORDER BY CASE WHEN client_id IS NOT NULL THEN 3 WHEN organization_id IS NOT NULL THEN 2 ELSE 1 END DESC, updated_at DESC LIMIT 1",
      )
      .bind(flag, context.now.toISOString(), context.organizationId ?? null, context.clientId ?? null)
      .first<FlagRow>();
    if (!row) return null;
    return Object.freeze({
      enabled: row.enabled === 1,
      variant: row.variant,
      scope: row.client_id !== null
        ? "client"
        : row.organization_id !== null
          ? "organization"
          : "global",
      expiresAt: row.expires_at,
    });
  }
}
