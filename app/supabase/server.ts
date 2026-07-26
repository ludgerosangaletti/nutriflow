import { createServerClient } from "@supabase/ssr";
import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components may not write cookies outside a response flow.
          }
        },
      },
    },
  );
}

export async function getPatientUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getPatientSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session ? { user, session } : null;
}

export async function requirePatient(returnTo: string) {
  const user = await getPatientUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(returnTo)}`);
  return user;
}

export function isAdminEmail(email?: string | null) {
  return Boolean(
    email &&
      env.ADMIN_EMAIL &&
      email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase(),
  );
}

export async function getAdminUser() {
  const user = await getPatientUser();
  return isAdminEmail(user?.email) ? user : null;
}

export async function getAdminSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session ? { user: user!, session } : null;
}

export async function requireAdmin(returnTo: string) {
  const user = await getPatientUser();
  if (!user) redirect(`/admin/entrar?next=${encodeURIComponent(returnTo)}`);
  if (!isAdminEmail(user.email)) redirect("/admin/nao-autorizado");
  return user;
}
