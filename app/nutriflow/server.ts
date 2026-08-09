import { env } from "cloudflare:workers";
import { NUTRIFLOW_FEATURE_FLAGS } from "../../modules/nutriflow/config/feature-flags.ts";
import { evaluateFeatureFlag } from "../../modules/nutriflow/application/feature-flags/evaluate-feature-flag.ts";
import { CreateFoodPlanDraft } from "../../modules/nutriflow/application/plans/create-food-plan-draft.ts";
import { CreateFoodPlanDraftOperation } from "../../modules/nutriflow/application/plans/create-food-plan-draft-operation.ts";
import { CreateFoodPlanRevision } from "../../modules/nutriflow/application/plans/create-food-plan-revision.ts";
import { CreateFoodPlanRevisionOperation } from "../../modules/nutriflow/application/plans/create-food-plan-revision-operation.ts";
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
import { D1PatientPortalRepository } from "../../modules/nutriflow/infrastructure/d1/d1-patient-portal-repository.ts";
import { D1PatientPortalViewRecorder } from "../../modules/nutriflow/infrastructure/d1/d1-patient-portal-view-recorder.ts";
import { GetPatientPortal } from "../../modules/nutriflow/application/portal/get-patient-portal.ts";
import { PublishFoodPlanVersion } from "../../modules/nutriflow/application/plans/publish-food-plan-version.ts";
import { PublishFoodPlanVersionOperation } from "../../modules/nutriflow/application/plans/publish-food-plan-version-operation.ts";
import { D1FoodPlanPublicationStore } from "../../modules/nutriflow/infrastructure/d1/d1-food-plan-publication-store.ts";
import { D1TrainingEditorRepository } from "../../modules/nutriflow/infrastructure/d1/d1-training-editor-repository.ts";
import { D1PatientTrainingRepository } from "../../modules/nutriflow/infrastructure/d1/d1-patient-training-repository.ts";
import { GetPatientTraining } from "../../modules/nutriflow/application/training/get-patient-training.ts";
import {
  ConfigureControlledHomologation,
  CONTROLLED_HOMOLOGATION_FLAGS,
} from "../../modules/nutriflow/application/homologation/configure-controlled-homologation.ts";
import type {
  ControlledHomologationSnapshotV1,
  HomologationStepV1,
} from "../../modules/nutriflow/contracts/v1/homologation.ts";
import {
  ensurePrimaryOwnerMembership,
  resolveNutriFlowStaffMembership,
} from "../../modules/nutriflow/infrastructure/d1/d1-admin-membership-bootstrap.ts";

export type NutriFlowAdminContext = Readonly<{
  organizationId: number;
  organizationPublicId: string;
  actor: Extract<NutriFlowActor, { kind: "staff" }>;
}>;

type PatientContextRow = Readonly<{
  client_id: number;
  name: string;
  modality: string;
  payment_status: string;
  access_expires_at: string | null;
  organization_id: number;
  organization_public_id: string;
}>;

export type NutriFlowPatientContext = Readonly<{
  organizationId: number;
  organizationPublicId: string;
  patientName: string;
  modality: "online" | "in_person";
  actor: Extract<NutriFlowActor, { kind: "patient" }>;
}>;

const staffRoles = new Set<NutriFlowStaffRole>(["owner", "admin", "nutritionist"]);

