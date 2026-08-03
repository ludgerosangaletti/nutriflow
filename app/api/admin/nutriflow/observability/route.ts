import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { checkIns, clients, nfAuditEntries, nfFeatureFlagOverrides, nfPublications, pushSubscriptions } from "../../../../../db/schema";
import { getAdminSession } from "../../../../supabase/server";
export async function GET(request: Request) {
  const admin = await getAdminSession(); if (!admin) return Response.json({ error: "Não autorizado." }, { status: 403 });
  const clientId = Number(new URL(request.url).searchParams.get("clientId")); if (!Number.isSafeInteger(clientId) || clientId < 1) return Response.json({ error: "clientId inválido." }, { status: 400 });
  const db = getDb(); const [client] = await db.select({ id: clients.id, email: clients.email, modality: clients.modality }).from(clients).where(eq(clients.id, clientId)).limit(1); if (!client) return Response.json({ error: "Paciente não encontrado." }, { status: 404 });
  const [publication] = await db.select({ publicId: nfPublications.publicId, publishedAt: nfPublications.publishedAt }).from(nfPublications).where(and(eq(nfPublications.clientId, clientId), eq(nfPublications.status, "active"))).orderBy(desc(nfPublications.publishedAt)).limit(1);
  const [firstView, lastView] = await Promise.all([
    db.select({ occurredAt: nfAuditEntries.occurredAt }).from(nfAuditEntries).where(and(eq(nfAuditEntries.entityType, "publication"), eq(nfAuditEntries.action, "patient-portal.viewed"), eq(nfAuditEntries.entityPublicId, publication?.publicId ?? ""))).orderBy(nfAuditEntries.occurredAt).limit(1),
    db.select({ occurredAt: nfAuditEntries.occurredAt }).from(nfAuditEntries).where(and(eq(nfAuditEntries.entityType, "publication"), eq(nfAuditEntries.action, "patient-portal.viewed"), eq(nfAuditEntries.entityPublicId, publication?.publicId ?? ""))).orderBy(desc(nfAuditEntries.occurredAt)).limit(1),
  ]);
  const [push] = await db.select({ updatedAt: pushSubscriptions.updatedAt }).from(pushSubscriptions).where(eq(pushSubscriptions.clientEmail, client.email)).orderBy(desc(pushSubscriptions.updatedAt)).limit(1);
  const [checkIn] = await db.select({ weekStart: checkIns.weekStart, createdAt: checkIns.createdAt, feedback: checkIns.feedback }).from(checkIns).where(eq(checkIns.clientEmail, client.email)).orderBy(desc(checkIns.createdAt)).limit(1);
  const flags = await db.select({ flag: nfFeatureFlagOverrides.flagKey, enabled: nfFeatureFlagOverrides.enabled, variant: nfFeatureFlagOverrides.variant, expiresAt: nfFeatureFlagOverrides.expiresAt, updatedAt: nfFeatureFlagOverrides.updatedAt }).from(nfFeatureFlagOverrides).where(eq(nfFeatureFlagOverrides.clientId, clientId)).orderBy(desc(nfFeatureFlagOverrides.updatedAt));
  return Response.json({ data: { client, publication: publication ?? null, firstOpenedAt: firstView[0]?.occurredAt ?? null, lastAccessAt: lastView[0]?.occurredAt ?? null, push: push ? { registered: true, lastSyncAt: push.updatedAt } : { registered: false, lastSyncAt: null }, lastCheckIn: checkIn ?? null, flags } });
}
