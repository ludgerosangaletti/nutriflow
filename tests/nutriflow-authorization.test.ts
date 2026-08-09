import assert from "node:assert/strict";
import test from "node:test";
import {
  NUTRIFLOW_ACTIONS,
  NUTRIFLOW_AUTHORIZATION_MATRIX,
  assertNutriFlowAuthorized,
  authorizeNutriFlow,
  type NutriFlowActor,
} from "../modules/nutriflow/application/security/authorization.ts";
import { NutriFlowApplicationError } from "../modules/nutriflow/application/errors/nutriflow-application-error.ts";

const resource = {
  organizationPublicId: "org_01",
  clientId: 10,
  publicationStatus: "active" as const,
};

const nutritionist: NutriFlowActor = {
  kind: "staff",
  authUserId: "auth_nutritionist",
  organizationPublicId: "org_01",
  role: "nutritionist",
  membershipStatus: "active",
};

test("active staff can manage plans only inside their organization", () => {
  assert.equal(
    NUTRIFLOW_AUTHORIZATION_MATRIX.patient.includes(
      NUTRIFLOW_ACTIONS.UPDATE_DRAFT as never,
    ),
    false,
  );
  assert.equal(
    authorizeNutriFlow(
      nutritionist,
      NUTRIFLOW_ACTIONS.PUBLISH_VERSION,
      resource,
    ).allowed,
    true,
  );
  assert.deepEqual(
    authorizeNutriFlow(nutritionist, NUTRIFLOW_ACTIONS.READ_PLAN, {
      ...resource,
      organizationPublicId: "org_other",
    }),
    { allowed: false, reason: "cross-organization" },
  );
  assert.equal(
    authorizeNutriFlow(nutritionist, NUTRIFLOW_ACTIONS.MANAGE_TRAINING_ENTITLEMENT, resource).reason,
    "unsupported-action",
  );
});

test("suspended staff is denied even inside the same organization", () => {
  assert.deepEqual(
    authorizeNutriFlow(
      { ...nutritionist, membershipStatus: "suspended" },
      NUTRIFLOW_ACTIONS.READ_PLAN,
      resource,
    ),
    { allowed: false, reason: "inactive-identity" },
  );
});

test("patient can read only their active publication during entitlement", () => {
  const patient: NutriFlowActor = {
    kind: "patient",
    authUserId: "auth_patient",
    clientId: 10,
    accountStatus: "active",
    entitlementEndsAt: "2026-08-31T23:59:59.000Z",
  };
  const now = new Date("2026-07-31T12:00:00.000Z");

  assert.equal(
    authorizeNutriFlow(
      patient,
      NUTRIFLOW_ACTIONS.READ_PUBLISHED_PLAN,
      resource,
      now,
    ).allowed,
    true,
  );
  assert.equal(
    authorizeNutriFlow(
      patient,
      NUTRIFLOW_ACTIONS.READ_PUBLISHED_PLAN,
      { ...resource, clientId: 11 },
      now,
    ).reason,
    "wrong-patient",
  );
  assert.equal(
    authorizeNutriFlow(
      patient,
      NUTRIFLOW_ACTIONS.READ_PUBLISHED_PLAN,
      { ...resource, publicationStatus: "revoked" },
      now,
    ).reason,
    "inactive-publication",
  );
});

test("expired entitlement produces a stable safe application error", () => {
  const patient: NutriFlowActor = {
    kind: "patient",
    authUserId: "auth_patient",
    clientId: 10,
    accountStatus: "active",
    entitlementEndsAt: "2026-07-01T00:00:00.000Z",
  };

  assert.throws(
    () =>
      assertNutriFlowAuthorized(
        patient,
        NUTRIFLOW_ACTIONS.READ_PUBLISHED_PLAN,
        resource,
        new Date("2026-07-31T12:00:00.000Z"),
      ),
    (error) =>
      error instanceof NutriFlowApplicationError &&
      error.code === "NF_ACCESS_EXPIRED" &&
      error.httpStatus === 403,
  );
});

test("service identities require both tenant match and explicit scope", () => {
  const service: NutriFlowActor = {
    kind: "service",
    serviceId: "chatbot",
    organizationPublicId: "org_01",
    scopes: [],
  };
  assert.equal(
    authorizeNutriFlow(
      service,
      NUTRIFLOW_ACTIONS.READ_PUBLISHED_PLAN,
      resource,
    ).reason,
    "missing-service-scope",
  );
  assert.equal(
    authorizeNutriFlow(
      { ...service, scopes: ["nutriflow:read-published"] },
      NUTRIFLOW_ACTIONS.READ_PUBLISHED_PLAN,
      resource,
    ).allowed,
    true,
  );
});
