import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const clients = sqliteTable(
  "clients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    authUserId: text("auth_user_id"),
    email: text("email").notNull(),
    name: text("name").notNull(),
    whatsapp: text("whatsapp").notNull(),
    whatsappActivationOptInAt: text("whatsapp_activation_opt_in_at"),
    birthDate: text("birth_date"),
    modality: text("modality").notNull().default("online"),
    profileCompletedAt: text("profile_completed_at"),
    inviteStatus: text("invite_status").notNull().default("not_applicable"),
    inviteSentAt: text("invite_sent_at"),
    inviteAcceptedAt: text("invite_accepted_at"),
    inviteError: text("invite_error"),
    plan: text("plan").notNull(),
    paymentStatus: text("payment_status").notNull().default("pending"),
    approvalEmailStatus: text("approval_email_status").notNull().default("not_sent"),
    approvalEmailSentAt: text("approval_email_sent_at"),
    approvalEmailError: text("approval_email_error"),
    purchaseStartedAt: text("purchase_started_at"),
    purchaseAlertStatus: text("purchase_alert_status").notNull().default("not_sent"),
    purchaseAlertSentAt: text("purchase_alert_sent_at"),
    purchaseAlertError: text("purchase_alert_error"),
    accessStartedAt: text("access_started_at"),
    accessExpiresAt: text("access_expires_at"),
    nextAppointmentAt: text("next_appointment_at"),
    appointmentLocation: text("appointment_location"),
    appointmentStatus: text("appointment_status").notNull().default("scheduled"),
    appointmentConfirmedAt: text("appointment_confirmed_at"),
    appointmentConfirmationSource: text("appointment_confirmation_source"),
    googleCalendarEventId: text("google_calendar_event_id"),
    googleCalendarSyncedAt: text("google_calendar_synced_at"),
    formStatus: text("form_status").notNull().default("not_started"),
    archivedAt: text("archived_at"),
    archiveReason: text("archive_reason"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("clients_email_unique").on(table.email),
    uniqueIndex("clients_auth_user_id_unique").on(table.authUserId),
  ],
);

export const googleCalendarSettings = sqliteTable("google_calendar_settings", {
  id: integer("id").primaryKey(),
  calendarId: text("calendar_id").notNull(),
  encryptedClientId: text("encrypted_client_id").notNull(),
  encryptedClientSecret: text("encrypted_client_secret").notNull(),
  encryptedRefreshToken: text("encrypted_refresh_token"),
  status: text("status").notNull().default("credentials_saved"),
  connectedAt: text("connected_at"),
  lastSyncAt: text("last_sync_at"),
  lastSyncError: text("last_sync_error"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const anamneses = sqliteTable(
  "anamneses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientEmail: text("client_email").notNull(),
    answersJson: text("answers_json").notNull().default("{}"),
    status: text("status").notNull().default("draft"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    submittedAt: text("submitted_at"),
  },
  (table) => [
    uniqueIndex("anamneses_client_email_unique").on(table.clientEmail),
  ],
);

export const progressPhotos = sqliteTable(
  "progress_photos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientEmail: text("client_email").notNull(),
    period: text("period").notNull(),
    angle: text("angle").notNull(),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("progress_photos_period_angle_unique").on(
      table.clientEmail,
      table.period,
      table.angle,
    ),
  ],
);

export const patientDocuments = sqliteTable(
  "patient_documents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientEmail: text("client_email").notNull(),
    documentType: text("document_type").notNull(),
    title: text("title").notNull(),
    version: text("version").notNull(),
    originalName: text("original_name").notNull(),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull().default("application/pdf"),
    sizeBytes: integer("size_bytes").notNull(),
    isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    publishedAt: text("published_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("patient_documents_object_key_unique").on(table.objectKey),
  ],
);

export const checkIns = sqliteTable(
  "check_ins",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientEmail: text("client_email").notNull(),
    weekStart: text("week_start").notNull(),
    weightKg: text("weight_kg"),
    adherence: integer("adherence").notNull(),
    hunger: integer("hunger").notNull(),
    satiety: integer("satiety").notNull(),
    sleep: integer("sleep").notNull(),
    energy: integer("energy").notNull(),
    trainingSessions: integer("training_sessions").notNull().default(0),
    bowelFunction: text("bowel_function").notNull(),
    mainDifficulty: text("main_difficulty").notNull().default(""),
    weeklyWin: text("weekly_win").notNull().default(""),
    notes: text("notes").notNull().default(""),
    feedback: text("feedback").notNull().default(""),
    adminStatus: text("admin_status").notNull().default("new"),
    reviewedAt: text("reviewed_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("check_ins_client_week_unique").on(table.clientEmail, table.weekStart),
  ],
);

export const checkInReminders = sqliteTable(
  "check_in_reminders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientEmail: text("client_email").notNull(),
    weekStart: text("week_start").notNull(),
    status: text("status").notNull().default("pending"),
    providerId: text("provider_id"),
    error: text("error"),
    sentAt: text("sent_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("check_in_reminders_client_week_unique").on(
      table.clientEmail,
      table.weekStart,
    ),
  ],
);

export const renewalReminders = sqliteTable(
  "renewal_reminders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientEmail: text("client_email").notNull(),
    accessExpiresAt: text("access_expires_at").notNull(),
    daysBefore: integer("days_before").notNull(),
    status: text("status").notNull().default("pending"),
    providerId: text("provider_id"),
    error: text("error"),
    sentAt: text("sent_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("renewal_reminders_cycle_day_unique").on(
      table.clientEmail,
      table.accessExpiresAt,
      table.daysBefore,
    ),
  ],
);

