import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { clients } from "../../../db/schema";
import { getPatientUser } from "../../supabase/server";

export async function POST(request: Request) {
  const user = await getPatientUser();
  if (!user?.email) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    firstName?: string;
    lastName?: string;
    birthDate?: string;
    whatsapp?: string;
  };
  const firstName = String(body.firstName || "").trim().slice(0, 60);
  const lastName = String(body.lastName || "").trim().slice(0, 80);
  const birthDate = String(body.birthDate || "");
  const whatsapp = String(body.whatsapp || "").replace(/\D/g, "");
  const parsedBirthDate = new Date(`${birthDate}T12:00:00Z`);
  const age =
    Number.isNaN(parsedBirthDate.getTime())
      ? -1
      : Math.floor(
          (Date.now() - parsedBirthDate.getTime()) / (365.2425 * 86_400_000),
        );
  if (
    !firstName ||
    !lastName ||
    !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
    age < 0 ||
    age > 120 ||
    whatsapp.length < 10 ||
    whatsapp.length > 13
  ) {
    return Response.json({ error: "Confira os dados informados." }, { status: 400 });
  }

  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.email, user.email.toLowerCase()))
    .limit(1);
  if (!client || client.modality !== "in_person") {
    return Response.json({ error: "Convite presencial não encontrado." }, { status: 404 });
  }
  const now = new Date().toISOString();
  await db
    .update(clients)
    .set({
      authUserId: user.id,
      name: `${firstName} ${lastName}`.replace(/\s+/g, " "),
      whatsapp,
      birthDate,
      profileCompletedAt: now,
      inviteStatus: "accepted",
      inviteAcceptedAt: now,
      inviteError: null,
      updatedAt: now,
    })
    .where(eq(clients.email, user.email.toLowerCase()));
  return Response.json({ ok: true });
}
