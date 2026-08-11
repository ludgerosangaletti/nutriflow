import { NUTRIFLOW_API_VERSION, NUTRIFLOW_ERROR_CODES } from "../../contracts/v1/errors.ts";
import { emptyTrainingAnamnesisAnswers, type TrainingAnamnesisStatusV1, type TrainingAnamnesisV1, type TrainingAnamnesisAnswersV1 } from "../../contracts/v1/training-anamnesis.ts";
import { parseTrainingAnamnesisAnswersV1 } from "../../contracts/v1/training-anamnesis-validation.ts";
import { NutriFlowApplicationError } from "../../application/errors/nutriflow-application-error.ts";
import type { D1PreparedStatementLike } from "./d1-unit-of-work.ts";

type Statement = Omit<D1PreparedStatementLike, "bind"> & {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
};
type Database = { prepare(query: string): Statement; batch(statements: D1PreparedStatementLike[]): Promise<unknown[]> };
type Row = Readonly<{
  public_id: string; status: "draft" | "submitted"; answers_json: string; submitted_answers_json: string | null;
  revision: number; updated_at: string; submitted_at: string | null;
}>;
type ScopeRow = Readonly<{ id: number; entitlement_status: string | null }>;

function parse(value: string | null, complete = false) {
  if (!value) return emptyTrainingAnamnesisAnswers();
  try { return parseTrainingAnamnesisAnswersV1(JSON.parse(value), complete); }
  catch { return emptyTrainingAnamnesisAnswers(); }
}

function status(row: Row | null): TrainingAnamnesisStatusV1 {
  return Object.freeze({ status: row?.status ?? "not_started", updatedAt: row?.updated_at ?? null, submittedAt: row?.submitted_at ?? null });
}

/** Training anamnesis persistence. Patient writes require active entitlement; every read is tenant scoped. */
export class D1TrainingAnamnesisRepository {
  private readonly database: Database;
  private readonly generatePublicId: (kind: string) => string;
  private readonly now: () => Date;
  constructor(
    database: Database,
    generatePublicId: (kind: string) => string,
    now: () => Date = () => new Date(),
  ) { this.database = database; this.generatePublicId = generatePublicId; this.now = now; }