export const appointmentReminders = sqliteTable(
  "appointment_reminders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientEmail: text("client_email").notNull(),
    appointmentAt: text("appointment_at").notNull(),
    status: text("status").notNull().default("pending"),
    patientProviderId: text("patient_provider_id"),
    adminProviderId: text("admin_provider_id"),
    whatsappStatus: text("whatsapp_status").notNull().default("not_configured"),
    whatsappProviderId: text("whatsapp_provider_id"),
    pendingAlertSentAt: text("pending_alert_sent_at"),
    error: text("error"),
    sentAt: text("sent_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("appointment_reminders_client_date_unique").on(
      table.clientEmail,
      table.appointmentAt,
    ),
  ],
);

export const patientActivationMessages = sqliteTable(
  "patient_activation_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientEmail: text("client_email").notNull(),
    deliveryKey: text("delivery_key").notNull(),
    kind: text("kind").notNull(),
    channel: text("channel").notNull().default("whatsapp"),
    status: text("status").notNull().default("pending"),
    providerId: text("provider_id"),
    attemptCount: integer("attempt_count").notNull().default(0),
    error: text("error"),
    sentAt: text("sent_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("patient_activation_messages_delivery_key_unique").on(
      table.deliveryKey,
    ),
    index("patient_activation_messages_client_status_idx").on(
      table.clientEmail,
      table.status,
    ),
  ],
);

export const appointmentChangeRequests = sqliteTable(
  "appointment_change_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientEmail: text("client_email").notNull(),
    currentAppointmentAt: text("current_appointment_at").notNull(),
    requestedAppointmentAt: text("requested_appointment_at"),
    action: text("action").notNull().default("reschedule"),
    status: text("status").notNull().default("pending"),
    source: text("source").notNull().default("whatsapp"),
    adminNote: text("admin_note"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    resolvedAt: text("resolved_at"),
  },
);

export const goals = sqliteTable(
  "goals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientEmail: text("client_email").notNull(),
    category: text("category").notNull(),
    title: text("title").notNull(),
    initialValue: text("initial_value").notNull(),
    targetValue: text("target_value").notNull(),
    currentValue: text("current_value").notNull(),
    unit: text("unit").notNull(),
    deadline: text("deadline"),
    frequency: text("frequency").notNull().default("weekly"),
    professionalNote: text("professional_note").notNull().default(""),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    achievedAt: text("achieved_at"),
  },
);

