import { NUTRIFLOW_ERROR_CODES } from "../../contracts/v1/errors.ts";
import { NutriFlowApplicationError } from "../../application/errors/nutriflow-application-error.ts";
import type { D1PreparedStatementLike } from "./d1-unit-of-work.ts";

type ReadStatement = Omit<D1PreparedStatementLike, "bind"> & { bind(...values: unknown[]): ReadStatement; first<T = Record<string, unknown>>(): Promise<T | null> };
type Database = { prepare(query: string): ReadStatement; batch(statements: D1PreparedStatementLike[]): Promise<unknown[]> };

export type TrainingMediaExercise = Readonly<{ id: number; publicId: string; scope: "global" | "organization"; organizationId: number | null }>;
export type TrainingMediaAsset = Readonly<{ publicId: string; objectKey: string; posterObjectKey: string | null; mimeType: string; posterMimeType: string | null; mediaKind: "video" | "gif"; status: string }>;
export type GlobalTrainingMediaImportTarget = TrainingMediaExercise & Readonly<{
  activeMediaPublicId: string | null;
  activeContentSha256: string | null;
  activePosterSha256: string | null;
}>;
export type GlobalTrainingMediaImportRecord = Readonly<{
  target: GlobalTrainingMediaImportTarget;
  objectKey: string;
  posterObjectKey: string;
  mimeType: "video/mp4";
  posterMimeType: string;
  byteSize: number;
  posterByteSize: number;
  durationMs: number;
  contentSha256?: string | null;
  posterSha256?: string | null;
  sourceUrl?: string | null;
  credit?: string | null;
  license?: string | null;
  licenseUrl?: string | null;
}>;
type ExerciseRow = Readonly<{ id: number; public_id: string; scope: "global" | "organization"; organization_id: number | null }>;
type GlobalExerciseRow = ExerciseRow & Readonly<{
  active_media_public_id: string | null;
  active_content_sha256: string | null;
  active_poster_sha256: string | null;
}>;
type MediaRow = Readonly<{ public_id: string; object_key: string; poster_object_key: string | null; mime_type: string; poster_mime_type: string | null; media_kind: "video" | "gif"; status: string }>;

function forbidden() { return new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.FORBIDDEN, "Acesso não autorizado.", 403); }

/** Metadata repository: blobs remain in R2 and catalog mutations are organization-scoped and audited. */
export class D1TrainingMediaRepository {
  private readonly database: Database;
  private readonly generatePublicId: (kind: string) => string;
  private readonly now: () => Date;

  constructor(database: Database, generatePublicId: (kind: string) => string, now: () => Date = () => new Date()) {
    this.database = database;
    this.generatePublicId = generatePublicId;
    this.now = now;
  }

  async getManageableExercise(input: Readonly<{ organizationId: number; exercisePublicId: string; allowGlobal: boolean }>): Promise<TrainingMediaExercise> {
    const row = await this.database.prepare(`SELECT id, public_id, scope, organization_id FROM nf_training_exercises
      WHERE public_id = ? AND status = 'active' AND (scope = 'organization' AND organization_id = ? OR scope = 'global' AND ? = 1) LIMIT 1`).bind(input.exercisePublicId, input.organizationId, input.allowGlobal ? 1 : 0).first<ExerciseRow>();
    if (!row) throw forbidden();
    return Object.freeze({ id: row.id, publicId: row.public_id, scope: row.scope, organizationId: row.organization_id });
  }

  async getGlobalImportTargets(exercisePublicIds: readonly string[]): Promise<readonly GlobalTrainingMediaImportTarget[]> {
    const targets: GlobalTrainingMediaImportTarget[] = [];
    for (const exercisePublicId of exercisePublicIds) {
      const row = await this.database.prepare(`SELECT exercise.id, exercise.public_id, exercise.scope, exercise.organization_id,
          (SELECT media.public_id FROM nf_training_exercise_media AS media
            WHERE media.exercise_id = exercise.id AND media.status = 'active'
            ORDER BY media.id DESC LIMIT 1) AS active_media_public_id,
          (SELECT media.content_sha256 FROM nf_training_exercise_media AS media
            WHERE media.exercise_id = exercise.id AND media.status = 'active'
            ORDER BY media.id DESC LIMIT 1) AS active_content_sha256,
          (SELECT media.poster_sha256 FROM nf_training_exercise_media AS media
            WHERE media.exercise_id = exercise.id AND media.status = 'active'
            ORDER BY media.id DESC LIMIT 1) AS active_poster_sha256
        FROM nf_training_exercises AS exercise
        WHERE exercise.public_id = ? AND exercise.scope = 'global' AND exercise.organization_id IS NULL AND exercise.status = 'active' LIMIT 1`)
        .bind(exercisePublicId).first<GlobalExerciseRow>();
      if (row) targets.push(Object.freeze({
        id: row.id,
        publicId: row.public_id,
        scope: "global",
        organizationId: null,
        activeMediaPublicId: row.active_media_public_id,
        activeContentSha256: row.active_content_sha256,
        activePosterSha256: row.active_poster_sha256,
      }));
    }
    return Object.freeze(targets);
  }

