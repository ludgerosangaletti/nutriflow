import { env } from "cloudflare:workers";
import { NUTRIFLOW_FEATURE_FLAGS } from "../../modules/nutriflow/config/feature-flags.ts";
import { evaluateFeatureFlag } from "../../modules/nutriflow/application/feature-flags/evaluate-feature-flag.ts";
import { CreateFoodPlanDraft } from "../../modules/nutriflow/application/plans/create-food-plan-draft.ts";
import { CreateFoodPlanDraftOperation } from "../../modules/nutriflow/application/plans/create-food-plan-draft-operation.ts";
import { GetFoodPlanDraft } from "../../modules/nutriflow/application/plans/get-food-plan-draft.ts";
import { GetFoodPlanDraftOperation } from "../../modules/nutriflow/application/plans/get-food-plan-draft-operation.ts";
import { SaveFoodPlanDraft } from "../../modules/nutriflow/application/plans/save-food-plan-draft.ts";
import { SaveFoodPlanDraftOperation } from "../../modules/nutriflow/application/plans/save-food-plan-draft-operation.ts";
import { SearchFoodCatalog } from "../../modules/nutriflow/application/catalog/search-food-catalog.ts";
import { SearchFoodCatalogOperation } from "../../modules/nutriflow/application/catalog/search-food-catalog-operation.ts";
import { NutriFlowOperationRunner } from "../../modules/nutriflow/application/operations/run-nutriflow-operation.ts";
import type { NutriFlowOperationMetric } from "../../modules/nutriflow/application/observability/operation-telemetry.ts";
import type { NutriFlowActor, NutriFlowStaffRole } from "../../modules/nutriflow/application/security/authorization.ts";
import { D1FeatureFlagRepository } from "../../modules/nutriflow/infrastructure/d1/d1-feature-flag-repository.ts";
import { D1FoodPlanDraftStore } from "../../modules/nutriflow/infrastructure/d1/d1-food-plan-draft-store.ts";
import { D1FoodPlanReadRepository } from "../../modules/nutriflow/infrastructure/d1/d1-food-plan-read-repository.ts";
import { D1FoodCatalogReadRepository } from "../../modules/nutriflow/infrastructure/d1/d1-food-catalog-read-repository.ts";
import { D1ReusableContentRepository } from "../../modules/nutriflow/infrastructure/d1/d1-reusable-content-repository.ts";
import { ReusableContentOperations } from "../../modules/nutriflow/application/reusable-content/reusable-content-operations.ts";
import { D1IdempotencyRepository } from "../../modules/nutriflow/infrastructure/d1/d1-idempotency-repository.ts";
import { D1NutriFlowUnitOfWork } from "../../modules/nutriflow/infrastructure/d1/d1-unit-of-work.ts";

type MembershipRow = Readonly<{
  organization_id: number;
  organization_public_id: string;
  role: string;
}>;

export type NutriFlowAdminContext = Readonly<{
  organizationId: number;
  organizationPublicId: string;
  actor: Extract<NutriFlowActor, { kind: "staff" }>;
}>;

const staffRoles = new Set<NutriFlowStaffRole>(["owner", "admin", "nutritionist"]);

export async function resolveNutriFlowAdminContext(
  authUserId: string,
): Promise<NutriFlowAdminContext | null> {
  const row = await env.DB.prepare(
    `SELECT member.organization_id, organization.public_id AS organization_public_id, member.role
     FROM nf_organization_members AS member
     INNER JOIN nf_organizations AS organization ON organization.id = member.organization_id
     WHERE member.auth_user_id = ? AND member.status = 'active' AND organization.status = 'active'
     ORDER BY member.id ASC LIMIT 1`,
  ).bind(authUserId).first<MembershipRow>();
  if (!row || !staffRoles.has(row.role as NutriFlowStaffRole)) return null;
  const role = row.role as NutriFlowStaffRole;
  return Object.freeze({
    organizationId: row.organization_id,
    organizationPublicId: row.organization_public_id,
    actor: Object.freeze({
      kind: "staff",
      authUserId,
      organizationPublicId: row.organization_public_id,
      role,
      membershipStatus: "active",
    }),
  });
}

export async function canUseNutriFlowEditor(
  context: NutriFlowAdminContext,
  clientId: number,
) {
  const evaluation = await evaluateFeatureFlag({
    flag: NUTRIFLOW_FEATURE_FLAGS.ADMIN_EDITOR,
    context: {
      organizationId: context.organizationId,
      clientId,
      correlationId: generatePublicId("corr"),
      now: new Date(),
    },
    repository: new D1FeatureFlagRepository(env.DB),
  });
  return evaluation.enabled;
}

export async function canUseNutriFlowFeature(
  context: NutriFlowAdminContext,
  clientId: number,
  flag: (typeof NUTRIFLOW_FEATURE_FLAGS)[keyof typeof NUTRIFLOW_FEATURE_FLAGS],
) {
  const evaluation = await evaluateFeatureFlag({
    flag,
    context: { organizationId: context.organizationId, clientId, correlationId: generatePublicId("corr"), now: new Date() },
    repository: new D1FeatureFlagRepository(env.DB),
  });
  return evaluation.enabled;
}

function generatePublicId(kind: string) {
  return `${kind}_${crypto.randomUUID()}`;
}

function telemetry() {
  return {
    record(metric: NutriFlowOperationMetric) {
      console.info("[nutriflow.operation]", JSON.stringify(metric));
    },
  };
}

export function createNutriFlowAdminRuntime(context: NutriFlowAdminContext) {
  const plans = new D1FoodPlanReadRepository(env.DB);
  const reusableContentRepository = new D1ReusableContentRepository(env.DB);
  const runner = new NutriFlowOperationRunner({
    flags: new D1FeatureFlagRepository(env.DB),
    idempotency: new D1IdempotencyRepository(env.DB),
    telemetry: telemetry(),
    generateCorrelationId: () => generatePublicId("corr"),
  });
  return Object.freeze({
    getDraft: new GetFoodPlanDraftOperation({
      runner,
      getDraft: new GetFoodPlanDraft(plans),
    }),
    createDraft: new CreateFoodPlanDraftOperation({
      runner,
      createDraft: new CreateFoodPlanDraft({
        unitOfWork: new D1NutriFlowUnitOfWork(env.DB, {
          organizationId: context.organizationId,
          organizationPublicId: context.organizationPublicId,
        }),
        generatePublicId,
        environment: process.env.NODE_ENV === "production" ? "production" : "development",
      }),
    }),
    saveDraft: new SaveFoodPlanDraftOperation({
      runner,
      saveDraft: new SaveFoodPlanDraft({
        plans,
        store: new D1FoodPlanDraftStore(env.DB),
        generatePublicId,
        environment: process.env.NODE_ENV === "production" ? "production" : "development",
      }),
    }),
    searchCatalog: new SearchFoodCatalogOperation({
      runner,
      search: new SearchFoodCatalog(new D1FoodCatalogReadRepository(env.DB)),
    }),
    reusableContent: new ReusableContentOperations({
      runner,
      repository: reusableContentRepository,
      generatePublicId,
      environment: process.env.NODE_ENV === "production" ? "production" : "development",
    }),
  });
}

export async function sha256Json(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