export const goalProgress = sqliteTable(
  "goal_progress",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    goalId: integer("goal_id").notNull(),
    clientEmail: text("client_email").notNull(),
    value: text("value").notNull(),
    note: text("note").notNull().default(""),
    source: text("source").notNull().default("patient"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
);

export const adjustmentRequests = sqliteTable(
  "adjustment_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientEmail: text("client_email").notNull(),
    reason: text("reason").notNull(),
    protocolArea: text("protocol_area").notNull(),
    description: text("description").notNull(),
    duration: text("duration").notNull(),
    attempts: text("attempts").notNull(),
    requestedChange: text("requested_change").notNull(),
    attachmentKey: text("attachment_key"),
    attachmentName: text("attachment_name"),
    attachmentType: text("attachment_type"),
    status: text("status").notNull().default("submitted"),
    adminResponse: text("admin_response"),
    linkedDocumentId: integer("linked_document_id"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    answeredAt: text("answered_at"),
    closedAt: text("closed_at"),
  },
);

export const whatsappLeads = sqliteTable(
  "whatsapp_leads",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    waId: text("wa_id").notNull(),
    phone: text("phone").notNull(),
    profileName: text("profile_name"),
    serviceInterest: text("service_interest").notNull().default("unknown"),
    source: text("source").notNull().default("direct"),
    stage: text("stage").notNull().default("new"),
    interactionCount: integer("interaction_count").notNull().default(1),
    lastInteractionKind: text("last_interaction_kind").notNull().default("text"),
    preferredPeriod: text("preferred_period"),
    preferredDay: text("preferred_day"),
    appointmentType: text("appointment_type"),
    marketingOptIn: integer("marketing_opt_in", { mode: "boolean" })
      .notNull()
      .default(false),
    marketingOptInAt: text("marketing_opt_in_at"),
    marketingOptOutAt: text("marketing_opt_out_at"),
    qualifiedAt: text("qualified_at"),
    firstContactAt: text("first_contact_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    lastContactAt: text("last_contact_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("whatsapp_leads_wa_id_unique").on(table.waId),
  ],
);

// NutriFlow tables are intentionally additive. The existing PDF workflow keeps
// using patient_documents while structured plans are protected by feature flags.
export const nfOrganizations = sqliteTable(
  "nf_organizations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_organizations_public_id_unique").on(table.publicId),
    index("nf_organizations_status_idx").on(table.status),
  ],
);

export const nfOrganizationMembers = sqliteTable(
  "nf_organization_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => nfOrganizations.id, { onDelete: "restrict" }),
    authUserId: text("auth_user_id").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_organization_members_public_id_unique").on(table.publicId),
    uniqueIndex("nf_organization_members_org_auth_unique").on(
      table.organizationId,
      table.authUserId,
    ),
    index("nf_organization_members_auth_idx").on(table.authUserId),
  ],
);

export const nfPlans = sqliteTable(
  "nf_plans",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => nfOrganizations.id, { onDelete: "restrict" }),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    status: text("status").notNull().default("draft"),
    createdByAuthUserId: text("created_by_auth_user_id").notNull(),
    archivedAt: text("archived_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_plans_public_id_unique").on(table.publicId),
    index("nf_plans_org_client_idx").on(table.organizationId, table.clientId),
    index("nf_plans_org_status_idx").on(table.organizationId, table.status),
  ],
);

export const nfPlanVersions = sqliteTable(
  "nf_plan_versions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    planId: integer("plan_id")
      .notNull()
      .references(() => nfPlans.id, { onDelete: "restrict" }),
    versionNumber: integer("version_number").notNull(),
    revision: integer("revision").notNull().default(1),
    schemaVersion: integer("schema_version").notNull().default(1),
    state: text("state").notNull().default("draft"),
    title: text("title").notNull(),
    notes: text("notes"),
    snapshotJson: text("snapshot_json"),
    contentHash: text("content_hash"),
    createdByAuthUserId: text("created_by_auth_user_id").notNull(),
    publishedByAuthUserId: text("published_by_auth_user_id"),
    publishedAt: text("published_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_plan_versions_public_id_unique").on(table.publicId),
    uniqueIndex("nf_plan_versions_plan_number_unique").on(
      table.planId,
      table.versionNumber,
    ),
    index("nf_plan_versions_plan_state_idx").on(table.planId, table.state),
  ],
);

