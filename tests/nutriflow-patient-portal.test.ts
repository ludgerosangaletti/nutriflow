import assert from "node:assert/strict";
import test from "node:test";
import { GetPatientPortal } from "../modules/nutriflow/application/portal/get-patient-portal.ts";
import { D1PatientPortalRepository } from "../modules/nutriflow/infrastructure/d1/d1-patient-portal-repository.ts";
import type { D1OperationDatabaseLike, D1OperationStatementLike } from "../modules/nutriflow/infrastructure/d1/d1-operation-database.ts";

const snapshot = {
  schemaVersion: 1,
  organizationPublicId: "org_01",
  clientId: 7,
  planPublicId: "plan_01",
  planVersionPublicId: "version_01",
  versionNumber: 2,
  title: "Plano do paciente",
  notes: "Orientação geral.",
  days: [{ publicId: "day_01", label: "Dia de treino", dayIndex: 1, sortOrder: 0 }],
  meals: [{
    publicId: "meal_01", planDayPublicId: "day_01", title: "Café da manhã", scheduledTime: "08:00", instructions: "Hidrate-se.", sourceTemplatePublicId: null, sourceTemplateVersionNumber: null, sortOrder: 0,
    items: [{ publicId: "item_01", source: { type: "recipe", publicId: "recipe_01", revisionNumber: 1 }, displayName: "Panqueca de banana", quantityMilli: 1000, unitPublicId: "unit_portion", unitCode: "portion", unitLabel: "porção", preparation: "Misture e grelhe.", notes: null, sortOrder: 0 }],
    substitutions: [{ publicId: "sub_01", mealItemPublicId: "item_01", title: "Troca equivalente", ruleCode: "choose_one", notes: null, sortOrder: 0, options: [{ publicId: "option_01", source: { type: "food", publicId: "food_01", revisionNumber: 1 }, displayName: "Pão integral", quantityMilli: 2000, unitPublicId: "unit_slice", unitCode: "slice", unitLabel: "fatias", notes: null, sortOrder: 0 }] }],
  }],
  planNotes: [{ publicId: "note_01", mealPublicId: null, kind: "patient", content: "Leve água para o treino.", sortOrder: 0 }],
};

class Statement implements D1OperationStatementLike {
  values: unknown[] = [];
  private readonly query: string;
  constructor(query: string) { this.query = query; }
  bind(...values: unknown[]) { this.values = values; return this; }
  async first<T>() {
    if (this.query.includes("FROM nf_publications")) return {
      publication_public_id: "publication_01", plan_public_id: "plan_01", plan_version_public_id: "version_01", client_id: 7, status: "active", version_number: 2, title: "Plano", content_hash: "hash_01", snapshot_json: JSON.stringify(snapshot), published_at: "2026-08-01T12:00:00.000Z",
    } as T;
    if (this.query.includes("document.document_type")) return { id: 3, title: "Avaliação física", published_at: "2026-07-28T12:00:00.000Z" } as T;
    if (this.query.includes("ORDER BY checkin.week_start DESC")) return { week_start: "2026-07-27", created_at: "2026-07-30T12:00:00.000Z" } as T;
    return null;
  }
  async all<T>() {
    if (this.query.includes("checkin.weight_kg")) return { results: [{ week_start: "2026-07-20", weight_kg: "82,4", created_at: "2026-07-20T12:00:00.000Z" }] as T[] };
    return { results: [] as T[] };
  }
  async run() { return { meta: { changes: 0 } }; }
}

class Database implements D1OperationDatabaseLike {
  prepare(query: string) { return new Statement(query); }
}

test("Sprint 5 maps the immutable publication into a mobile/app-ready patient contract", async () => {
  const repository = new D1PatientPortalRepository(new Database());
  const portal = await new GetPatientPortal(repository).execute({
    actor: { kind: "patient", authUserId: "auth_patient_01", clientId: 7, accountStatus: "active", entitlementEndsAt: "2026-09-01T00:00:00.000Z" },
    organizationId: 1,
    organizationPublicId: "org_01",
    patientName: "Paciente Teste",
    modality: "online",
    now: new Date("2026-08-01T12:00:00.000Z"),
  });

  assert.equal(portal.apiVersion, "v1");
  assert.equal(portal.plan?.days[0].meals[0].items[0].recipe?.instructions, "Misture e grelhe.");
  assert.equal(portal.plan?.days[0].meals[0].substitutions[0].options[0].displayName, "Pão integral");
  assert.equal(portal.plan?.patientNotes[0], "Leve água para o treino.");
  assert.equal(portal.physicalAssessment.available, true);
  assert.equal(portal.weightEvolution[0].weightKg, 82.4);
});

test("patient portal rejects cross-patient and expired access", async () => {
  const repository = new D1PatientPortalRepository(new Database());
  const useCase = new GetPatientPortal(repository);
  await assert.rejects(useCase.execute({
    actor: { kind: "patient", authUserId: "auth_wrong", clientId: 8, accountStatus: "active", entitlementEndsAt: "2026-09-01T00:00:00.000Z" },
    organizationId: 1, organizationPublicId: "org_01", patientName: "Outro", modality: "online", now: new Date("2026-08-01T12:00:00.000Z"),
  }), (error: unknown) => error instanceof Error && "code" in error && error.code === "NF_FORBIDDEN");
  await assert.rejects(useCase.execute({
    actor: { kind: "patient", authUserId: "auth_patient_01", clientId: 7, accountStatus: "active", entitlementEndsAt: "2026-07-01T00:00:00.000Z" },
    organizationId: 1, organizationPublicId: "org_01", patientName: "Paciente", modality: "online", now: new Date("2026-08-01T12:00:00.000Z"),
  }), (error: unknown) => error instanceof Error && "code" in error && error.code === "NF_ACCESS_EXPIRED");
});
