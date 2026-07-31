import type { NutriFlowFeatureFlag } from "../../config/feature-flags.ts";
import { NUTRIFLOW_ERROR_CODES } from "../../contracts/v1/errors.ts";
import { publicId } from "../../domain/shared/value-objects.ts";
import { NutriFlowApplicationError } from "../errors/nutriflow-application-error.ts";
import type { NutriFlowUnitOfWork } from "../ports/unit-of-work.ts";
import {
  assertNutriFlowAuthorized,
  NUTRIFLOW_ACTIONS,
  type NutriFlowActor,
} from "../security/authorization.ts";

export type ConfigureFeatureFlagOverrideInput = Readonly<{
  actor: NutriFlowActor;
  organizationPublicId: string;
  flag: NutriFlowFeatureFlag;
  clientId: number | null;
  enabled: boolean;
  variant?: string | null;
  reason: string;
  expiresAt?: string | null;
  correlationId: string;
}>;

export class ConfigureFeatureFlagOverride {
  private readonly unitOfWork: NutriFlowUnitOfWork;
  private readonly generatePublicId: (prefix: "flag" | "audit") => string;
  private readonly clock: () => Date;

  constructor(dependencies: Readonly<{
    unitOfWork: NutriFlowUnitOfWork;
    generatePublicId: (prefix: "flag" | "audit") => string;
    clock?: () => Date;
  }>) {
    this.unitOfWork = dependencies.unitOfWork;
    this.generatePublicId = dependencies.generatePublicId;
    this.clock = dependencies.clock ?? (() => new Date());
  }

  async execute(input: ConfigureFeatureFlagOverrideInput) {
    const now = this.clock();
    validateInput(input, now);
    assertNutriFlowAuthorized(
      input.actor,
      NUTRIFLOW_ACTIONS.CONFIGURE_FEATURE_FLAG,
      {
        organizationPublicId: input.organizationPublicId,
        clientId: input.clientId ?? 0,
      },
      now,
    );
    if (input.actor.kind !== "staff") {
      throw new NutriFlowApplicationError(
        NUTRIFLOW_ERROR_CODES.FORBIDDEN,
        "Acesso não autorizado.",
        403,
      );
    }
    const actor = input.actor;

    const flagPublicId = publicId(this.generatePublicId("flag"));
    const auditPublicId = publicId(this.generatePublicId("audit"));
    const occurredAt = now.toISOString();
    const variant = input.variant?.trim() || null;
    await this.unitOfWork.run(async (transaction) => {
      transaction.featureFlags.insertOverride({
        publicId: flagPublicId,
        flag: input.flag,
        clientId: input.clientId,
        enabled: input.enabled,
        variant,
        reason: input.reason.trim(),
        expiresAt: input.expiresAt ?? null,
        createdByAuthUserId: actor.authUserId,
        createdAt: occurredAt,
      });
      transaction.audit.append({
        publicId: auditPublicId,
        actorAuthUserId: actor.authUserId,
        actorRole: actor.role,
        action: "feature-flag.override.configured",
        entityType: "feature-flag-override",
        entityPublicId: flagPublicId,
        correlationId: input.correlationId,
        beforeJson: null,
        afterJson: JSON.stringify({
          flag: input.flag,
          scope: input.clientId === null ? "organization" : "client",
          enabled: input.enabled,
          variant,
          expiresAt: input.expiresAt ?? null,
        }),
        occurredAt,
      });
    });
    return Object.freeze({ publicId: flagPublicId, configuredAt: occurredAt });
  }
}

function validateInput(input: ConfigureFeatureFlagOverrideInput, now: Date) {
  if (input.clientId !== null && (!Number.isSafeInteger(input.clientId) || input.clientId < 1)) {
    invalid();
  }
  const reason = input.reason.trim();
  if (reason.length < 8 || reason.length > 500) invalid();
  if (input.variant !== undefined && input.variant !== null) {
    const variant = input.variant.trim();
    if (variant.length < 1 || variant.length > 80) invalid();
  }
  if (input.expiresAt !== undefined && input.expiresAt !== null) {
    const expiresAt = Date.parse(input.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) invalid();
  }
}

function invalid(): never {
  throw new NutriFlowApplicationError(
    NUTRIFLOW_ERROR_CODES.INVALID_INPUT,
    "Os dados informados são inválidos.",
    400,
  );
}