export const nfPublications = sqliteTable(
  "nf_publications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => nfOrganizations.id, { onDelete: "restrict" }),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    planId: integer("plan_id")
      .notNull()
      .references(() => nfPlans.id, { onDelete: "restrict" }),
    planVersionId: integer("plan_version_id")
      .notNull()
      .references(() => nfPlanVersions.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("active"),
    publishedByAuthUserId: text("published_by_auth_user_id").notNull(),
    publishedAt: text("published_at").notNull(),
    revokedByAuthUserId: text("revoked_by_auth_user_id"),
    revokedAt: text("revoked_at"),
    revocationReason: text("revocation_reason"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_publications_public_id_unique").on(table.publicId),
    index("nf_publications_org_client_status_idx").on(
      table.organizationId,
      table.clientId,
      table.status,
    ),
    index("nf_publications_plan_version_idx").on(table.planVersionId),
  ],
);

export const nfAuditEntries = sqliteTable(
  "nf_audit_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => nfOrganizations.id, { onDelete: "restrict" }),
    actorAuthUserId: text("actor_auth_user_id").notNull(),
    actorRole: text("actor_role").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityPublicId: text("entity_public_id").notNull(),
    correlationId: text("correlation_id").notNull(),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    occurredAt: text("occurred_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_audit_entries_public_id_unique").on(table.publicId),
    index("nf_audit_entries_entity_idx").on(
      table.organizationId,
      table.entityType,
      table.entityPublicId,
    ),
    index("nf_audit_entries_correlation_idx").on(table.correlationId),
    index("nf_audit_entries_occurred_idx").on(table.occurredAt),
  ],
);

export const nfOutboxEvents = sqliteTable(
  "nf_outbox_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventId: text("event_id").notNull(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => nfOrganizations.id, { onDelete: "restrict" }),
    eventType: text("event_type").notNull(),
    eventVersion: integer("event_version").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregatePublicId: text("aggregate_public_id").notNull(),
    aggregateVersion: integer("aggregate_version").notNull(),
    actorAuthUserId: text("actor_auth_user_id").notNull(),
    correlationId: text("correlation_id").notNull(),
    causationId: text("causation_id"),
    occurredAt: text("occurred_at").notNull(),
    payloadJson: text("payload_json").notNull(),
    metadataJson: text("metadata_json").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: text("available_at").notNull(),
    processingStartedAt: text("processing_started_at"),
    leaseToken: text("lease_token"),
    processedAt: text("processed_at"),
    lastError: text("last_error"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_outbox_events_event_id_unique").on(table.eventId),
    index("nf_outbox_events_dispatch_idx").on(
      table.status,
      table.availableAt,
    ),
    index("nf_outbox_events_aggregate_idx").on(
      table.aggregateType,
      table.aggregatePublicId,
      table.aggregateVersion,
    ),
    index("nf_outbox_events_correlation_idx").on(table.correlationId),
  ],
);

export const nfEventConsumptions = sqliteTable(
  "nf_event_consumptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventId: text("event_id").notNull(),
    consumerName: text("consumer_name").notNull(),
    status: text("status").notNull().default("processing"),
    attempts: integer("attempts").notNull().default(1),
    availableAt: text("available_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    processingStartedAt: text("processing_started_at"),
    leaseToken: text("lease_token"),
    lastError: text("last_error"),
    processedAt: text("processed_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_event_consumptions_event_consumer_unique").on(
      table.eventId,
      table.consumerName,
    ),
    index("nf_event_consumptions_dispatch_idx").on(
      table.status,
      table.availableAt,
    ),
  ],
);

