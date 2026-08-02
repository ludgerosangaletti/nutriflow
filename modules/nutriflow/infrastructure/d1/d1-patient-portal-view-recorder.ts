import type { D1OperationDatabaseLike } from "./d1-operation-database.ts";

export class D1PatientPortalViewRecorder {
  private readonly database: D1OperationDatabaseLike;

  constructor(database: D1OperationDatabaseLike) {
    this.database = database;
  }

  async record(input: Readonly<{
    publicId: string;
    organizationId: number;
    clientId: number;
    actorAuthUserId: string;
    publicationPublicId: string;
    correlationId: string;
    occurredAt: string;
  }>) {
    const afterJson = JSON.stringify({ clientId: input.clientId });
    const result = await this.database.prepare(`
      INSERT INTO nf_audit_entries (
        public_id, organization_id, actor_auth_user_id, actor_role, action,
        entity_type, entity_public_id, correlation_id, before_json,
        after_json, occurred_at
      )
      SELECT ?, ?, ?, 'patient', 'patient-portal.viewed',
        'publication', ?, ?, NULL, ?, ?
      FROM nf_publications AS publication
      WHERE publication.public_id = ?
        AND publication.organization_id = ?
        AND publication.client_id = ?
        AND publication.status = 'active'
        AND NOT EXISTS (
          SELECT 1
          FROM nf_audit_entries AS prior
          WHERE prior.organization_id = ?
            AND prior.action = 'patient-portal.viewed'
            AND prior.entity_type = 'publication'
            AND prior.entity_public_id = ?
            AND json_extract(prior.after_json, '$.clientId') = ?
        )
    `).bind(
      input.publicId,
      input.organizationId,
      input.actorAuthUserId,
      input.publicationPublicId,
      input.correlationId,
      afterJson,
      input.occurredAt,
      input.publicationPublicId,
      input.organizationId,
      input.clientId,
      input.organizationId,
      input.publicationPublicId,
      input.clientId,
    ).run();

    return Object.freeze({ recorded: (result.meta?.changes ?? 0) === 1 });
  }
}
