import { NUTRIFLOW_API_VERSION } from "../../contracts/v1/errors.ts";
import type { TrainingExerciseLibraryItemV1 } from "../../contracts/v1/training.ts";
import type {
  TrainingExerciseLibrarySearchResultV1,
  TrainingLibraryRepository,
} from "../../application/ports/training-library-repository.ts";
import type { D1OperationDatabaseLike } from "./d1-operation-database.ts";

type TrainingExerciseRow = Readonly<{
  public_id: string;
  name: string;
  primary_muscle_group: string;
  aliases_json: string;
  instructions: string | null;
  scope: "global" | "organization";
  poster_object_key: string | null;
  media_public_id: string | null;
  media_object_key: string | null;
  media_kind: "video" | "gif" | null;
  duration_ms: number | null;
}>;

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function parseAliases(value: string): readonly string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? Object.freeze(parsed.filter((entry): entry is string => typeof entry === "string"))
      : Object.freeze([]);
  } catch {
    return Object.freeze([]);
  }
}

/** D1 implementation deliberately never reads another organization's exercises. */
export class D1TrainingLibraryRepository implements TrainingLibraryRepository {
  private readonly database: D1OperationDatabaseLike;

  constructor(database: D1OperationDatabaseLike) {
    this.database = database;
  }

  async search(input: Parameters<TrainingLibraryRepository["search"]>[0]): Promise<TrainingExerciseLibrarySearchResultV1> {
    const query = input.query.query.trim().toLocaleLowerCase("pt-BR");
    const escapedQuery = escapeLike(query);
    const result = await this.database.prepare(
      `SELECT exercise.public_id, exercise.name, exercise.primary_muscle_group,
              exercise.aliases_json, exercise.instructions, exercise.scope,
              (SELECT media.poster_object_key
                 FROM nf_training_exercise_media AS media
                WHERE media.exercise_id = exercise.id AND media.status = 'active'
                ORDER BY media.id DESC LIMIT 1) AS poster_object_key,
              (SELECT media.public_id
                 FROM nf_training_exercise_media AS media
                WHERE media.exercise_id = exercise.id AND media.status = 'active'
                ORDER BY media.id DESC LIMIT 1) AS media_public_id,
              (SELECT media.object_key
                 FROM nf_training_exercise_media AS media
                WHERE media.exercise_id = exercise.id AND media.status = 'active'
                ORDER BY media.id DESC LIMIT 1) AS media_object_key,
              (SELECT media.media_kind
                 FROM nf_training_exercise_media AS media
                WHERE media.exercise_id = exercise.id AND media.status = 'active'
                ORDER BY media.id DESC LIMIT 1) AS media_kind
              ,(SELECT media.duration_ms
                 FROM nf_training_exercise_media AS media
                WHERE media.exercise_id = exercise.id AND media.status = 'active'
                ORDER BY media.id DESC LIMIT 1) AS duration_ms
         FROM nf_training_exercises AS exercise
        WHERE exercise.status = 'active'
          AND (exercise.scope = 'global'
            OR (exercise.scope = 'organization' AND exercise.organization_id = ?))
          AND (? = '' OR lower(exercise.name) LIKE ? ESCAPE '\\'
            OR lower(exercise.aliases_json) LIKE ? ESCAPE '\\')
          AND (? IS NULL OR exercise.primary_muscle_group = ?)
        ORDER BY CASE WHEN lower(exercise.name) = ? THEN 0
                      WHEN lower(exercise.name) LIKE ? ESCAPE '\\' THEN 1
                      WHEN lower(exercise.aliases_json) LIKE ? ESCAPE '\\' THEN 2
                      ELSE 3 END,
                 CASE WHEN exercise.scope = 'organization' THEN 0 ELSE 1 END,
                 exercise.name COLLATE NOCASE
        LIMIT ?`,
    ).bind(
      input.organizationId,
      query,
      `%${escapedQuery}%`,
      `%${escapedQuery}%`,
      input.query.muscleGroup,
      input.query.muscleGroup,
      query,
      `${escapedQuery}%`,
      `%${escapedQuery}%`,
      input.query.limit + 1,
    ).all<TrainingExerciseRow>();

    const items = Object.freeze(result.results.slice(0, input.query.limit).map((row): TrainingExerciseLibraryItemV1 => Object.freeze({
      apiVersion: NUTRIFLOW_API_VERSION,
      publicId: row.public_id,
      name: row.name,
      primaryMuscleGroup: row.primary_muscle_group,
      aliases: parseAliases(row.aliases_json),
      instructions: row.instructions,
      scope: row.scope,
      media: row.media_kind === null || row.media_public_id === null || row.media_object_key === null
        ? null
        : Object.freeze({ publicId: row.media_public_id, posterObjectKey: row.poster_object_key, objectKey: row.media_object_key, mediaKind: row.media_kind, durationMs: row.duration_ms }),
    })));

    return Object.freeze({
      query: input.query.query,
      items,
      hasMore: result.results.length > input.query.limit,
    });
  }
}