export const nfIdempotencyKeys = sqliteTable(
  "nf_idempotency_keys",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => nfOrganizations.id, { onDelete: "restrict" }),
    operation: text("operation").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    status: text("status").notNull().default("processing"),
    responseJson: text("response_json"),
    errorCode: text("error_code"),
    correlationId: text("correlation_id").notNull(),
    expiresAt: text("expires_at").notNull(),
    completedAt: text("completed_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_idempotency_keys_scope_key_unique").on(
      table.organizationId,
      table.operation,
      table.idempotencyKey,
    ),
    index("nf_idempotency_keys_expiry_idx").on(table.expiresAt),
    index("nf_idempotency_keys_correlation_idx").on(table.correlationId),
  ],
);

export const nfFeatureFlagOverrides = sqliteTable(
  "nf_feature_flag_overrides",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    flagKey: text("flag_key").notNull(),
    organizationId: integer("organization_id").references(
      () => nfOrganizations.id,
      { onDelete: "restrict" },
    ),
    clientId: integer("client_id").references(() => clients.id, {
      onDelete: "restrict",
    }),
    enabled: integer("enabled", { mode: "boolean" }).notNull(),
    variant: text("variant"),
    reason: text("reason").notNull(),
    expiresAt: text("expires_at"),
    createdByAuthUserId: text("created_by_auth_user_id").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_feature_flag_overrides_public_id_unique").on(table.publicId),
    index("nf_feature_flag_overrides_lookup_idx").on(
      table.flagKey,
      table.organizationId,
      table.clientId,
    ),
  ],
);

export const nfUnits = sqliteTable(
  "nf_units",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    organizationId: integer("organization_id").references(
      () => nfOrganizations.id,
      { onDelete: "restrict" },
    ),
    code: text("code").notNull(),
    label: text("label").notNull(),
    dimension: text("dimension").notNull(),
    factorNumerator: integer("factor_numerator").notNull().default(1),
    factorDenominator: integer("factor_denominator").notNull().default(1),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_units_public_id_unique").on(table.publicId),
    index("nf_units_scope_code_idx").on(table.organizationId, table.code),
  ],
);

export const nfNutrients = sqliteTable(
  "nf_nutrients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    unitCode: text("unit_code").notNull(),
    amountScale: integer("amount_scale").notNull().default(1000),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_nutrients_public_id_unique").on(table.publicId),
    uniqueIndex("nf_nutrients_code_unique").on(table.code),
  ],
);

export const nfFoodDataSources = sqliteTable(
  "nf_food_data_sources",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    code: text("code").notNull(),
    version: text("version").notNull(),
    name: text("name").notNull(),
    sourceUrl: text("source_url").notNull(),
    fileSha256: text("file_sha256"),
    usageStatus: text("usage_status").notNull(),
    termsNote: text("terms_note").notNull(),
    importedAt: text("imported_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_food_data_sources_public_id_unique").on(table.publicId),
    uniqueIndex("nf_food_data_sources_code_version_unique").on(
      table.code,
      table.version,
    ),
  ],
);

export const nfFoodCategories = sqliteTable(
  "nf_food_categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull(),
    label: text("label").notNull(),
    sourceGroup: text("source_group"),
    sortOrder: integer("sort_order").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_food_categories_code_unique").on(table.code),
  ],
);

export const nfFoods = sqliteTable(
  "nf_foods",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    organizationId: integer("organization_id").references(
      () => nfOrganizations.id,
      { onDelete: "restrict" },
    ),
    scope: text("scope").notNull().default("organization"),
    source: text("source").notNull().default("manual"),
    externalCode: text("external_code"),
    status: text("status").notNull().default("active"),
    createdByAuthUserId: text("created_by_auth_user_id").notNull(),
    archivedAt: text("archived_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_foods_public_id_unique").on(table.publicId),
    index("nf_foods_scope_status_idx").on(
      table.scope,
      table.organizationId,
      table.status,
    ),
    index("nf_foods_external_code_idx").on(table.source, table.externalCode),
  ],
);