export async function resolveNutriFlowAdminContext(
  authUserId: string,
): Promise<NutriFlowAdminContext | null> {
  const row = await resolveNutriFlowStaffMembership(env.DB, authUserId);
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

export async function ensureNutriFlowAdminContext(input: Readonly<{
  authUserId: string;
  email: string;
}>): Promise<NutriFlowAdminContext | null> {
  const row = await ensurePrimaryOwnerMembership({
    database: env.DB,
    authUserId: input.authUserId,
    email: input.email,
    expectedAdminEmail: env.ADMIN_EMAIL,
    environment: process.env.NODE_ENV === "production" ? "production" : "development",
  });
  if (!row || !staffRoles.has(row.role as NutriFlowStaffRole)) return null;
  const role = row.role as NutriFlowStaffRole;
  return Object.freeze({
    organizationId: row.organization_id,
    organizationPublicId: row.organization_public_id,
    actor: Object.freeze({
      kind: "staff",
      authUserId: input.authUserId,
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

export async function resolveNutriFlowPatientContext(
  authUserId: string,
): Promise<NutriFlowPatientContext | null> {
  const row = await env.DB.prepare(
    `SELECT client.id AS client_id, client.name, client.modality, client.payment_status,
       client.access_expires_at, organization.id AS organization_id,
       organization.public_id AS organization_public_id
     FROM clients AS client
     LEFT JOIN nf_plans AS plan ON plan.client_id = client.id
     INNER JOIN nf_organizations AS organization ON organization.id = COALESCE(client.organization_id, plan.organization_id)
     WHERE client.auth_user_id = ? AND organization.status = 'active'
     ORDER BY CASE WHEN plan.status = 'published' THEN 0 ELSE 1 END, plan.updated_at DESC, plan.id DESC
     LIMIT 1`,
  ).bind(authUserId).first<PatientContextRow>();
  if (!row || !["online", "in_person"].includes(row.modality)) return null;
  return Object.freeze({
    organizationId: row.organization_id,
    organizationPublicId: row.organization_public_id,
    patientName: row.name,
    modality: row.modality as "online" | "in_person",
    actor: Object.freeze({
      kind: "patient",
      authUserId,
      clientId: row.client_id,
      accountStatus: row.payment_status === "approved" ? "active" : "suspended",
      entitlementEndsAt: row.access_expires_at,
    }),
  });
}

export async function canUseNutriFlowPatientPortal(
  context: NutriFlowPatientContext,
) {
  const evaluation = await evaluateFeatureFlag({
    flag: NUTRIFLOW_FEATURE_FLAGS.PATIENT_STRUCTURED_PLAN,
    context: {
      organizationId: context.organizationId,
      clientId: context.actor.clientId,
      correlationId: generatePublicId("corr"),
      now: new Date(),
    },
    repository: new D1FeatureFlagRepository(env.DB),
  });
  return evaluation.enabled;
}

const homologationFlagLabels = Object.freeze({
  [NUTRIFLOW_FEATURE_FLAGS.ADMIN_EDITOR]: "Editor NutriFlow",
  [NUTRIFLOW_FEATURE_FLAGS.GLOBAL_CATALOG]: "Biblioteca Global",
  [NUTRIFLOW_FEATURE_FLAGS.MEAL_TEMPLATES]: "Meal Templates",
  [NUTRIFLOW_FEATURE_FLAGS.RECIPES]: "Receitas",
  [NUTRIFLOW_FEATURE_FLAGS.PATIENT_STRUCTURED_PLAN]: "Portal do Paciente",
});

type HomologationProgressRow = Readonly<{
  consultation_complete: number;
  anamnesis_complete: number;
  plan_complete: number;
  meal_template_complete: number;
  recipe_complete: number;
  publication_complete: number;
  portal_view_complete: number;
  physical_assessment_complete: number;
  checkin_complete: number;
}>;

export async function getControlledHomologationSnapshot(
  context: NutriFlowAdminContext,
  client: Readonly<{
    id: number;
    email: string;
    paymentStatus: string;
    accessExpiresAt: string | null;
  }>,
): Promise<ControlledHomologationSnapshotV1> {
  const now = new Date();
  const repository = new D1FeatureFlagRepository(env.DB);
  const flags = await Promise.all(CONTROLLED_HOMOLOGATION_FLAGS.map(async (flag) => {
    const evaluation = await evaluateFeatureFlag({
      flag,
      context: {
        organizationId: context.organizationId,
        clientId: client.id,
        correlationId: generatePublicId("corr"),
        now,
      },
      repository,
    });
    return Object.freeze({
      flag,
      label: homologationFlagLabels[flag],
      enabled: evaluation.enabled,
      variant: evaluation.variant,
      source: evaluation.source,
      scope: evaluation.scope,
      expiresAt: evaluation.expiresAt,
    });
  }));
  const progress = await env.DB.prepare(`SELECT
      CASE WHEN client.payment_status = 'approved' AND (client.access_expires_at IS NULL OR client.access_expires_at >= ?) THEN 1 ELSE 0 END AS consultation_complete,
      CASE WHEN EXISTS (SELECT 1 FROM anamneses WHERE client_email = client.email AND status = 'submitted') THEN 1 ELSE 0 END AS anamnesis_complete,
      CASE WHEN EXISTS (SELECT 1 FROM nf_plans WHERE organization_id = ? AND client_id = client.id) THEN 1 ELSE 0 END AS plan_complete,
      CASE WHEN EXISTS (SELECT 1 FROM nf_meal_templates WHERE organization_id = ? AND status = 'active') THEN 1 ELSE 0 END AS meal_template_complete,
      CASE WHEN EXISTS (SELECT 1 FROM nf_recipes WHERE organization_id = ? AND status = 'active') THEN 1 ELSE 0 END AS recipe_complete,
      CASE WHEN EXISTS (SELECT 1 FROM nf_publications WHERE organization_id = ? AND client_id = client.id AND status = 'active') THEN 1 ELSE 0 END AS publication_complete,
      CASE WHEN EXISTS (SELECT 1 FROM nf_audit_entries WHERE organization_id = ? AND action = 'patient-portal.viewed' AND entity_type = 'publication' AND json_extract(after_json, '$.clientId') = client.id) THEN 1 ELSE 0 END AS portal_view_complete,
      CASE WHEN EXISTS (SELECT 1 FROM patient_documents WHERE client_email = client.email AND document_type = 'physical_assessment' AND is_current = 1) THEN 1 ELSE 0 END AS physical_assessment_complete,
      CASE WHEN EXISTS (SELECT 1 FROM check_ins WHERE client_email = client.email) THEN 1 ELSE 0 END AS checkin_complete
    FROM clients AS client WHERE client.id = ? LIMIT 1`)
    .bind(
      now.toISOString(),
      context.organizationId,
      context.organizationId,
      context.organizationId,
      context.organizationId,
      context.organizationId,
      client.id,
    ).first<HomologationProgressRow>();
  const value = progress ?? {
    consultation_complete: 0,
    anamnesis_complete: 0,
    plan_complete: 0,
    meal_template_complete: 0,
    recipe_complete: 0,
    publication_complete: 0,
    portal_view_complete: 0,
    physical_assessment_complete: 0,
    checkin_complete: 0,
  };
  const steps: readonly HomologationStepV1[] = Object.freeze([
    step("consultation", "Consulta e acesso", value.consultation_complete, "Pagamento e vigência ativos."),
    step("anamnesis", "Anamnese", value.anamnesis_complete, client.email && value.anamnesis_complete && client.id ? "Anamnese clínica concluída." : "Anamnese clínica pendente."),
    step("plan", "Construção do plano", value.plan_complete, "Rascunho estruturado criado."),
    step("meal-template", "Meal Templates", value.meal_template_complete, "Template reutilizável criado."),
    step("recipe", "Receitas", value.recipe_complete, "Receita reutilizável criada."),
    step("publication", "Publicação", value.publication_complete, "Versão imutável publicada."),
    step("portal-view", "Visualização do paciente", value.portal_view_complete, "Portal estruturado aberto pela conta de teste."),
    step("physical-assessment", "Avaliação física", value.physical_assessment_complete, "Avaliação física disponível em PDF."),
    step("check-in", "Check-in", value.checkin_complete, "Primeiro check-in semanal enviado."),
  ]);
  const enabledCount = flags.filter((flag) => flag.enabled).length;
  const controlledCount = flags.filter((flag) =>
    flag.enabled &&
    flag.source === "override" &&
    flag.scope === "client" &&
    flag.variant === "controlled-homologation" &&
    flag.expiresAt !== null &&
    Date.parse(flag.expiresAt) >= now.getTime()
  ).length;
  const completedSteps = steps.filter((item) => item.complete).length;
  const expiries = flags.flatMap((flag) => flag.enabled && flag.expiresAt ? [flag.expiresAt] : []);
  return Object.freeze({
    mode: enabledCount === 0 ? "inactive" : controlledCount === flags.length ? "active" : "partial",
    enabledCount,
    controlledCount,
    totalFlags: flags.length,
    expiresAt: expiries.length === flags.length ? expiries.toSorted()[0] : null,
    flags: Object.freeze(flags),
    steps,
    completedSteps,
    totalSteps: steps.length,
  });
}

function step(
  key: HomologationStepV1["key"],
  label: string,
  complete: number,
  description: string,
): HomologationStepV1 {
  return Object.freeze({ key, label, complete: complete === 1, description });
}

export async function recordNutriFlowPatientPortalView(input: Readonly<{
  context: NutriFlowPatientContext;
  publicationPublicId: string;
  correlationId: string;
}>) {
  const occurredAt = new Date().toISOString();
  return new D1PatientPortalViewRecorder(env.DB).record({
    publicId: generatePublicId("audit"),
    organizationId: input.context.organizationId,
    clientId: input.context.actor.clientId,
    actorAuthUserId: input.context.actor.authUserId,
    publicationPublicId: input.publicationPublicId,
    correlationId: input.correlationId,
    occurredAt,
  });
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
    configureHomologation: new ConfigureControlledHomologation({
      unitOfWork: new D1NutriFlowUnitOfWork(env.DB, {
        organizationId: context.organizationId,
        organizationPublicId: context.organizationPublicId,
      }),
      idempotency: new D1IdempotencyRepository(env.DB),
      generatePublicId,
      environment: process.env.NODE_ENV === "production" ? "production" : "development",
    }),
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
    createRevision: new CreateFoodPlanRevisionOperation({
      runner,
      createRevision: new CreateFoodPlanRevision({
        plans,
        unitOfWork: new D1NutriFlowUnitOfWork(env.DB, { organizationId: context.organizationId, organizationPublicId: context.organizationPublicId }),
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
    publish: new PublishFoodPlanVersionOperation({
      runner,
      publish: new PublishFoodPlanVersion({
        plans,
        store: new D1FoodPlanPublicationStore(env.DB),
        generatePublicId,
        hashJson: sha256Json,
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

export function createTrainingEditorRepository() {
  return new D1TrainingEditorRepository({
    database: env.DB,
    generatePublicId,
    hashJson: sha256Json,
  });
}

export function createNutriFlowPatientRuntime() {
  return Object.freeze({
    getPortal: new GetPatientPortal(new D1PatientPortalRepository(env.DB)),
    getTraining: new GetPatientTraining(new D1PatientTrainingRepository(env.DB)),
  });
}

export async function sha256Json(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
