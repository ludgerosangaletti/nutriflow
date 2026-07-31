export type NewAuditEntry = Readonly<{
  publicId: string;
  actorAuthUserId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityPublicId: string;
  correlationId: string;
  beforeJson: string | null;
  afterJson: string | null;
  occurredAt: string;
}>;

export interface AuditWriteRepository {
  append(entry: NewAuditEntry): void;
}
