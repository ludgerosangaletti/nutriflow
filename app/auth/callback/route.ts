import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { clients, nfOrganizations } from "../../../db/schema";
import { isPlanId } from "../../plans";
import { createClient, isAdminEmail } from "../../supabase/server";
import { WHATSAPP_ACTIVATION_CONSENT_TEXT, WHATSAPP_ACTIVATION_CONSENT_VERSION } from "../../whatsapp-activation-consent";

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
  const whatsappOptIn = user.user_metadata.whatsapp_operational_opt_in === true;
  const whatsappOptInAt = whatsappOptIn ? String(user.user_metadata.whatsapp_operational_opt_in_at || new Date().toISOString()) : null;
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
        whatsappActivationOptInAt: whatsappOptIn ? whatsappOptInAt : existing.whatsappActivationOptInAt,
        whatsappActivationOptInPhone: whatsappOptIn ? whatsapp || existing.whatsapp : existing.whatsappActivationOptInPhone,
        whatsappActivationOptInSource: whatsappOptIn ? "online_signup_checkbox" : existing.whatsappActivationOptInSource,
        whatsappActivationOptInVersion: whatsappOptIn ? WHATSAPP_ACTIVATION_CONSENT_VERSION : existing.whatsappActivationOptInVersion,
        whatsappActivationOptInText: whatsappOptIn ? WHATSAPP_ACTIVATION_CONSENT_TEXT : existing.whatsappActivationOptInText,
        plan: existing.modality === "in_person" ? existing.plan : plan,
        inviteStatus:
          existing.modality === "in_person" && !existing.profileCompletedAt
            ? "accepted"
            : existing.inviteStatus,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(clients.email, user.email));
  } else {
    const activeOrganizations = await db.select({ id: nfOrganizations.id }).from(nfOrganizations).where(eq(nfOrganizations.status, "active")).limit(2);
    const organizationId = activeOrganizations.length === 1 ? activeOrganizations[0].id : null;
    await db.insert(clients).values({
      organizationId,
      authUserId: user.id,
      email: user.email,
      name: name || user.email.split("@")[0],
      whatsapp,
      whatsappActivationOptInAt: whatsappOptInAt,
      whatsappActivationOptInPhone: whatsappOptIn ? whatsapp : null,
      whatsappActivationOptInSource: whatsappOptIn ? "online_signup_checkbox" : null,
      whatsappActivationOptInVersion: whatsappOptIn ? WHATSAPP_ACTIVATION_CONSENT_VERSION : null,
      whatsappActivationOptInText: whatsappOptIn ? WHATSAPP_ACTIVATION_CONSENT_TEXT : null,
      plan,
      paymentStatus: "awaiting_payment",
    });
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
