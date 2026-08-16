import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { clients } from "../../../../../db/schema";
import { sendContentReadyWhatsApp, type ContentReadyKind } from "../../../../../app/whatsapp-content-ready";
import type { DomainEvent } from "../../../domain/events/domain-event.ts";
import { PLAN_VERSION_PUBLISHED } from "../../../domain/plans/plan-events.ts";
import { CLINICAL_ANAMNESIS_SUBMITTED, TRAINING_ANAMNESIS_SUBMITTED, TRAINING_ROUTINE_PUBLISHED } from "../../../domain/notifications/workflow-events.ts";
import type { NamedDomainEventHandler } from "../reliable-domain-event-dispatcher.ts";

type PatientRow = Readonly<{ id: number; email: string; name: string; whatsapp: string; modality: string; whatsappActivationOptInAt: string | null }>;

async function patient(event: DomainEvent): Promise<PatientRow> {
  const clientId = Number(event.payload.clientId);
  const [row] = await getDb().select({
    id: clients.id, email: clients.email, name: clients.name, whatsapp: clients.whatsapp,
    modality: clients.modality, whatsappActivationOptInAt: clients.whatsappActivationOptInAt,
  }).from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!row) throw new Error("NF_NOTIFICATION_PATIENT_NOT_FOUND");
  return row;
}

async function sendEmail(event: DomainEvent, kind: "diet" | "training" | "clinical_anamnesis" | "training_anamnesis") {
  const current = await patient(event);
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/nutriflow-workflow-email`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-checkin-reminder-secret": env.CHECKIN_REMINDER_SECRET || "" },
    body: JSON.stringify({
      kind, eventId: event.eventId, patientName: current.name, patientEmail: current.email,
      modality: current.modality, referenceId: String(event.payload.publicationPublicId || event.payload.anamnesisPublicId || event.eventId),
    }),
  });
  if (!response.ok) throw new Error("NF_NOTIFICATION_EMAIL_FAILED");
}

function emailHandler(eventType: string, kind: "diet" | "training" | "clinical_anamnesis" | "training_anamnesis"): NamedDomainEventHandler {
  return { consumerName: `email.${kind}.v1`, eventType, handle: (event) => sendEmail(event, kind) };
}

function whatsappHandler(eventType: string, kind: ContentReadyKind): NamedDomainEventHandler {
  return {
    consumerName: `whatsapp.${kind}.v1`, eventType,
    async handle(event) {
      const current = await patient(event);
      const result = await sendContentReadyWhatsApp({
        accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
        templateName: kind === "diet" ? process.env.WHATSAPP_PLAN_READY_TEMPLATE_NAME : process.env.WHATSAPP_TRAINING_READY_TEMPLATE_NAME,
        recipient: current.whatsapp, patientName: current.name, kind,
        authorized: Boolean(current.whatsappActivationOptInAt),
      });
      if (result.status === "not_authorized") return;
      if (result.status !== "accepted") throw new Error(result.status === "not_configured" ? "NF_NOTIFICATION_TEMPLATE_NOT_CONFIGURED" : "NF_NOTIFICATION_WHATSAPP_FAILED");
    },
  };
}

export const workflowNotificationHandlers: readonly NamedDomainEventHandler[] = Object.freeze([
  emailHandler(PLAN_VERSION_PUBLISHED, "diet"),
  emailHandler(TRAINING_ROUTINE_PUBLISHED, "training"),
  whatsappHandler(TRAINING_ROUTINE_PUBLISHED, "training"),
  emailHandler(CLINICAL_ANAMNESIS_SUBMITTED, "clinical_anamnesis"),
  emailHandler(TRAINING_ANAMNESIS_SUBMITTED, "training_anamnesis"),
]);