export const nfFoodRevisions = sqliteTable(
  "nf_food_revisions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    foodId: integer("food_id")
      .notNull()
      .references(() => nfFoods.id, { onDelete: "restrict" }),
    revisionNumber: integer("revision_number").notNull(),
    state: text("state").notNull().default("draft"),
    name: text("name").notNull(),
    categoryCode: text("category_code"),
    aliasesJson: text("aliases_json").notNull().default("[]"),
    referenceQuantityMilli: integer("reference_quantity_milli"),
    referenceUnitId: integer("reference_unit_id").references(() => nfUnits.id, {
      onDelete: "restrict",
    }),
    sourceMetadataJson: text("source_metadata_json").notNull().default("{}"),
    createdByAuthUserId: text("created_by_auth_user_id").notNull(),
    releasedByAuthUserId: text("released_by_auth_user_id"),
    releasedAt: text("released_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_food_revisions_public_id_unique").on(table.publicId),
    uniqueIndex("nf_food_revisions_food_number_unique").on(
      table.foodId,
      table.revisionNumber,
    ),
    index("nf_food_revisions_food_state_idx").on(table.foodId, table.state),
    index("nf_food_revisions_name_idx").on(table.name),
  ],
);

export const nfFoodNutrients = sqliteTable(
  "nf_food_nutrients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    foodRevisionId: integer("food_revision_id")
      .notNull()
      .references(() => nfFoodRevisions.id, { onDelete: "restrict" }),
    nutrientId: integer("nutrient_id")
      .notNull()
      .references(() => nfNutrients.id, { onDelete: "restrict" }),
    amountScaled: integer("amount_scaled").notNull(),
    source: text("source").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_food_nutrients_revision_nutrient_unique").on(
      table.foodRevisionId,
      table.nutrientId,
    ),
    index("nf_food_nutrients_nutrient_idx").on(table.nutrientId),
  ],
);

export const nfRecipes = sqliteTable(
  "nf_recipes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    organizationId: integer("organization_id").references(
      () => nfOrganizations.id,
      { onDelete: "restrict" },
    ),
    scope: text("scope").notNull().default("organization"),
    status: text("status").notNull().default("active"),
    createdByAuthUserId: text("created_by_auth_user_id").notNull(),
    archivedAt: text("archived_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_recipes_public_id_unique").on(table.publicId),
    index("nf_recipes_scope_status_idx").on(
      table.scope,
      table.organizationId,
      table.status,
    ),
  ],
);

export const nfRecipeVersions = sqliteTable(
  "nf_recipe_versions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => nfRecipes.id, { onDelete: "restrict" }),
    versionNumber: integer("version_number").notNull(),
    state: text("state").notNull().default("draft"),
    name: text("name").notNull(),
    instructions: text("instructions"),
    yieldQuantityMilli: integer("yield_quantity_milli").notNull(),
    yieldUnitId: integer("yield_unit_id")
      .notNull()
      .references(() => nfUnits.id, { onDelete: "restrict" }),
    snapshotJson: text("snapshot_json"),
    contentHash: text("content_hash"),
    createdByAuthUserId: text("created_by_auth_user_id").notNull(),
    releasedByAuthUserId: text("released_by_auth_user_id"),
    releasedAt: text("released_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_recipe_versions_public_id_unique").on(table.publicId),
    uniqueIndex("nf_recipe_versions_recipe_number_unique").on(
      table.recipeId,
      table.versionNumber,
    ),
    index("nf_recipe_versions_recipe_state_idx").on(table.recipeId, table.state),
  ],
);

export const nfRecipeItems = sqliteTable(
  "nf_recipe_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    recipeVersionId: integer("recipe_version_id")
      .notNull()
      .references(() => nfRecipeVersions.id, { onDelete: "restrict" }),
    foodRevisionId: integer("food_revision_id")
      .notNull()
      .references(() => nfFoodRevisions.id, { onDelete: "restrict" }),
    displayNameSnapshot: text("display_name_snapshot").notNull(),
    quantityMilli: integer("quantity_milli").notNull(),
    unitId: integer("unit_id")
      .notNull()
      .references(() => nfUnits.id, { onDelete: "restrict" }),
    unitCodeSnapshot: text("unit_code_snapshot").notNull(),
    preparation: text("preparation"),
    sortOrder: integer("sort_order").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_recipe_items_public_id_unique").on(table.publicId),
    uniqueIndex("nf_recipe_items_version_order_unique").on(
      table.recipeVersionId,
      table.sortOrder,
    ),
  ],
);

