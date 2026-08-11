import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import { emptyTrainingAnamnesisAnswers } from "../modules/nutriflow/contracts/v1/training-anamnesis.ts";
import { parseTrainingAnamnesisAnswersV1 } from "../modules/nutriflow/contracts/v1/training-anamnesis-validation.ts";
import { NutriFlowApplicationError } from "../modules/nutriflow/application/errors/nutriflow-application-error.ts";
import { D1TrainingAnamnesisRepository } from "../modules/nutriflow/infrastructure/d1/d1-training-anamnesis-repository.ts";
import { D1PatientTrainingRepository } from "../modules/nutriflow/infrastructure/d1/d1-patient-training-repository.ts";

class Statement {
  private values: unknown[] = [];
  private readonly query: string;
  private readonly sqlite: DatabaseSync;
  constructor(query: string, sqlite: DatabaseSync) { this.query = query; this.sqlite = sqlite; }
  bind(...values: unknown[]) { this.values = values; return this; }
  async first<T>() { return (this.sqlite.prepare(this.query).get(...this.values.map((value) => value as SQLInputValue)) as T | undefined) ?? null; }
  async run() { const result = this.sqlite.prepare(this.query).run(...this.values.map((value) => value as SQLInputValue)); return { meta: { changes: Number(result.changes) } }; }
}

class Database {
  readonly sqlite: DatabaseSync;
  constructor(sqlite: DatabaseSync) { this.sqlite = sqlite; }
  prepare(query: string) { return new Statement(query, this.sqlite); }
  async batch(statements: Statement[]) { return Promise.all(statements.map((statement) => statement.run())); }
}

function apply(sqlite: DatabaseSync, name: string) {
  const sql = readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
  for (const statement of sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) sqlite.exec(statement);
}

function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON; CREATE TABLE clients (id INTEGER PRIMARY KEY, organization_id INTEGER);");
  apply(sqlite, "0020_parallel_lucky_pierre.sql");
  sqlite.exec("INSERT INTO clients (id, organization_id) VALUES (10, 1), (20, 2); INSERT INTO nf_organizations (public_id, name) VALUES ('org_one', 'Organização um'), ('org_two', 'Organização dois');");
  apply(sqlite, "0040_nutriflow_training_foundation.sql");
  apply(sqlite, "0045_nutriflow_training_anamnesis.sql");
  return new Database(sqlite);
}

function completeAnswers() {
  return parseTrainingAnamnesisAnswersV1({
    ...emptyTrainingAnamnesisAnswers(), objective: "muscle_gain", priorities: ["chest", "shoulders"],
    experience: "1_to_3_years", currentRoutine: "regular", unsafeExercises: false,
    trainingDaysPerWeek: 4, availableDays: ["mon", "tue", "thu", "fri"], sessionDuration: "45_to_60",
    trainingLocation: "full_gym", pain: true, painDetails: "Desconforto no ombro direito acima da cabeça.",
    injuryHistory: false, professionalRestrictions: false, healthCondition: false,
    likedExercises: "Supino reto", dislikedExercises: "Agachamento livre",
    otherActivity: "football", otherActivityFrequency: 1, additionalNotes: null,
  }, true);
}