  private async assertScope(organizationId: number, clientId: number, entitlementRequired: boolean) {
    const row = await this.database.prepare(`SELECT client.id, entitlement.status AS entitlement_status
      FROM clients AS client
      LEFT JOIN nf_training_entitlements AS entitlement
        ON entitlement.organization_id = ? AND entitlement.client_id = client.id
      WHERE client.id = ? AND (client.organization_id = ? OR EXISTS (
        SELECT 1 FROM nf_plans AS plan WHERE plan.client_id = client.id AND plan.organization_id = ?
      )) LIMIT 1`).bind(organizationId, clientId, organizationId, organizationId).first<ScopeRow>();
    if (!row) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "Acesso não autorizado.", 403);
    if (entitlementRequired && row.entitlement_status !== "active") throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "A anamnese pertence ao NutriFlow Training contratado.", 403);
  }

  private async row(organizationId: number, clientId: number) {
    return this.database.prepare(`SELECT public_id, status, answers_json, submitted_answers_json, revision, updated_at, submitted_at
      FROM nf_training_anamneses WHERE organization_id = ? AND client_id = ? LIMIT 1`)
      .bind(organizationId, clientId).first<Row>();
  }

  async getStatus(input: Readonly<{ organizationId: number; clientId: number }>) {
    await this.assertScope(input.organizationId, input.clientId, false);
    return status(await this.row(input.organizationId, input.clientId));
  }

  async getEditableForPatient(input: Readonly<{ organizationId: number; clientId: number }>): Promise<TrainingAnamnesisV1> {
    await this.assertScope(input.organizationId, input.clientId, true);
    const row = await this.row(input.organizationId, input.clientId);
    return Object.freeze({ apiVersion: NUTRIFLOW_API_VERSION, publicId: row?.public_id ?? null, status: row?.status ?? "not_started", answers: parse(row?.answers_json ?? null), revision: row?.revision ?? 0, updatedAt: row?.updated_at ?? null, submittedAt: row?.submitted_at ?? null });
  }

  async getSubmittedForAdmin(input: Readonly<{ organizationId: number; clientId: number }>): Promise<TrainingAnamnesisV1 | null> {
    await this.assertScope(input.organizationId, input.clientId, false);
    const row = await this.row(input.organizationId, input.clientId);
    if (!row || row.status !== "submitted" || !row.submitted_answers_json) return null;
    return Object.freeze({ apiVersion: NUTRIFLOW_API_VERSION, publicId: row.public_id, status: "submitted", answers: parse(row.submitted_answers_json, true), revision: row.revision, updatedAt: row.updated_at, submittedAt: row.submitted_at });
  }

  async saveForPatient(input: Readonly<{ organizationId: number; clientId: number; actorAuthUserId: string; answers: TrainingAnamnesisAnswersV1; submit: boolean; correlationId: string }>): Promise<TrainingAnamnesisV1> {
    await this.assertScope(input.organizationId, input.clientId, true);
    const answers = parseTrainingAnamnesisAnswersV1(input.answers, input.submit);
    const current = await this.row(input.organizationId, input.clientId);
    const timestamp = this.now().toISOString();
    const publicId = current?.public_id ?? this.generatePublicId("training_anamnesis");
    const nextRevision = input.submit ? (current?.revision ?? 0) + 1 : current?.revision ?? 0;
    const answersJson = JSON.stringify(answers);
    const statusValue = input.submit ? "submitted" : current?.status ?? "draft";
    const statements: D1PreparedStatementLike[] = [
      this.database.prepare(`INSERT INTO nf_training_anamneses
        (public_id, organization_id, client_id, status, schema_version, answers_json, submitted_answers_json, revision, submitted_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(organization_id, client_id) DO UPDATE SET
          status = excluded.status, schema_version = 1, answers_json = excluded.answers_json,
          submitted_answers_json = CASE WHEN excluded.status = 'submitted' THEN excluded.submitted_answers_json ELSE nf_training_anamneses.submitted_answers_json END,
          revision = excluded.revision,
          submitted_at = CASE WHEN excluded.status = 'submitted' THEN excluded.submitted_at ELSE nf_training_anamneses.submitted_at END,
          updated_at = excluded.updated_at`)
        .bind(publicId, input.organizationId, input.clientId, statusValue, answersJson, input.submit ? answersJson : current?.submitted_answers_json ?? null, nextRevision, input.submit ? timestamp : current?.submitted_at ?? null, timestamp, timestamp),
    ];
    if (input.submit) {
      const revisionPublicId = this.generatePublicId("training_anamnesis_revision");
      statements.push(this.database.prepare(`INSERT INTO nf_training_anamnesis_revisions
        (public_id, anamnesis_id, revision, schema_version, answers_json, submitted_by_auth_user_id, submitted_at)
        SELECT ?, id, ?, 1, ?, ?, ? FROM nf_training_anamneses
        WHERE organization_id = ? AND client_id = ?`)
        .bind(revisionPublicId, nextRevision, answersJson, input.actorAuthUserId, timestamp, input.organizationId, input.clientId));
      statements.push(this.database.prepare(`INSERT INTO nf_audit_entries
        (public_id, organization_id, actor_auth_user_id, actor_role, action, entity_type, entity_public_id, correlation_id, before_json, after_json, occurred_at)
        VALUES (?, ?, ?, 'patient', 'training.anamnesis.submitted', 'training-anamnesis', ?, ?, NULL, ?, ?)`)
        .bind(this.generatePublicId("audit"), input.organizationId, input.actorAuthUserId, publicId, input.correlationId, JSON.stringify({ clientId: input.clientId, revision: nextRevision }), timestamp));
    }
    await this.database.batch(statements);
    return this.getEditableForPatient({ organizationId: input.organizationId, clientId: input.clientId });
  }
}
