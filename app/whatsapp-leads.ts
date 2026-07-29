import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { whatsappLeads } from "../db/schema";

export type LeadService =
  | "presencial"
  | "online"
  | "mentoria"
  | "avaliacao"
  | "unknown";

export type LeadStage = "new" | "informed" | "qualified";

export type LeadInteraction = {
  waId: string;
  profileName?: string | null;
  serviceInterest: LeadService;
  source: "linktree" | "direct";
  stage: LeadStage;
  interactionKind: string;
  preferredPeriod?: string | null;
  preferredDay?: string | null;
  appointmentType?: string | null;
  marketingConsent: boolean | null;
};

export async function getWhatsappLeadContext(waId: string) {
  const phone = waId.replace(/\D/g, "");
  const db = getDb();
  const [lead] = await db
    .select({
      serviceInterest: whatsappLeads.serviceInterest,
      lastInteractionKind: whatsappLeads.lastInteractionKind,
      preferredPeriod: whatsappLeads.preferredPeriod,
      preferredDay: whatsappLeads.preferredDay,
      appointmentType: whatsappLeads.appointmentType,
    })
    .from(whatsappLeads)
    .where(eq(whatsappLeads.waId, phone))
    .limit(1);

  return lead || null;
}

export async function recordWhatsappLead(interaction: LeadInteraction) {
  const db = getDb();
  const now = new Date().toISOString();
  const profileName = interaction.profileName?.trim().slice(0, 120) || null;
  const phone = interaction.waId.replace(/\D/g, "");

  await db
    .insert(whatsappLeads)
    .values({
      waId: phone,
      phone,
      profileName,
      serviceInterest: interaction.serviceInterest,
      source: interaction.source,
      stage: interaction.stage,
      lastInteractionKind: interaction.interactionKind.slice(0, 40),
      preferredPeriod: interaction.preferredPeriod || null,
      preferredDay: interaction.preferredDay || null,
      appointmentType: interaction.appointmentType || null,
      marketingOptIn: interaction.marketingConsent === true,
      marketingOptInAt: interaction.marketingConsent === true ? now : null,
      marketingOptOutAt: interaction.marketingConsent === false ? now : null,
      qualifiedAt: interaction.stage === "qualified" ? now : null,
      firstContactAt: now,
      lastContactAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: whatsappLeads.waId,
      set: {
        phone,
        profileName: profileName || sql`${whatsappLeads.profileName}`,
        serviceInterest:
          interaction.serviceInterest === "unknown"
            ? sql`${whatsappLeads.serviceInterest}`
            : interaction.serviceInterest,
        source:
          interaction.source === "linktree"
            ? "linktree"
            : sql`${whatsappLeads.source}`,
        stage: sql`CASE
          WHEN ${whatsappLeads.stage} IN ('converted', 'archived') THEN ${whatsappLeads.stage}
          WHEN ${interaction.stage} = 'qualified' THEN 'qualified'
          WHEN ${whatsappLeads.stage} = 'qualified' THEN 'qualified'
          WHEN ${interaction.stage} = 'informed' THEN 'informed'
          ELSE ${whatsappLeads.stage}
        END`,
        interactionCount: sql`${whatsappLeads.interactionCount} + 1`,
        lastInteractionKind: interaction.interactionKind.slice(0, 40),
        preferredPeriod:
          interaction.preferredPeriod === undefined
            ? sql`${whatsappLeads.preferredPeriod}`
            : interaction.preferredPeriod,
        preferredDay:
          interaction.preferredDay === undefined
            ? sql`${whatsappLeads.preferredDay}`
            : interaction.preferredDay,
        appointmentType:
          interaction.appointmentType === undefined
            ? sql`${whatsappLeads.appointmentType}`
            : interaction.appointmentType,
        marketingOptIn:
          interaction.marketingConsent === null
            ? sql`${whatsappLeads.marketingOptIn}`
            : interaction.marketingConsent,
        marketingOptInAt:
          interaction.marketingConsent === true
            ? now
            : sql`${whatsappLeads.marketingOptInAt}`,
        marketingOptOutAt:
          interaction.marketingConsent === false
            ? now
            : interaction.marketingConsent === true
              ? null
              : sql`${whatsappLeads.marketingOptOutAt}`,
        qualifiedAt:
          interaction.stage === "qualified"
            ? sql`COALESCE(${whatsappLeads.qualifiedAt}, ${now})`
            : sql`${whatsappLeads.qualifiedAt}`,
        lastContactAt: now,
        updatedAt: now,
      },
    });
}
