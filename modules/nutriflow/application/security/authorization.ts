import { NutriFlowApplicationError } from "../errors/nutriflow-application-error.ts";
import { NUTRIFLOW_ERROR_CODES } from "../../contracts/v1/errors.ts";

export type NutriFlowStaffRole = "owner" | "admin" | "nutritionist";

export type NutriFlowActor =
  | Readonly<{
      kind: "staff";
      authUserId: string;
      organizationPublicId: string;
      role: NutriFlowStaffRole;
      membershipStatus: "active" | "suspended" | "revoked";
    }>
  | Readonly<{
      kind: "patient";
      authUserId: string;
      clientId: number;
      accountStatus: "active" | "suspended" | "revoked";
      entitlementEndsAt: string | null;
    }>
  | Readonly<{
      kind: "service";
      serviceId: string;
      organizationPublicId: string;
      scopes: readonly string[];
    }>;

export const NUTRIFLOW_ACTIONS = {
  CREATE_PLAN: "plan:create",
  READ_PLAN: "plan:read",
  UPDATE_DRAFT: "plan:update-draft",
  REQUEST_REVIEW: "plan:request-review",
  PUBLISH_VERSION: "plan:publish-version",
  REVOKE_PUBLICATION: "plan:revoke-publication",
  READ_PUBLISHED_PLAN: "publication:read",
  READ_PATIENT_PORTAL: "patient-portal:read",
  READ_CATALOG: "catalog:read",
  MANAGE_MEAL_TEMPLATES: "meal-template:manage",
  MANAGE_RECIPES: "recipe:manage",
  MANAGE_TRAINING_ENTITLEMENT: "training-entitlement:manage",
  MANAGE_TRAINING_ROUTINE: "training-routine:manage",
  READ_TRAINING_LIBRARY: "training-library:read",
  READ_TRAINING: "training:read",
  CONFIGURE_FEATURE_FLAG: "feature-flag:configure",
} as const;

export type NutriFlowAction =
  (typeof NUTRIFLOW_ACTIONS)[keyof typeof NUTRIFLOW_ACTIONS];

export const NUTRIFLOW_AUTHORIZATION_MATRIX = Object.freeze({
  owner: Object.freeze(Object.values(NUTRIFLOW_ACTIONS)),
  admin: Object.freeze(Object.values(NUTRIFLOW_ACTIONS)),
  nutritionist: Object.freeze(
    Object.values(NUTRIFLOW_ACTIONS).filter(
      (action) => action !== NUTRIFLOW_ACTIONS.CONFIGURE_FEATURE_FLAG && action !== NUTRIFLOW_ACTIONS.MANAGE_TRAINING_ENTITLEMENT,
    ),
  ),
  patient: Object.freeze([
    NUTRIFLOW_ACTIONS.READ_PUBLISHED_PLAN,
    NUTRIFLOW_ACTIONS.READ_PATIENT_PORTAL,
    NUTRIFLOW_ACTIONS.READ_TRAINING,
  ]),
  service: Object.freeze([NUTRIFLOW_ACTIONS.READ_PUBLISHED_PLAN]),
});

export type NutriFlowResource = Readonly<{
  organizationPublicId: string;
  clientId: number;
  publicationStatus?: "active" | "revoked" | null;
}>;

export type AuthorizationDecision = Readonly<{
  allowed: boolean;
  reason:
    | "allowed"
    | "inactive-identity"
    | "cross-organization"
    | "wrong-patient"
    | "expired-entitlement"
    | "inactive-publication"
    | "missing-service-scope"
    | "unsupported-action";
}>;

function denied(reason: AuthorizationDecision["reason"]): AuthorizationDecision {
  return Object.freeze({ allowed: false, reason });
}

function entitlementIsActive(endsAt: string | null, now: Date) {
  return endsAt === null || (Number.isFinite(Date.parse(endsAt)) && Date.parse(endsAt) >= now.getTime());
}

export function authorizeNutriFlow(
  actor: NutriFlowActor,
  action: NutriFlowAction,
  resource: NutriFlowResource,
  now = new Date(),
): AuthorizationDecision {
  if (actor.kind === "staff") {
    if (actor.membershipStatus !== "active") return denied("inactive-identity");
    if (actor.organizationPublicId !== resource.organizationPublicId) {
      return denied("cross-organization");
    }
    return (NUTRIFLOW_AUTHORIZATION_MATRIX[actor.role] as readonly string[]).includes(action)
      ? Object.freeze({ allowed: true, reason: "allowed" })
      : denied("unsupported-action");
  }

  if (actor.kind === "patient") {
    if (actor.accountStatus !== "active") return denied("inactive-identity");
    if (
      action !== NUTRIFLOW_ACTIONS.READ_PUBLISHED_PLAN &&
      action !== NUTRIFLOW_ACTIONS.READ_PATIENT_PORTAL &&
      action !== NUTRIFLOW_ACTIONS.READ_TRAINING
    ) {
      return denied("unsupported-action");
    }
    if (actor.clientId !== resource.clientId) return denied("wrong-patient");
    if (!entitlementIsActive(actor.entitlementEndsAt, now)) {
      return denied("expired-entitlement");
    }
    if (
      action === NUTRIFLOW_ACTIONS.READ_PUBLISHED_PLAN &&
      resource.publicationStatus !== "active"
    ) {
      return denied("inactive-publication");
    }
    return Object.freeze({ allowed: true, reason: "allowed" });
  }

  if (actor.organizationPublicId !== resource.organizationPublicId) {
    return denied("cross-organization");
  }
  if (
    action === NUTRIFLOW_ACTIONS.READ_PUBLISHED_PLAN &&
    actor.scopes.includes("nutriflow:read-published") &&
    resource.publicationStatus === "active"
  ) {
    return Object.freeze({ allowed: true, reason: "allowed" });
  }
  return denied("missing-service-scope");
}

export function assertNutriFlowAuthorized(
  actor: NutriFlowActor,
  action: NutriFlowAction,
  resource: NutriFlowResource,
  now = new Date(),
) {
  const decision = authorizeNutriFlow(actor, action, resource, now);
  if (decision.allowed) return;
  const expired = decision.reason === "expired-entitlement";
  throw new NutriFlowApplicationError(
    expired ? NUTRIFLOW_ERROR_CODES.ACCESS_EXPIRED : NUTRIFLOW_ERROR_CODES.FORBIDDEN,
    expired ? "O acesso ao plano não está vigente." : "Acesso não autorizado.",
    403,
  );
}