export const nfMealTemplates = sqliteTable(
  "nf_meal_templates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    organizationId: integer("organization_id").references(
      () => nfOrganizations.id,
      { onDelete: "restrict" },
    ),
    scope: text("scope").notNull().default("organization"),
    status: text("status").notNull().default("active"),
    createdByAuthUserId: text("created_by_auth_user_id").notNull(),
    archivedAt: text("archived_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_meal_templates_public_id_unique").on(table.publicId),
    index("nf_meal_templates_scope_status_idx").on(
      table.scope,
      table.organizationId,
      table.status,
    ),
  ],
);

export const nfMealTemplateVersions = sqliteTable(
  "nf_meal_template_versions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    mealTemplateId: integer("meal_template_id")
      .notNull()
      .references(() => nfMealTemplates.id, { onDelete: "restrict" }),
    versionNumber: integer("version_number").notNull(),
    state: text("state").notNull().default("draft"),
    name: text("name").notNull(),
    suggestedTime: text("suggested_time"),
    instructions: text("instructions"),
    snapshotJson: text("snapshot_json"),
    contentHash: text("content_hash"),
    createdByAuthUserId: text("created_by_auth_user_id").notNull(),
    releasedByAuthUserId: text("released_by_auth_user_id"),
    releasedAt: text("released_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_meal_template_versions_public_id_unique").on(table.publicId),
    uniqueIndex("nf_meal_template_versions_template_number_unique").on(
      table.mealTemplateId,
      table.versionNumber,
    ),
    index("nf_meal_template_versions_state_idx").on(
      table.mealTemplateId,
      table.state,
    ),
  ],
);

export const nfMealTemplateItems = sqliteTable(
  "nf_meal_template_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    mealTemplateVersionId: integer("meal_template_version_id")
      .notNull()
      .references(() => nfMealTemplateVersions.id, { onDelete: "restrict" }),
    sourceType: text("source_type").notNull(),
    sourcePublicId: text("source_public_id"),
    sourceRevisionNumber: integer("source_revision_number"),
    displayNameSnapshot: text("display_name_snapshot").notNull(),
    quantityMilli: integer("quantity_milli").notNull(),
    unitId: integer("unit_id")
      .notNull()
      .references(() => nfUnits.id, { onDelete: "restrict" }),
    unitCodeSnapshot: text("unit_code_snapshot").notNull(),
    preparation: text("preparation"),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_meal_template_items_public_id_unique").on(table.publicId),
    uniqueIndex("nf_meal_template_items_version_order_unique").on(
      table.mealTemplateVersionId,
      table.sortOrder,
    ),
  ],
);

export const nfPlanDays = sqliteTable(
  "nf_plan_days",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    planVersionId: integer("plan_version_id")
      .notNull()
      .references(() => nfPlanVersions.id, { onDelete: "restrict" }),
    label: text("label").notNull(),
    dayIndex: integer("day_index"),
    sortOrder: integer("sort_order").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_plan_days_public_id_unique").on(table.publicId),
    uniqueIndex("nf_plan_days_version_order_unique").on(
      table.planVersionId,
      table.sortOrder,
    ),
  ],
);

export const nfMeals = sqliteTable(
  "nf_meals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    planVersionId: integer("plan_version_id")
      .notNull()
      .references(() => nfPlanVersions.id, { onDelete: "restrict" }),
    planDayId: integer("plan_day_id").references(() => nfPlanDays.id, {
      onDelete: "restrict",
    }),
    title: text("title").notNull(),
    scheduledTime: text("scheduled_time"),
    instructions: text("instructions"),
    sourceTemplatePublicId: text("source_template_public_id"),
    sourceTemplateVersionNumber: integer("source_template_version_number"),
    sortOrder: integer("sort_order").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_meals_public_id_unique").on(table.publicId),
    index("nf_meals_version_order_idx").on(
      table.planVersionId,
      table.planDayId,
      table.sortOrder,
    ),
  ],
);

