import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getDb } from "../../../db";
import { clients } from "../../../db/schema";
import { createClient } from "../../supabase/server";

const allowedTypes = new Set<EmailOtpType>(["invite", "magiclink"]);

export async function POST(request: Request) {
  const form = await request.formData();
  const tokenHash = String(form.get("token_hash") || "");
  const type = String(form.get("type") || "") as EmailOtpType;
  const origin = new URL(request.url).origin;

  if (!tokenHash || !allowedTypes.has(type)) {
    return NextResponse.redirect(
      new URL("/entrar?erro=confirmacao", origin),
      303,
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });
  const user = data.user;
  if (error || !user?.email) {
    return NextResponse.redirect(
      new URL("/entrar?erro=confirmacao", origin),
      303,
    );
  }

  const email = user.email.toLowerCase();
  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.email, email))
    .limit(1);
  if (!client || client.modality !== "in_person") {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/entrar", origin), 303);
  }

  await db
    .update(clients)
    .set({
      authUserId: user.id,
      inviteStatus: client.profileCompletedAt ? client.inviteStatus : "accepted",
      inviteAcceptedAt: client.inviteAcceptedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(clients.email, email));

  return NextResponse.redirect(new URL("/primeiro-acesso", origin), 303);
}