  async importGlobalBatch(input: Readonly<{
    organizationId: number;
    actorAuthUserId: string;
    actorRole: string;
    records: readonly GlobalTrainingMediaImportRecord[];
    overwriteExisting: boolean;
    correlationId: string;
  }>): Promise<readonly TrainingMediaAsset[]> {
    if (input.actorRole !== "owner") throw forbidden();
    const conflicting = input.records.find((record) => record.target.activeMediaPublicId !== null);
    if (conflicting && !input.overwriteExisting) {
      throw new NutriFlowApplicationError(NUTRIFLOW_ERROR_CODES.VERSION_CONFLICT, `Mídia já associada a ${conflicting.target.publicId}.`, 409);
    }
    const timestamp = this.now().toISOString();
    const statements: D1PreparedStatementLike[] = [];
    const assets: TrainingMediaAsset[] = [];
    for (const record of input.records) {
      const publicId = this.generatePublicId("training_media");
      if (record.target.activeMediaPublicId !== null) {
        statements.push(this.database.prepare("UPDATE nf_training_exercise_media SET status = 'replaced', replaced_at = ? WHERE exercise_id = ? AND status = 'active'").bind(timestamp, record.target.id));
      }
      statements.push(
        this.database.prepare(`INSERT INTO nf_training_exercise_media (public_id, exercise_id, media_kind, object_key, poster_object_key, mime_type, poster_mime_type, duration_ms, byte_size, poster_byte_size, content_sha256, poster_sha256, source_url, credit, license, license_url, status, created_at)
          VALUES (?, ?, 'video', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`)
          .bind(publicId, record.target.id, record.objectKey, record.posterObjectKey, record.mimeType, record.posterMimeType, record.durationMs, record.byteSize, record.posterByteSize, record.contentSha256 ?? null, record.posterSha256 ?? null, record.sourceUrl ?? null, record.credit ?? null, record.license ?? null, record.licenseUrl ?? null, timestamp),
        this.database.prepare("INSERT INTO nf_audit_entries (public_id, organization_id, actor_auth_user_id, actor_role, action, entity_type, entity_public_id, correlation_id, before_json, after_json, occurred_at) VALUES (?, ?, ?, ?, 'training.exercise-media.global-imported', 'training-exercise-media', ?, ?, ?, ?, ?)")
          .bind(
            this.generatePublicId("audit"), input.organizationId, input.actorAuthUserId, input.actorRole, publicId, input.correlationId,
            record.target.activeMediaPublicId ? JSON.stringify({ mediaPublicId: record.target.activeMediaPublicId }) : null,
            JSON.stringify({ exercisePublicId: record.target.publicId, mediaKind: "video", byteSize: record.byteSize, posterByteSize: record.posterByteSize }), timestamp,
          ),
      );
      assets.push(Object.freeze({ publicId, objectKey: record.objectKey, posterObjectKey: record.posterObjectKey, mimeType: record.mimeType, posterMimeType: record.posterMimeType, mediaKind: "video", status: "active" }));
    }
    await this.database.batch(statements);
    return Object.freeze(assets);
  }