export const nfMealItems = sqliteTable(
  "nf_meal_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    mealId: integer("meal_id")
      .notNull()
      .references(() => nfMeals.id, { onDelete: "restrict" }),
    sourceType: text("source_type").notNull().default("manual"),
    sourcePublicId: text("source_public_id"),
    sourceRevisionNumber: integer("source_revision_number"),
    displayNameSnapshot: text("display_name_snapshot").notNull(),
    quantityMilli: integer("quantity_milli").notNull(),
    unitId: integer("unit_id")
      .notNull()
      .references(() => nfUnits.id, { onDelete: "restrict" }),
    unitCodeSnapshot: text("unit_code_snapshot").notNull(),
    unitLabelSnapshot: text("unit_label_snapshot").notNull(),
    preparation: text("preparation"),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_meal_items_public_id_unique").on(table.publicId),
    uniqueIndex("nf_meal_items_meal_order_unique").on(
      table.mealId,
      table.sortOrder,
    ),
    index("nf_meal_items_source_idx").on(
      table.sourceType,
      table.sourcePublicId,
      table.sourceRevisionNumber,
    ),
  ],
);

export const nfSubstitutionGroups = sqliteTable(
  "nf_substitution_groups",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    planVersionId: integer("plan_version_id")
      .notNull()
      .references(() => nfPlanVersions.id, { onDelete: "restrict" }),
    mealId: integer("meal_id").references(() => nfMeals.id, {
      onDelete: "restrict",
    }),
    mealItemId: integer("meal_item_id").references(() => nfMealItems.id, {
      onDelete: "restrict",
    }),
    title: text("title").notNull(),
    ruleCode: text("rule_code").notNull().default("choose_one"),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_substitution_groups_public_id_unique").on(table.publicId),
    index("nf_substitution_groups_version_order_idx").on(
      table.planVersionId,
      table.sortOrder,
    ),
  ],
);

export const nfSubstitutionOptions = sqliteTable(
  "nf_substitution_options",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    substitutionGroupId: integer("substitution_group_id")
      .notNull()
      .references(() => nfSubstitutionGroups.id, { onDelete: "restrict" }),
    sourceType: text("source_type").notNull().default("manual"),
    sourcePublicId: text("source_public_id"),
    sourceRevisionNumber: integer("source_revision_number"),
    displayNameSnapshot: text("display_name_snapshot").notNull(),
    quantityMilli: integer("quantity_milli").notNull(),
    unitId: integer("unit_id")
      .notNull()
      .references(() => nfUnits.id, { onDelete: "restrict" }),
    unitCodeSnapshot: text("unit_code_snapshot").notNull(),
    unitLabelSnapshot: text("unit_label_snapshot").notNull(),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_substitution_options_public_id_unique").on(table.publicId),
    uniqueIndex("nf_substitution_options_group_order_unique").on(
      table.substitutionGroupId,
      table.sortOrder,
    ),
  ],
);

export const nfPlanNotes = sqliteTable(
  "nf_plan_notes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    planVersionId: integer("plan_version_id")
      .notNull()
      .references(() => nfPlanVersions.id, { onDelete: "restrict" }),
    mealId: integer("meal_id").references(() => nfMeals.id, {
      onDelete: "restrict",
    }),
    kind: text("kind").notNull().default("general"),
    content: text("content").notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_plan_notes_public_id_unique").on(table.publicId),
    index("nf_plan_notes_version_order_idx").on(
      table.planVersionId,
      table.mealId,
      table.sortOrder,
    ),
  ],
);

export const nfDeliverySettings = sqliteTable(
  "nf_delivery_settings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => nfOrganizations.id, { onDelete: "restrict" }),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    primarySource: text("primary_source").notNull().default("pdf"),
    allowPdfFallback: integer("allow_pdf_fallback", { mode: "boolean" })
      .notNull()
      .default(true),
    updatedByAuthUserId: text("updated_by_auth_user_id").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("nf_delivery_settings_public_id_unique").on(table.publicId),
    uniqueIndex("nf_delivery_settings_org_client_unique").on(
      table.organizationId,
      table.clientId,
    ),
  ],
);
