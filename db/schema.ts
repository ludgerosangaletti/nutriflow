import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const clients = sqliteTable(
  "clients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    name: text("name").notNull(),
    whatsapp: text("whatsapp").notNull(),
    plan: text("plan").notNull(),
    paymentStatus: text("payment_status").notNull().default("pending"),
    formStatus: text("form_status").notNull().default("not_started"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("clients_email_unique").on(table.email)],
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