  async replace(input: Readonly<{
    organizationId: number; actorAuthUserId: string; actorRole: string; exercise: TrainingMediaExercise; mediaKind: "video" | "gif"; objectKey: string; posterObjectKey: string; mimeType: string; posterMimeType: string; byteSize: number; posterByteSize: number; durationMs: number | null; correlationId: string;
  }>): Promise<TrainingMediaAsset> {
    const timestamp = this.now().toISOString();
    const publicId = this.generatePublicId("training_media");
    await this.database.batch([
      this.database.prepare("UPDATE nf_training_exercise_media SET status = 'replaced', replaced_at = ? WHERE exercise_id = ? AND status = 'active'").bind(timestamp, input.exercise.id),
      this.database.prepare(`INSERT INTO nf_training_exercise_media (public_id, exercise_id, media_kind, object_key, poster_object_key, mime_type, poster_mime_type, duration_ms, byte_size, poster_byte_size, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`)
        .bind(publicId, input.exercise.id, input.mediaKind, input.objectKey, input.posterObjectKey, input.mimeType, input.posterMimeType, input.durationMs, input.byteSize, input.posterByteSize, timestamp),
      this.database.prepare("INSERT INTO nf_audit_entries (public_id, organization_id, actor_auth_user_id, actor_role, action, entity_type, entity_public_id, correlation_id, before_json, after_json, occurred_at) VALUES (?, ?, ?, ?, 'training.exercise-media.replaced', 'training-exercise-media', ?, ?, NULL, ?, ?)")
        .bind(this.generatePublicId("audit"), input.organizationId, input.actorAuthUserId, input.actorRole, publicId, input.correlationId, JSON.stringify({ exercisePublicId: input.exercise.publicId, scope: input.exercise.scope, mediaKind: input.mediaKind, byteSize: input.byteSize, posterByteSize: input.posterByteSize }), timestamp),
    ]);
    return Object.freeze({ publicId, objectKey: input.objectKey, posterObjectKey: input.posterObjectKey, mimeType: input.mimeType, posterMimeType: input.posterMimeType, mediaKind: input.mediaKind, status: "active" });
  }

  async remove(input: Readonly<{ organizationId: number; actorAuthUserId: string; actorRole: string; exercise: TrainingMediaExercise; correlationId: string }>) {
    const timestamp = this.now().toISOString();
    await this.database.batch([
      this.database.prepare("UPDATE nf_training_exercise_media SET status = 'removed', removed_at = ? WHERE exercise_id = ? AND status = 'active'").bind(timestamp, input.exercise.id),
      this.database.prepare("INSERT INTO nf_audit_entries (public_id, organization_id, actor_auth_user_id, actor_role, action, entity_type, entity_public_id, correlation_id, before_json, after_json, occurred_at) VALUES (?, ?, ?, ?, 'training.exercise-media.removed', 'training-exercise', ?, ?, NULL, ?, ?)")
        .bind(this.generatePublicId("audit"), input.organizationId, input.actorAuthUserId, input.actorRole, input.exercise.publicId, input.correlationId, JSON.stringify({ exercisePublicId: input.exercise.publicId, scope: input.exercise.scope }), timestamp),
    ]);
  }

  async findAsset(publicId: string): Promise<TrainingMediaAsset | null> {
    const row = await this.database.prepare("SELECT public_id, object_key, poster_object_key, mime_type, poster_mime_type, media_kind, status FROM nf_training_exercise_media WHERE public_id = ? LIMIT 1").bind(publicId).first<MediaRow>();
    return row ? Object.freeze({ publicId: row.public_id, objectKey: row.object_key, posterObjectKey: row.poster_object_key, mimeType: row.mime_type, posterMimeType: row.poster_mime_type, mediaKind: row.media_kind, status: row.status }) : null;
  }

  /** A private-organization asset can never be served through another organization's publication. */
  async findAssetForOrganization(publicId: string, organizationId: number): Promise<TrainingMediaAsset | null> {
    const row = await this.database.prepare(`SELECT media.public_id, media.object_key, media.poster_object_key, media.mime_type, media.poster_mime_type, media.media_kind, media.status
      FROM nf_training_exercise_media AS media INNER JOIN nf_training_exercises AS exercise ON exercise.id = media.exercise_id
      WHERE media.public_id = ? AND (exercise.scope = 'global' OR exercise.organization_id = ?) LIMIT 1`).bind(publicId, organizationId).first<MediaRow>();
    return row ? Object.freeze({ publicId: row.public_id, objectKey: row.object_key, posterObjectKey: row.poster_object_key, mimeType: row.mime_type, posterMimeType: row.poster_mime_type, mediaKind: row.media_kind, status: row.status }) : null;
  }
}
