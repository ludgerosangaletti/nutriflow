import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { checkIns, clients } from "../../../db/schema";
import { hasActiveAccess } from "../../access";
import { getPatientUser } from "../../supabase/server";
import { isWeeklyCheckInAvailable } from "../../check-in/availability";

function currentWeekStart() { const now = new Date(); const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); const day = utc.getUTCDay() || 7; utc.setUTCDate(utc.getUTCDate() - day + 1); return utc.toISOString().slice(0, 10); }
function scale(form: FormData, name: string) { const value = Number(form.get(name)); return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null; }

export async function POST(request: Request) {
  const user = await getPatientUser();
  if (!user) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const db = getDb();
  const [client] = await db.select().from(clients).where(eq(clients.authUserId, user.id)).limit(1);
  if (!client) return Response.json({ error: "Paciente não encontrado." }, { status: 404 });
  if (!hasActiveAccess(client)) return Response.json({ error: "A vigência do acompanhamento terminou." }, { status: 403 });
  if (!isWeeklyCheckInAvailable()) return Response.json({ error: "O check-in semanal fica disponível somente às segundas-feiras." }, { status: 403 });
  const form = await request.formData();
  const adherence = scale(form, "adherence"), hunger = scale(form, "hunger"), satiety = scale(form, "satiety"), sleep = scale(form, "sleep"), energy = scale(form, "energy");
  const trainingSessions = Number(form.get("trainingSessions")), bowelFunction = String(form.get("bowelFunction") || ""), mainDifficulty = String(form.get("mainDifficulty") || "").trim(), weeklyWin = String(form.get("weeklyWin") || "").trim(), notes = String(form.get("notes") || "").trim();
  const rawWeight = String(form.get("weightKg") || "").trim().replace(",", "."), weight = rawWeight ? Number(rawWeight) : null;
  const bowelOptions = new Set(["regular", "constipation", "diarrhea", "alternating", "discomfort"]);
  if ([adherence, hunger, satiety, sleep, energy].some((value) => value === null) || !Number.isInteger(trainingSessions) || trainingSessions < 0 || trainingSessions > 21 || !bowelOptions.has(bowelFunction) || !mainDifficulty || !weeklyWin || weight === null || !Number.isFinite(weight) || weight < 20 || weight > 400) return Response.json({ error: "Revise os campos obrigatórios e tente novamente." }, { status: 400 });
  try {
    await db.insert(checkIns).values({ clientEmail: client.email, weekStart: currentWeekStart(), weightKg: weight.toFixed(1), adherence: adherence!, hunger: hunger!, satiety: satiety!, sleep: sleep!, energy: energy!, trainingSessions, bowelFunction, mainDifficulty: mainDifficulty.slice(0, 800), weeklyWin: weeklyWin.slice(0, 800), notes: notes.slice(0, 1200), feedback: "" });
  } catch { return Response.json({ error: "O check-in desta semana já foi enviado." }, { status: 409 }); }
  return Response.json({ ok: true });
}
