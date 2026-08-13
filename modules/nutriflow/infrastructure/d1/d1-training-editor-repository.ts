import { NUTRIFLOW_API_VERSION, NUTRIFLOW_ERROR_CODES } from "../../contracts/v1/errors.ts";
import type {
  ConfigureTrainingEntitlementCommandV1,
  SaveTrainingRoutineDraftCommandV1,
  TrainingEditorWorkspaceV1,
  TrainingEntitlementV1,
  TrainingPublicationV1,
  TrainingRoutineContentV1,
  TrainingRoutineDraftV1,
} from "../../contracts/v1/training.ts";
import { parseTrainingAnamnesisAnswersV1 } from "../../contracts/v1/training-anamnesis-validation.ts";
import type { TrainingAnamnesisV1 } from "../../contracts/v1/training-anamnesis.ts";
import { NutriFlowApplicationError } from "../../application/errors/nutriflow-application-error.ts";
import { TRAINING_ROUTINE_PUBLISHED } from "../../domain/notifications/workflow-events.ts";
import type { D1PreparedStatementLike } from "./d1-unit-of-work.ts";

type D1ReadStatement = Omit<D1PreparedStatementLike, "bind"> & {
  bind(...values: unknown[]): D1ReadStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
};

type D1TrainingDatabase = {
  prepare(query: string): D1ReadStatement;
  batch(statements: D1PreparedStatementLike[]): Promise<unknown[]>;
};

type ScopeRow = Readonly<{ id: number }>;
type EntitlementRow = Readonly<{ public_id: string; status: "active" | "inactive"; granted_at: string | null; revoked_at: string | null; reason: string | null }>;
type DraftRow = Readonly<{ routine_public_id: string; public_id: string; version_number: number; revision: number; title: string; content_json: string | null; updated_at: string }>;
type PublicationRow = Readonly<{ public_id: string; routine_public_id: string; routine_version_public_id: string; version_number: number; published_at: string; snapshot_json: string | null; routine_id: number }>;
type RoutineRow = Readonly<{ id: number; public_id: string }>;
type VersionNumberRow = Readonly<{ next_version: number }>;
type AnamnesisRow = Readonly<{ public_id: string; status: "submitted"; submitted_answers_json: string; revision: number; updated_at: string; submitted_at: string }>;
type OrganizationRow = Readonly<{ public_id: string }>;

function parseContent(value: string | null): TrainingRoutineContentV1 {
  if (!value) return Object.freeze({ schemaVersion: 1, days: Object.freeze([]) });
  return JSON.parse(value) as TrainingRoutineContentV1;
}

function entitlement(row: EntitlementRow | null): TrainingEntitlementV1 {
  const active = row?.status === "active";
  return Object.freeze({
    apiVersion: NUTRIFLOW_API_VERSION,
    active,
    publicId: row?.public_id ?? null,
    changedAt: active ? row?.granted_at ?? null : row?.revoked_at ?? null,
    reason: row?.reason ?? null,
  });
}

function draft(row: DraftRow | null): TrainingRoutineDraftV1 | null {
  return row ? Object.freeze({ apiVersion: NUTRIFLOW_API_VERSION, routinePublicId: row.routine_public_id, publicId: row.public_id, versionNumber: row.version_number, revision: row.revision, title: row.title, content: parseContent(row.content_json), updatedAt: row.updated_at }) : null;
}

function publication(row: PublicationRow | null): TrainingPublicationV1 | null {
  return row ? Object.freeze({ apiVersion: NUTRIFLOW_API_VERSION, publicId: row.public_id, routinePublicId: row.routine_public_id, routineVersionPublicId: row.routine_version_public_id, versionNumber: row.version_number, publishedAt: row.published_at, content: parseContent(row.snapshot_json) }) : null;
}

function anamnesis(row: AnamnesisRow | null): TrainingAnamnesisV1 | null {
  if (!row) return null;
  try {
    return Object.freeze({ apiVersion: NUTRIFLOW_API_VERSION, publicId: row.public_id, status: "submitted", answers: parseTrainingAnamnesisAnswersV1(JSON.parse(row.submitted_answers_json), true), revision: row.revision, updatedAt: row.updated_at, submittedAt: row.submitted_at });
  } catch { return null; }
}

function changes(value: unknown) {
  if (!value || typeof value !== "object") return 0;
  const result = value as Readonly<{ meta?: { changes?: number }; changes?: number }>;
  return Number(result.meta?.changes ?? result.changes ?? 0);
}

