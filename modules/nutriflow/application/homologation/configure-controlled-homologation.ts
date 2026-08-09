import {
  NUTRIFLOW_FEATURE_FLAGS,
  type NutriFlowFeatureFlag,
} from "../../config/feature-flags.ts";
import { NUTRIFLOW_ERROR_CODES } from "../../contracts/v1/errors.ts";
import { homologationAccessConfigured } from "../../domain/homologation/homologation-events.ts";
import { NutriFlowApplicationError } from "../errors/nutriflow-application-error.ts";
import type { IdempotencyRepository } from "../ports/idempotency-repository.ts";
import type { NutriFlowUnitOfWork } from "../ports/unit-of-work.ts";
import { executeIdempotently } from "../idempotency/execute-idempotently.ts";
import {
  assertNutriFlowAuthorized,
  NUTRIFLOW_ACTIONS,
  type NutriFlowActor,
} from "../security/authorization.ts";

export const CONTROLLED_HOMOLOGATION_FLAGS: readonly NutriFlowFeatureFlag[] =
  Object.freeze([
    NUTRIFLOW_FEATURE_FLAGS.ADMIN_EDITOR,
    NUTRIFLOW_FEATURE_FLAGS.GLOBAL_CATALOG,
    NUTRIFLOW_FEATURE_FLAGS.MEAL_TEMPLATES,
    NUTRIFLOW_FEATURE_FLAGS.RECIPES,
    NUTRIFLOW_FEATURE_FLAGS.PATIENT_STRUCTURED_PLAN,
    // Training remains disabled by default. This only makes the existing,
    // expiring per-client controlled-homologation path available for a
    // confirmed test account before any organization-level activation.
    NUTRIFLOW_FEATURE_FLAGS.TRAINING,
  ]);

export type ConfigureControlledHomologationResult = Readonly<{
  enabled: boolean;
  configuredAt: string;
  expiresAt: string | null;
  flagsConfigured: number;
}>;

export class ConfigureControlledHomologation {
  private readonly dependencies: Readonly<{
    unitOfWork: NutriFlowUnitOfWork;
    idempotency: IdempotencyRepository;
    generatePublicId: (prefix: "flag" | "audit" | "evt") => string;
    environment: string;
    clock?: () => Date;
  }>;

  constructor(dependencies: Readonly<{
    unitOfWork: NutriFlowUnitOfWork;
    idempotency: IdempotencyRepository;
    generatePublicId: (prefix: "flag" | "audit" | "evt") => string;
    environment: string;
    clock?: () => Date;
  }>) {
    this.dependencies = dependencies;
  }

  async execute(input: Readonly<{
    actor: NutriFlowActor;
    organizationId: number;
    organizationPublicId: string;
    clientId: number;
    enabled: boolean;
    reason: string;
    expiresAt: string | null;
    confirmedTestAccount: boolean;
    correlationId: string;
    idempotencyKey: string;
    requestHash: string;
  }>): Promise<ConfigureControlledHomologationResult> {
    const now = (this.dependencies.clock ?? (() => new Date()))();
    validate(input, now);
    assertNutriFlowAuthorized(
      input.actor,
      NUTRIFLOW_ACTIONS.CONFIGURE_FEATURE_FLAG,
      { organizationPublicId: input.organizationPublicId, clientId: input.clientId },
      now,
    );
    if (input.actor.kind !== "staff") forbidden();
    const actor = input.actor;

    return executeIdempotently({
      repository: this.dependencies.idempotency,
      organizationId: input.organizationId,
      operation: "homologation.configure.v1",
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      correlationId: input.correlationId,
      now,
      deserialize: (value) => JSON.parse(value) as ConfigureControlledHomologationResult,
      execute: async () => {
        const occurredAt = now.toISOString();
        const auditPublicId = this.dependencies.generatePublicId("audit");
        const event = homologationAccessConfigured({
          eventId: this.dependencies.generatePublicId("evt"),
          organizationPublicId: input.organizationPublicId,
          clientId: input.clientId,
          enabled: input.enabled,
          expiresAt: input.enabled ? input.expiresAt : null,
          occurredAt,
          actor: { authUserId: actor.authUserId, role: actor.role },
          correlationId: input.correlationId,
          environment: this.dependencies.environment,
        });
        await this.dependencies.unitOfWork.run(async (transaction) => {
          for (const flag of CONTROLLED_HOMOLOGATION_FLAGS) {
            transaction.featureFlags.insertOverride({
              publicId: this.dependencies.generatePublicId("flag"),
              flag,
              clientId: input.clientId,
              enabled: input.enabled,
              variant: input.enabled ? "controlled-homologation" : "homologation-suspended",
              reason: input.reason.trim(),
              expiresAt: input.enabled ? input.expiresAt : null,
              createdByAuthUserId: actor.authUserId,
              createdAt: occurredAt,
            });
          }
          transaction.audit.append({
            publicId: auditPublicId,
            actorAuthUserId: actor.authUserId,
            actorRole: actor.role,
            action: input.enabled
              ? "homologation.access.activated"
              : "homologation.access.suspended",
            entityType: "homologation-access",
            entityPublicId: `client-${input.clientId}`,
            correlationId: input.correlationId,
            beforeJson: null,
            afterJson: JSON.stringify({
              clientId: input.clientId,
              enabled: input.enabled,
              flags: CONTROLLED_HOMOLOGATION_FLAGS,
              expiresAt: input.enabled ? input.expiresAt : null,
            }),
            occurredAt,
          });
          transaction.enqueueDomainEvents([event]);
        });
        return Object.freeze({
          enabled: input.enabled,
          configuredAt: occurredAt,
          expiresAt: input.enabled ? input.expiresAt : null,
          flagsConfigured: CONTROLLED_HOMOLOGATION_FLAGS.length,
        });
      },
    });
  }
}

function validate(input: Readonly<{
  clientId: number;
  enabled: boolean;
  reason: string;
  expiresAt: string | null;
  confirmedTestAccount: boolean;
}>, now: Date) {
  if (!Number.isSafeInteger(input.clientId) || input.clientId < 1) invalid();
  if (input.reason.trim().length < 12 || input.reason.trim().length > 500) invalid();
  if (!input.confirmedTestAccount) invalid();
  if (input.enabled) {
    const expiry = input.expiresAt ? Date.parse(input.expiresAt) : Number.NaN;
    const maximum = now.getTime() + 90 * 24 * 60 * 60 * 1000;
    if (!Number.isFinite(expiry) || expiry <= now.getTime() || expiry > maximum) invalid();
  }
}

function invalid(): never {
  throw new NutriFlowApplicationError(
    NUTRIFLOW_ERROR_CODES.INVALID_INPUT,
    "Os dados informados são inválidos.",
    400,
  );
}

function forbidden(): never {
  throw new NutriFlowApplicationError(
    NUTRIFLOW_ERROR_CODES.FORBIDDEN,
    "Acesso não autorizado.",
    403,
  );
}
