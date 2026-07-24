import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { clients } from "../../../db/schema";
import { isPlanId } from "../../plans";
import { createClient, isAdminEmail } from "../../supabase/server";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/area-cliente";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  if (!code) return NextResponse.redirect(new URL("/entrar?erro=confirmacao", url.origin));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  const user = data.user;
  if (error || !user?.email) {
    return NextResponse.redirect(new URL("/entrar?erro=confirmacao", url.origin));
  }

  if (isAdminEmail(user.email)) {
    return NextResponse.redirect(new URL(next, url.origin));
  }

  const name = String(user.user_metadata.name ?? "").trim();
  const whatsapp = String(user.user_metadata.whatsapp ?? "").trim();
  const rawPlan = String(user.user_metadata.plan ?? "trimestral");
  const plan = isPlanId(rawPlan) ? rawPlan : "trimestral";
  const db = getDb();
  const [existing] = await db
    .select()
    .from(clients)
    .where(eq(clients.email, user.email))
    .limit(1);

  if (existing) {
    await db
      .update(clients)
      .set({
        authUserId: user.id,
        name: name || existing.name,
        whatsapp: whatsapp || existing.whatsapp,
        plan,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(clients.email, user.email));
  } else {
    await db.insert(clients).values({
      authUserId: user.id,
      email: user.email,
      name: name || user.email.split("@")[0],
      whatsapp,
      plan,
      paymentStatus: "awaiting_payment",
    });
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