/** Administrative persistence for Training. Every write is scoped to one organization and audited. */
export class D1TrainingEditorRepository {
  private readonly database: D1TrainingDatabase;
  private readonly generatePublicId: (kind: string) => string;
  private readonly now: () => Date;
  private readonly hashJson: (value: unknown) => Promise<string>;

  constructor(input: Readonly<{
    database: D1TrainingDatabase;
    generatePublicId: (kind: string) => string;
    now?: () => Date;
    hashJson: (value: unknown) => Promise<string>;
  }>) {
    this.database = input.database;
    this.generatePublicId = input.generatePublicId;
    this.now = input.now ?? (() => new Date());
    this.hashJson = input.hashJson;
  }

  private async assertClientScope(organizationId: number, clientId: number) {
    const row = await this.database.prepare(
      `SELECT client.id FROM clients AS client
        WHERE client.id = ? AND (client.organization_id = ? OR EXISTS (
          SELECT 1 FROM nf_plans AS plan WHERE plan.client_id = client.id AND plan.organization_id = ?
        )) LIMIT 1`,
    ).bind(clientId, organizationId, organizationId).first<ScopeRow>();
    if (!row) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "Acesso não autorizado.", 403);
  }

  private async rows(organizationId: number, clientId: number) {
    await this.assertClientScope(organizationId, clientId);
    const [entitlementRow, draftRow, publicationRow, anamnesisRow] = await Promise.all([
      this.database.prepare("SELECT public_id, status, granted_at, revoked_at, reason FROM nf_training_entitlements WHERE organization_id = ? AND client_id = ? LIMIT 1").bind(organizationId, clientId).first<EntitlementRow>(),
      this.database.prepare(`SELECT routine.public_id AS routine_public_id, version.public_id, version.version_number, version.revision, routine.title, version.content_json, version.updated_at
        FROM nf_training_routines AS routine INNER JOIN nf_training_routine_versions AS version ON version.routine_id = routine.id
        WHERE routine.organization_id = ? AND routine.client_id = ? AND version.state = 'draft'
        ORDER BY version.updated_at DESC, version.id DESC LIMIT 1`).bind(organizationId, clientId).first<DraftRow>(),
      this.database.prepare(`SELECT publication.public_id, routine.public_id AS routine_public_id, version.public_id AS routine_version_public_id,
          version.version_number, publication.published_at, version.snapshot_json, routine.id AS routine_id
        FROM nf_training_publications AS publication
        INNER JOIN nf_training_routines AS routine ON routine.id = publication.routine_id
        INNER JOIN nf_training_routine_versions AS version ON version.id = publication.routine_version_id
        WHERE publication.organization_id = ? AND publication.client_id = ? AND publication.status = 'active'
        ORDER BY publication.published_at DESC, publication.id DESC LIMIT 1`).bind(organizationId, clientId).first<PublicationRow>(),
      this.database.prepare(`SELECT public_id, status, submitted_answers_json, revision, updated_at, submitted_at
        FROM nf_training_anamneses WHERE organization_id = ? AND client_id = ? AND status = 'submitted' AND submitted_answers_json IS NOT NULL LIMIT 1`)
        .bind(organizationId, clientId).first<AnamnesisRow>(),
    ]);
    return { entitlementRow, draftRow, publicationRow, anamnesisRow };
  }

  async getWorkspace(input: Readonly<{ organizationId: number; clientId: number }>): Promise<TrainingEditorWorkspaceV1> {
    const rows = await this.rows(input.organizationId, input.clientId);
    return Object.freeze({ apiVersion: NUTRIFLOW_API_VERSION, entitlement: entitlement(rows.entitlementRow), draft: draft(rows.draftRow), publication: publication(rows.publicationRow), anamnesis: anamnesis(rows.anamnesisRow) });
  }

  async configureEntitlement(input: Readonly<{
    organizationId: number;
    actorAuthUserId: string;
    actorRole: string;
    command: ConfigureTrainingEntitlementCommandV1;
  }>): Promise<TrainingEditorWorkspaceV1> {
    await this.assertClientScope(input.organizationId, input.command.clientId);
    const timestamp = this.now().toISOString();
    const publicId = this.generatePublicId("training_entitlement");
    const current = await this.database.prepare("SELECT public_id, status, granted_at, revoked_at, reason FROM nf_training_entitlements WHERE organization_id = ? AND client_id = ? LIMIT 1").bind(input.organizationId, input.command.clientId).first<EntitlementRow>();
    const entitlementPublicId = current?.public_id ?? publicId;
    const action = input.command.active ? "training.entitlement.granted" : "training.entitlement.revoked";
    const statements: D1PreparedStatementLike[] = [
      this.database.prepare(`INSERT INTO nf_training_entitlements (public_id, organization_id, client_id, status, granted_by_auth_user_id, granted_at, revoked_by_auth_user_id, revoked_at, reason, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(organization_id, client_id) DO UPDATE SET status = excluded.status,
          granted_by_auth_user_id = CASE WHEN excluded.status = 'active' THEN excluded.granted_by_auth_user_id ELSE nf_training_entitlements.granted_by_auth_user_id END,
          granted_at = CASE WHEN excluded.status = 'active' THEN excluded.granted_at ELSE nf_training_entitlements.granted_at END,
          revoked_by_auth_user_id = CASE WHEN excluded.status = 'inactive' THEN excluded.revoked_by_auth_user_id ELSE NULL END,
          revoked_at = CASE WHEN excluded.status = 'inactive' THEN excluded.revoked_at ELSE NULL END,
          reason = excluded.reason, updated_at = excluded.updated_at`)
        .bind(publicId, input.organizationId, input.command.clientId, input.command.active ? "active" : "inactive", input.command.active ? input.actorAuthUserId : null, input.command.active ? timestamp : null, input.command.active ? null : input.actorAuthUserId, input.command.active ? null : timestamp, input.command.reason, timestamp, timestamp),
      this.database.prepare("INSERT INTO nf_audit_entries (public_id, organization_id, actor_auth_user_id, actor_role, action, entity_type, entity_public_id, correlation_id, before_json, after_json, occurred_at) VALUES (?, ?, ?, ?, ?, 'training-entitlement', ?, ?, NULL, ?, ?)")
        .bind(this.generatePublicId("audit"), input.organizationId, input.actorAuthUserId, input.actorRole, action, entitlementPublicId, input.command.correlationId, JSON.stringify({ clientId: input.command.clientId, active: input.command.active, reason: input.command.reason }), timestamp),
    ];
    await this.database.batch(statements);
    return this.getWorkspace({ organizationId: input.organizationId, clientId: input.command.clientId });
  }

  async createDraft(input: Readonly<{ organizationId: number; clientId: number; actorAuthUserId: string; actorRole: string; correlationId: string; patientName: string }>): Promise<TrainingEditorWorkspaceV1> {
    const existing = await this.rows(input.organizationId, input.clientId);
    if (!existing.entitlementRow || existing.entitlementRow.status !== "active") throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "Ative o Training antes de editar a rotina.", 403);
    if (existing.draftRow) return this.getWorkspace({ organizationId: input.organizationId, clientId: input.clientId });

    const timestamp = this.now().toISOString();
    const activePublication = existing.publicationRow;
    const routine = activePublication
      ? Object.freeze({ id: activePublication.routine_id, public_id: activePublication.routine_public_id })
      : await this.database.prepare("SELECT id, public_id FROM nf_training_routines WHERE organization_id = ? AND client_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1").bind(input.organizationId, input.clientId).first<RoutineRow>();
    const routinePublicId = routine?.public_id ?? this.generatePublicId("training_routine");
    const version = routine
      ? ((await this.database.prepare("SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM nf_training_routine_versions WHERE routine_id = ?").bind(routine.id).first<VersionNumberRow>())?.next_version ?? 1)
      : 1;
    const sourceContent = activePublication ? parseContent(activePublication.snapshot_json) : Object.freeze({ schemaVersion: 1 as const, days: Object.freeze([]) });
    const statements: D1PreparedStatementLike[] = [];
    if (!routine) statements.push(this.database.prepare("INSERT INTO nf_training_routines (public_id, organization_id, client_id, title, status, created_by_auth_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?)").bind(routinePublicId, input.organizationId, input.clientId, `Treino de ${input.patientName}`, input.actorAuthUserId, timestamp, timestamp));
    else statements.push(this.database.prepare("UPDATE nf_training_routines SET status = 'draft', updated_at = ? WHERE id = ? AND organization_id = ? AND client_id = ?").bind(timestamp, routine.id, input.organizationId, input.clientId));
    const versionPublicId = this.generatePublicId("training_version");
    statements.push(this.database.prepare("INSERT INTO nf_training_routine_versions (public_id, routine_id, version_number, revision, schema_version, state, content_json, created_by_auth_user_id, created_at, updated_at) VALUES (?, (SELECT id FROM nf_training_routines WHERE public_id = ? AND organization_id = ? AND client_id = ?), ?, 1, 1, 'draft', ?, ?, ?, ?)").bind(versionPublicId, routinePublicId, input.organizationId, input.clientId, version, JSON.stringify(sourceContent), input.actorAuthUserId, timestamp, timestamp));
    statements.push(this.database.prepare("INSERT INTO nf_audit_entries (public_id, organization_id, actor_auth_user_id, actor_role, action, entity_type, entity_public_id, correlation_id, before_json, after_json, occurred_at) VALUES (?, ?, ?, ?, 'training.draft.created', 'training-routine-version', ?, ?, NULL, ?, ?)").bind(this.generatePublicId("audit"), input.organizationId, input.actorAuthUserId, input.actorRole, versionPublicId, input.correlationId, JSON.stringify({ clientId: input.clientId, copiedFromPublication: Boolean(activePublication) }), timestamp));
    await this.database.batch(statements);
    return this.getWorkspace({ organizationId: input.organizationId, clientId: input.clientId });
  }

  async saveDraft(input: Readonly<{ organizationId: number; clientId: number; actorAuthUserId: string; actorRole: string; command: SaveTrainingRoutineDraftCommandV1 }>): Promise<TrainingEditorWorkspaceV1> {
    await this.assertClientScope(input.organizationId, input.clientId);
    const timestamp = this.now().toISOString();
    const nextRevision = input.command.expectedRevision + 1;
    const statements: D1PreparedStatementLike[] = [
      this.database.prepare(`UPDATE nf_training_routine_versions SET revision = ?, content_json = ?, updated_at = ?
        WHERE public_id = ? AND revision = ? AND state = 'draft' AND routine_id = (
          SELECT id FROM nf_training_routines WHERE public_id = ? AND organization_id = ? AND client_id = ?
        )`).bind(nextRevision, JSON.stringify(input.command.content), timestamp, input.command.routineVersionPublicId, input.command.expectedRevision, input.command.routinePublicId, input.organizationId, input.clientId),
      this.database.prepare("UPDATE nf_training_routines SET title = ?, updated_at = ? WHERE public_id = ? AND organization_id = ? AND client_id = ?").bind(input.command.title, timestamp, input.command.routinePublicId, input.organizationId, input.clientId),
      this.database.prepare("INSERT INTO nf_audit_entries (public_id, organization_id, actor_auth_user_id, actor_role, action, entity_type, entity_public_id, correlation_id, before_json, after_json, occurred_at) VALUES (?, ?, ?, ?, 'training.draft.saved', 'training-routine-version', ?, ?, NULL, ?, ?)").bind(this.generatePublicId("audit"), input.organizationId, input.actorAuthUserId, input.actorRole, input.command.routineVersionPublicId, input.command.correlationId, JSON.stringify({ revision: nextRevision, days: input.command.content.days.length }), timestamp),
    ];
    const result = await this.database.batch(statements);
    if (changes(result[0]) !== 1) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.VERSION_CONFLICT, "O rascunho foi atualizado em outra sessão.", 409);
    return this.getWorkspace({ organizationId: input.organizationId, clientId: input.clientId });
  }

  async publish(input: Readonly<{ organizationId: number; clientId: number; actorAuthUserId: string; actorRole: string; routinePublicId: string; routineVersionPublicId: string; expectedRevision: number; correlationId: string }>): Promise<TrainingEditorWorkspaceV1> {
    const current = await this.rows(input.organizationId, input.clientId);
    if (!current.entitlementRow || current.entitlementRow.status !== "active") throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "Ative o Training antes de publicar a rotina.", 403);
    const draftRow = current.draftRow;
    if (!draftRow || draftRow.public_id !== input.routineVersionPublicId || draftRow.routine_public_id !== input.routinePublicId || draftRow.revision !== input.expectedRevision) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.VERSION_CONFLICT, "O rascunho foi atualizado em outra sessão.", 409);
    const timestamp = this.now().toISOString();
    const content = parseContent(draftRow.content_json);
    const contentJson = JSON.stringify(content);
    const contentHash = await this.hashJson(content);
    const publicationPublicId = this.generatePublicId("training_publication");
    const eventId = this.generatePublicId("event");
    const organization = await this.database.prepare("SELECT public_id FROM nf_organizations WHERE id = ? LIMIT 1").bind(input.organizationId).first<OrganizationRow>();
    if (!organization) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "Organização não encontrada.", 403);
    const finalRevision = input.expectedRevision + 1;
    const scope = [input.routineVersionPublicId, input.routinePublicId, input.organizationId, input.clientId, finalRevision] as const;
    const publishedVersion = `SELECT version.id FROM nf_training_routine_versions AS version INNER JOIN nf_training_routines AS routine ON routine.id = version.routine_id WHERE version.public_id = ? AND routine.public_id = ? AND routine.organization_id = ? AND routine.client_id = ? AND version.revision = ? AND version.state = 'published'`;
    const statements: D1PreparedStatementLike[] = [
      this.database.prepare("UPDATE nf_training_routine_versions SET revision = ?, state = 'published', snapshot_json = ?, content_hash = ?, published_by_auth_user_id = ?, published_at = ?, updated_at = ? WHERE public_id = ? AND revision = ? AND state = 'draft' AND routine_id = (SELECT id FROM nf_training_routines WHERE public_id = ? AND organization_id = ? AND client_id = ?)").bind(finalRevision, contentJson, contentHash, input.actorAuthUserId, timestamp, timestamp, input.routineVersionPublicId, input.expectedRevision, input.routinePublicId, input.organizationId, input.clientId),
      this.database.prepare(`UPDATE nf_training_routines SET status = 'published', updated_at = ? WHERE public_id = ? AND organization_id = ? AND client_id = ? AND EXISTS (${publishedVersion})`).bind(timestamp, input.routinePublicId, input.organizationId, input.clientId, ...scope),
      this.database.prepare(`UPDATE nf_training_publications SET status = 'revoked', revoked_by_auth_user_id = ?, revoked_at = ?, revocation_reason = 'Substituída por nova versão publicada' WHERE organization_id = ? AND client_id = ? AND status = 'active' AND EXISTS (${publishedVersion})`).bind(input.actorAuthUserId, timestamp, input.organizationId, input.clientId, ...scope),
      this.database.prepare(`INSERT INTO nf_training_publications (public_id, organization_id, client_id, routine_id, routine_version_id, status, published_by_auth_user_id, published_at) SELECT ?, ?, ?, routine.id, version.id, 'active', ?, ? FROM nf_training_routines AS routine INNER JOIN nf_training_routine_versions AS version ON version.routine_id = routine.id WHERE version.id = (${publishedVersion})`).bind(publicationPublicId, input.organizationId, input.clientId, input.actorAuthUserId, timestamp, ...scope),
      this.database.prepare(`INSERT INTO nf_audit_entries (public_id, organization_id, actor_auth_user_id, actor_role, action, entity_type, entity_public_id, correlation_id, before_json, after_json, occurred_at) SELECT ?, ?, ?, ?, 'training.routine.published', 'training-publication', ?, ?, NULL, ?, ? WHERE EXISTS (${publishedVersion})`).bind(this.generatePublicId("audit"), input.organizationId, input.actorAuthUserId, input.actorRole, publicationPublicId, input.correlationId, JSON.stringify({ routineVersionPublicId: input.routineVersionPublicId, contentHash }), timestamp, ...scope),
      this.database.prepare(`INSERT INTO nf_outbox_events (event_id, organization_id, event_type, event_version, aggregate_type, aggregate_public_id, aggregate_version, actor_auth_user_id, correlation_id, causation_id, occurred_at, payload_json, metadata_json, status, attempts, available_at)
        SELECT ?, ?, ?, 1, 'training-routine', ?, ?, ?, ?, NULL, ?, ?, ?, 'pending', 0, ? WHERE EXISTS (${publishedVersion})`)
        .bind(eventId, input.organizationId, TRAINING_ROUTINE_PUBLISHED, input.routinePublicId, finalRevision, input.actorAuthUserId, input.correlationId, timestamp, JSON.stringify({ clientId: input.clientId, publicationPublicId, routinePublicId: input.routinePublicId, routineVersionPublicId: input.routineVersionPublicId }), JSON.stringify({ organizationPublicId: organization.public_id, environment: process.env.NODE_ENV === "production" ? "production" : "development", source: "nutriflow-training-admin", actorRole: input.actorRole }), timestamp, ...scope),
    ];
    const result = await this.database.batch(statements);
    if (changes(result[0]) !== 1) throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.VERSION_CONFLICT, "O rascunho foi atualizado em outra sessão.", 409);
    return this.getWorkspace({ organizationId: input.organizationId, clientId: input.clientId });
  }
}
