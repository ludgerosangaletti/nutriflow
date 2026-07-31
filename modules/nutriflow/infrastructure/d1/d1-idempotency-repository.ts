import type {
  BeginIdempotentOperationInput,
  BeginIdempotentOperationResult,
  IdempotencyRecord,
  IdempotencyRepository,
} from "../../application/ports/idempotency-repository.ts";
import type { D1OperationDatabaseLike } from "./d1-operation-database.ts";

type StoredIdempotencyRow = Readonly<{
  request_hash: string;
  status: "processing" | "completed" | "failed";
  response_json: string | null;
  error_code: string | null;
  correlation_id: string;
  expires_at: string;
}>;

export class D1IdempotencyRepository implements IdempotencyRepository {
  private readonly database: D1OperationDatabaseLike;
  constructor(database: D1OperationDatabaseLike) {
    this.database = database;
  }

  async begin(input: BeginIdempotentOperationInput): Promise<BeginIdempotentOperationResult> {
    const inserted = await this.database
      .prepare(
        "INSERT INTO nf_idempotency_keys (organization_id, operation, idempotency_key, request_hash, status, correlation_id, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'processing', ?, ?, ?, ?) ON CONFLICT (organization_id, operation, idempotency_key) DO NOTHING",
      )
      .bind(
        input.organizationId,
        input.operation,
        input.idempotencyKey,
        input.requestHash,
        input.correlationId,
        input.expiresAt,
        input.now,
        input.now,
      )
      .run();
    if ((inserted.meta?.changes ?? 0) === 1) return Object.freeze({ outcome: "acquired" });

    const row = await this.database
      .prepare(
        "SELECT request_hash, status, response_json, error_code, correlation_id, expires_at FROM nf_idempotency_keys WHERE organization_id = ? AND operation = ? AND idempotency_key = ?",
      )
      .bind(input.organizationId, input.operation, input.idempotencyKey)
      .first<StoredIdempotencyRow>();
    if (!row) throw new Error("NUTRIFLOW_IDEMPOTENCY_RECORD_MISSING");

    // A key is permanently bound to the first request fingerprint, even when
    // that attempt failed. Retrying with different content is never allowed.
    if (row.request_hash !== input.requestHash) {
      return Object.freeze({ outcome: "existing", record: toRecord(row) });
    }

    if (row.status === "failed" || Date.parse(row.expires_at) < Date.parse(input.now)) {
      const reclaimed = await this.database
        .prepare(
          "UPDATE nf_idempotency_keys SET request_hash = ?, status = 'processing', response_json = NULL, error_code = NULL, correlation_id = ?, expires_at = ?, completed_at = NULL, updated_at = ? WHERE organization_id = ? AND operation = ? AND idempotency_key = ? AND (status = 'failed' OR expires_at < ?)",
        )
        .bind(
          row.request_hash,
          input.correlationId,
          input.expiresAt,
          input.now,
          input.organizationId,
          input.operation,
          input.idempotencyKey,
          input.now,
        )
        .run();
      if ((reclaimed.meta?.changes ?? 0) === 1) return Object.freeze({ outcome: "acquired" });
    }

    return Object.freeze({ outcome: "existing", record: toRecord(row) });
  }

  async complete(input: Parameters<IdempotencyRepository["complete"]>[0]) {
    const result = await this.database
      .prepare(
        "UPDATE nf_idempotency_keys SET status = 'completed', response_json = ?, error_code = NULL, completed_at = ?, updated_at = ? WHERE organization_id = ? AND operation = ? AND idempotency_key = ? AND request_hash = ? AND status = 'processing'",
      )
      .bind(
        input.responseJson,
        input.completedAt,
        input.completedAt,
        input.organizationId,
        input.operation,
        input.idempotencyKey,
        input.requestHash,
      )
      .run();
    requireSingleChange(result.meta?.changes, "COMPLETE");
  }

  async fail(input: Parameters<IdempotencyRepository["fail"]>[0]) {
    const result = await this.database
      .prepare(
        "UPDATE nf_idempotency_keys SET status = 'failed', error_code = ?, updated_at = ? WHERE organization_id = ? AND operation = ? AND idempotency_key = ? AND request_hash = ? AND status = 'processing'",
      )
      .bind(
        input.errorCode,
        input.failedAt,
        input.organizationId,
        input.operation,
        input.idempotencyKey,
        input.requestHash,
      )
      .run();
    requireSingleChange(result.meta?.changes, "FAIL");
  }
}

function toRecord(row: StoredIdempotencyRow): IdempotencyRecord {
  return Object.freeze({
    requestHash: row.request_hash,
    status: row.status,
    responseJson: row.response_json,
    errorCode: row.error_code,
    correlationId: row.correlation_id,
    expiresAt: row.expires_at,
  });
}

function requireSingleChange(changes: number | undefined, operation: string) {
  if ((changes ?? 0) !== 1) {
    throw new Error(`NUTRIFLOW_IDEMPOTENCY_${operation}_CONFLICT`);
  }
}
