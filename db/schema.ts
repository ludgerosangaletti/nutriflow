import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const clients = sqliteTable(
  "clients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    authUserId: text("auth_user_id"),
    email: text("email").notNull(),
    name: text("name").notNull(),
    whatsapp: text("whatsapp").notNull(),
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
    formStatus: text("form_status").notNull().default("not_started"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("clients_email_unique").on(table.email),
    uniqueIndex("clients_auth_user_id_unique").on(table.authUserId),
  ],
);

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
