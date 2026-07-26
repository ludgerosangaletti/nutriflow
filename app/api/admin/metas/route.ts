import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { clients, goalProgress, goals } from "../../../../db/schema";
import { getAdminSession } from "../../../supabase/server";

const categories = new Set(["weight", "waist", "hydration", "training", "cardio", "adherence", "sleep", "bowel", "meals", "custom"]);
const frequencies = new Set(["weekly", "biweekly", "monthly"]);
const statuses = new Set(["active", "achieved", "adjusted", "closed"]);

export async function POST(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 403 });
  const form = await request.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const category = String(form.get("category") || "");
  const title = String(form.get("title") || "").trim();
  const initial = Number(String(form.get("initialValue") || "").replace(",", "."));
  const target = Number(String(form.get("targetValue") || "").replace(",", "."));
  const unit = String(form.get("unit") || "").trim();
  const deadline = String(form.get("deadline") || "") || null;
  const frequency = String(form.get("frequency") || "");
  const note = String(form.get("professionalNote") || "").trim();
  if (!email || !categories.has(category) || !title || title.length > 100 || !Number.isFinite(initial) || !Number.isFinite(target) || !unit || unit.length > 20 || !frequencies.has(frequency)) return Response.json({ error: "Revise os dados da meta." }, { status: 400 });
  const db = getDb();
  const [client] = await db.select().from(clients).where(eq(clients.email, email)).limit(1);
  if (!client) return Response.json({ error: "Paciente não encontrado." }, { status: 404 });
  const active = await db.select({ id: goals.id }).from(goals).where(and(eq(goals.clientEmail, email), eq(goals.status, "active")));
  if (active.length >= 3) return Response.json({ error: "Encerre uma meta antes de adicionar outra." }, { status: 409 });
  const now = new Date().toISOString();
  const [goal] = await db.insert(goals).values({ clientEmail: email, category, title, initialValue: String(initial), targetValue: String(target), currentValue: String(initial), unit, deadline, frequency, professionalNote: note.slice(0, 600), createdAt: now, updatedAt: now }).returning();
  await db.insert(goalProgress).values({ goalId: goal.id, clientEmail: email, value: String(initial), note: "Valor inicial definido em conjunto.", source: "admin", createdAt: now });
  return Response.json({ ok: true, goal });
}

export async function PATCH(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 403 });
  const body = await request.json() as { id?: number; status?: string };
  if (!Number.isInteger(body.id) || !body.status || !statuses.has(body.status)) return Response.json({ error: "Dados inválidos." }, { status: 400 });
  const db = getDb();
  const [goal] = await db.select().from(goals).where(eq(goals.id, body.id!)).limit(1);
  if (!goal) return Response.json({ error: "Meta não encontrada." }, { status: 404 });
  if (body.status === "active" && goal.status !== "active") {
    const active = await db.select({ id: goals.id }).from(goals).where(and(eq(goals.clientEmail, goal.clientEmail), eq(goals.status, "active")));
    if (active.length >= 3) return Response.json({ error: "Já existem três metas ativas." }, { status: 409 });
  }
  const now = new Date().toISOString();
  await db.update(goals).set({ status: body.status, updatedAt: now, achievedAt: body.status === "achieved" ? now : null }).where(eq(goals.id, body.id!));
  return Response.json({ ok: true });
}
