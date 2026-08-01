export type NutriFlowMembershipRecord = Readonly<{
  organization_id: number;
  organization_public_id: string;
  role: string;
}>;

type OrganizationRow = Readonly<{
  id: number;
  public_id: string;
}>;

type OrganizationMemberRow = Readonly<{
  public_id: string;
}>;

interface D1BootstrapStatementLike {
  bind(...values: unknown[]): D1BootstrapStatementLike;
  first<T>(): Promise<T | null>;
}

export interface D1AdminBootstrapDatabaseLike {
  prepare(query: string): D1BootstrapStatementLike;
  batch(statements: D1BootstrapStatementLike[]): Promise<unknown[]>;
}

const staffRoles = new Set(["owner", "admin", "nutritionist"]);
const PRIMARY_ORGANIZATION_PUBLIC_ID = "org_ludgero_sangaletti";

export async function resolveNutriFlowStaffMembership(
  database: D1AdminBootstrapDatabaseLike,
  authUserId: string,
): Promise<NutriFlowMembershipRecord | null> {
  const row = await database.prepare(
    `SELECT member.organization_id, organization.public_id AS organization_public_id, member.role
     FROM nf_organization_members AS member
     INNER JOIN nf_organizations AS organization ON organization.id = member.organization_id
     WHERE member.auth_user_id = ? AND member.status = 'active' AND organization.status = 'active'
     ORDER BY member.id ASC LIMIT 1`,
  ).bind(authUserId).first<NutriFlowMembershipRecord>();
  return row && staffRoles.has(row.role) ? row : null;
}

export async function ensurePrimaryOwnerMembership(input: Readonly<{
  database: D1AdminBootstrapDatabaseLike;
  authUserId: string;
  email: string;
  expectedAdminEmail: string | null | undefined;
  now?: Date;
  environment: string;
}>): Promise<NutriFlowMembershipRecord | null> {
  if (!sameEmail(input.email, input.expectedAdminEmail)) return null;
  const existing = await resolveNutriFlowStaffMembership(
    input.database,
    input.authUserId,
  );
  if (existing) return existing;

  const currentOrganization = await input.database.prepare(
    "SELECT id, public_id FROM nf_organizations WHERE status = 'active' ORDER BY id ASC LIMIT 1",
  ).first<OrganizationRow>();
  const organizationPublicId = currentOrganization?.public_id ?? PRIMARY_ORGANIZATION_PUBLIC_ID;
  const currentMember = currentOrganization
    ? await input.database.prepare(
        "SELECT public_id FROM nf_organization_members WHERE organization_id = ? AND auth_user_id = ? LIMIT 1",
      ).bind(currentOrganization.id, input.authUserId).first<OrganizationMemberRow>()
    : null;
  const memberPublicId = currentMember?.public_id ?? `member_${crypto.randomUUID()}`;
  const occurredAt = (input.now ?? new Date()).toISOString();
  const auditPublicId = `audit_admin_bootstrap_${input.authUserId}`;
  const eventId = `event_admin_bootstrap_${input.authUserId}`;
  const correlationId = `corr_admin_bootstrap_${input.authUserId}`;

  const statements: D1BootstrapStatementLike[] = [];
  if (!currentOrganization) {
    statements.push(input.database.prepare(
      "INSERT OR IGNORE INTO nf_organizations (public_id, name, status, created_at, updated_at) VALUES (?, 'Ludgero Sangaletti', 'active', ?, ?)",
    ).bind(organizationPublicId, occurredAt, occurredAt));
  }
  statements.push(
    input.database.prepare(
      `INSERT INTO nf_organization_members (public_id, organization_id, auth_user_id, role, status, created_at, updated_at)
       SELECT ?, organization.id, ?, 'owner', 'active', ?, ?
       FROM nf_organizations AS organization WHERE organization.public_id = ?
       ON CONFLICT(organization_id, auth_user_id) DO UPDATE SET role = 'owner', status = 'active', updated_at = excluded.updated_at`,
    ).bind(memberPublicId, input.authUserId, occurredAt, occurredAt, organizationPublicId),
    input.database.prepare(
      `INSERT OR IGNORE INTO nf_audit_entries
       (public_id, organization_id, actor_auth_user_id, actor_role, action, entity_type, entity_public_id, correlation_id, before_json, after_json, occurred_at)
       SELECT ?, organization.id, ?, 'owner', 'organization.owner.bootstrapped', 'organization-member', ?, ?, NULL, ?, ?
       FROM nf_organizations AS organization WHERE organization.public_id = ?`,
    ).bind(
      auditPublicId,
      input.authUserId,
      memberPublicId,
      correlationId,
      JSON.stringify({ role: "owner", status: "active" }),
      occurredAt,
      organizationPublicId,
    ),
    input.database.prepare(
      `INSERT OR IGNORE INTO nf_outbox_events
       (event_id, organization_id, event_type, event_version, aggregate_type, aggregate_public_id, aggregate_version, actor_auth_user_id, correlation_id, causation_id, occurred_at, payload_json, metadata_json, status, attempts, available_at)
       SELECT ?, organization.id, 'organization.owner.bootstrapped', 1, 'organization-member', ?, 1, ?, ?, NULL, ?, ?, ?, 'pending', 0, ?
       FROM nf_organizations AS organization WHERE organization.public_id = ?`,
    ).bind(
      eventId,
      memberPublicId,
      input.authUserId,
      correlationId,
      occurredAt,
      JSON.stringify({ authUserId: input.authUserId, role: "owner", status: "active" }),
      JSON.stringify({
        organizationPublicId,
        environment: input.environment,
        source: "nutriflow-admin-bootstrap",
      }),
      occurredAt,
      organizationPublicId,
    ),
  );
  await input.database.batch(statements);
  return resolveNutriFlowStaffMembership(input.database, input.authUserId);
}

function sameEmail(email: string, expected: string | null | undefined) {
  return Boolean(
    expected && email.trim().toLowerCase() === expected.trim().toLowerCase(),
  );
}
