import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { clients, goalProgress, goals } from "../../../../db/schema";
import { hasActiveAccess } from "../../../access";
import { getPatientUser } from "../../../supabase/server";

export async function POST(request: Request) {
  const user = await getPatientUser();
  if (!user) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const db = getDb();
  const [client] = await db.select().from(clients).where(eq(clients.authUserId, user.id)).limit(1);
  if (!client || !hasActiveAccess(client)) return Response.json({ error: "Acompanhamento indisponível." }, { status: 403 });
  const form = await request.formData();
  const goalId = Number(form.get("goalId"));
  const valueText = String(form.get("value") || "").trim().replace(",", ".");
  const value = Number(valueText);
  const note = String(form.get("note") || "").trim();
  if (!Number.isInteger(goalId) || !Number.isFinite(value) || Math.abs(value) > 1000000) return Response.json({ error: "Informe um valor válido." }, { status: 400 });
  const [goal] = await db.select().from(goals).where(and(eq(goals.id, goalId), eq(goals.clientEmail, client.email))).limit(1);
  if (!goal || goal.status !== "active") return Response.json({ error: "Meta não encontrada ou encerrada." }, { status: 404 });
  const now = new Date().toISOString();
  const formattedValue = String(value);
  await db.insert(goalProgress).values({ goalId, clientEmail: client.email, value: formattedValue, note: note.slice(0, 300), source: "patient", createdAt: now });
  await db.update(goals).set({ currentValue: formattedValue, updatedAt: now }).where(eq(goals.id, goalId));
  return Response.json({ ok: true });
}
