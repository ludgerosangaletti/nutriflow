import assert from "node:assert/strict";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import { D1PatientPortalViewRecorder } from "../modules/nutriflow/infrastructure/d1/d1-patient-portal-view-recorder.ts";
import type { D1OperationDatabaseLike, D1OperationStatementLike } from "../modules/nutriflow/infrastructure/d1/d1-operation-database.ts";

class Statement implements D1OperationStatementLike {
  private values: unknown[] = [];
  private readonly database: DatabaseSync;
  private readonly query: string;
  constructor(database: DatabaseSync, query: string) {
    this.database = database;
    this.query = query;
  }
  bind(...values: unknown[]) { this.values = values; return this; }
  async first<T>() { return (this.database.prepare(this.query).get(...this.sqlValues()) as T | undefined) ?? null; }
  async all<T>() { return { results: this.database.prepare(this.query).all(...this.sqlValues()) as T[] }; }
  async run() {
    const result = this.database.prepare(this.query).run(...this.sqlValues());
    return { meta: { changes: Number(result.changes) } };
  }
  private sqlValues() { return this.values as SQLInputValue[]; }
}

class Database implements D1OperationDatabaseLike {
  readonly sqlite: DatabaseSync;
  constructor(sqlite: DatabaseSync) { this.sqlite = sqlite; }
  prepare(query: string) { return new Statement(this.sqlite, query); }
}

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE nf_publications (
      public_id TEXT PRIMARY KEY,
      organization_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE nf_audit_entries (
      public_id TEXT PRIMARY KEY,
      organization_id INTEGER NOT NULL,
      actor_auth_user_id TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_public_id TEXT NOT NULL,
      correlation_id TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      occurred_at TEXT NOT NULL
    );
    INSERT INTO nf_publications VALUES
      ('publication_01', 1, 7, 'active'),
      ('publication_other', 1, 8, 'active'),
      ('publication_revoked', 1, 7, 'revoked');
  `);
  return { sqlite, recorder: new D1PatientPortalViewRecorder(new Database(sqlite)) };
}

test("patient portal view is authorized, auditable and idempotent per publication", async () => {
  const { sqlite, recorder } = fixture();
  const base = {
    organizationId: 1,
    clientId: 7,
    actorAuthUserId: "auth_patient_07",
    publicationPublicId: "publication_01",
    correlationId: "corr_view_01",
    occurredAt: "2026-08-02T12:00:00.000Z",
  };
  assert.equal((await recorder.record({ ...base, publicId: "audit_01" })).recorded, true);
  assert.equal((await recorder.record({ ...base, publicId: "audit_02" })).recorded, false);
  assert.equal(sqlite.prepare("SELECT count(*) AS total FROM nf_audit_entries").get()?.total, 1);
  assert.equal(JSON.parse(String(sqlite.prepare("SELECT after_json FROM nf_audit_entries").get()?.after_json)).clientId, 7);
});

test("patient portal view rejects another patient's or revoked publication", async () => {
  const { sqlite, recorder } = fixture();
  const base = {
    organizationId: 1,
    clientId: 7,
    actorAuthUserId: "auth_patient_07",
    correlationId: "corr_view_02",
    occurredAt: "2026-08-02T12:00:00.000Z",
  };
  assert.equal((await recorder.record({ ...base, publicId: "audit_other", publicationPublicId: "publication_other" })).recorded, false);
  assert.equal((await recorder.record({ ...base, publicId: "audit_revoked", publicationPublicId: "publication_revoked" })).recorded, false);
  assert.equal(sqlite.prepare("SELECT count(*) AS total FROM nf_audit_entries").get()?.total, 0);
});