test("Training anamnesis is entitlement-gated, tenant-scoped and keeps submitted history", async () => {
  const db = database();
  let sequence = 0;
  const repository = new D1TrainingAnamnesisRepository(db, (kind) => `${kind}_${++sequence}`, () => new Date("2026-08-11T12:00:00.000Z"));
  await assert.rejects(() => repository.getEditableForPatient({ organizationId: 1, clientId: 10 }), (error) => error instanceof NutriFlowApplicationError && error.httpStatus === 403);
  db.sqlite.exec("INSERT INTO nf_training_entitlements (public_id, organization_id, client_id, status) VALUES ('ent_10', 1, 10, 'active')");

  const answers = completeAnswers();
  const draft = await repository.saveForPatient({ organizationId: 1, clientId: 10, actorAuthUserId: "auth_patient_10", answers, submit: false, correlationId: "corr_draft" });
  assert.equal(draft.status, "draft");
  const submitted = await repository.saveForPatient({ organizationId: 1, clientId: 10, actorAuthUserId: "auth_patient_10", answers, submit: true, correlationId: "corr_submit" });
  assert.equal(submitted.status, "submitted");
  assert.equal(submitted.revision, 1);
  assert.equal((await repository.getSubmittedForAdmin({ organizationId: 1, clientId: 10 }))?.answers.likedExercises, "Supino reto");

  await repository.saveForPatient({ organizationId: 1, clientId: 10, actorAuthUserId: "auth_patient_10", answers: { ...answers, likedExercises: "Remada baixa" }, submit: false, correlationId: "corr_update_draft" });
  assert.equal((await repository.getSubmittedForAdmin({ organizationId: 1, clientId: 10 }))?.answers.likedExercises, "Supino reto", "unfinished updates must not replace the last submitted clinical view");
  await repository.saveForPatient({ organizationId: 1, clientId: 10, actorAuthUserId: "auth_patient_10", answers: { ...answers, likedExercises: "Remada baixa" }, submit: true, correlationId: "corr_update_submit" });
  assert.equal(db.sqlite.prepare("SELECT count(*) AS total FROM nf_training_anamnesis_revisions").get()!.total, 2);
  assert.equal((await repository.getSubmittedForAdmin({ organizationId: 1, clientId: 10 }))?.revision, 2);
  await assert.rejects(() => repository.getSubmittedForAdmin({ organizationId: 2, clientId: 10 }), (error) => error instanceof NutriFlowApplicationError && error.httpStatus === 403);
});

test("Training portal exposes anamnesis state without changing commercial/preparing/publication rules", async () => {
  const db = database();
  const portalRepository = new D1PatientTrainingRepository(db);
  db.sqlite.exec("INSERT INTO nf_training_entitlements (public_id, organization_id, client_id, status) VALUES ('ent_10', 1, 10, 'active')");
  assert.equal((await portalRepository.findForPatient({ organizationId: 1, clientId: 10, now: new Date("2026-08-11T12:00:00.000Z") })).anamnesis.status, "not_started");
  const repository = new D1TrainingAnamnesisRepository(db, (kind) => `${kind}_one`, () => new Date("2026-08-11T12:00:00.000Z"));
  await repository.saveForPatient({ organizationId: 1, clientId: 10, actorAuthUserId: "auth_patient_10", answers: completeAnswers(), submit: true, correlationId: "corr_submit" });
  const portal = await portalRepository.findForPatient({ organizationId: 1, clientId: 10, now: new Date("2026-08-11T12:00:00.000Z") });
  assert.equal(portal.card.state, "preparing");
  assert.equal(portal.anamnesis.status, "submitted");
});

test("patient and prescriber UX keep onboarding contextual and never auto-create prescriptions", () => {
  const page = readFileSync(new URL("../app/treino/page.tsx", import.meta.url), "utf8");
  const form = readFileSync(new URL("../app/treino/anamnese/training-anamnesis-form.tsx", import.meta.url), "utf8");
  const editor = readFileSync(new URL("../app/admin/clientes/[email]/training/training-editor.tsx", import.meta.url), "utf8");
  assert.match(page, /portal\.anamnesis\.status !== "submitted"/);
  assert.match(page, /Complete sua anamnese de treino/);
  assert.match(form, /steps\.length/);
  assert.match(form, /Pontos de atenção para revisão profissional/);
  assert.match(editor, /TrainingAnamnesisSummary/);
  assert.match(editor, /availableDays\.includes/);
  assert.match(editor, /Aguardando anamnese/);
  assert.doesNotMatch(form + editor, /create.*prescription|prescri[cç][aã]o autom[aá]tica/i);
});
