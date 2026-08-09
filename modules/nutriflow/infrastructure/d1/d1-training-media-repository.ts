import { NUTRIFLOW_ERROR_CODES } from "../../contracts/v1/errors.ts";
import { NutriFlowApplicationError } from "../../application/errors/nutriflow-application-error.ts";
import type { D1PreparedStatementLike } from "./d1-unit-of-work.ts";

type ReadStatement = Omit<D1PreparedStatementLike, "bind"> & { bind(...values: unknown[]): ReadStatement; first<T = Record<string, unknown>>(): Promise<T | null> };
type Database = { prepare(query: string): ReadStatement; batch(statements: D1PreparedStatementLike[]): Promise<unknown[]> };

export type TrainingMediaExercise = Readonly<{ id: number; publicId: string; scope: "global" | "organization"; organizationId: number | null }>;
export type TrainingMediaAsset = Readonly<{ publicId: string; objectKey: string; posterObjectKey: string | null; mimeType: string; posterMimeType: string | null; mediaKind: "video" | "gif"; status: string }>;
type ExerciseRow = Readonly<{ id: number; public_id: string; scope: "global" | "organization"; organization_id: number | null }>;
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
