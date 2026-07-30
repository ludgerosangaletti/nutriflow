import { getAdminSession } from "../../../../supabase/server";
import {
  googleOAuthConfiguration,
  listGoogleCalendarEvents,
  saveGoogleRefreshToken,
} from "../../../../google-calendar";

function cookie(request: Request, name: string) {
  const cookies = request.headers.get("cookie") || "";
  return cookies
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function redirect(request: Request, query: string) {
  return new Response(null, {
    status: 302,
    headers: {
      location: new URL(`/admin/integracoes/google-agenda?${query}`, request.url).toString(),
      "set-cookie":
        "google_oauth_state=; Max-Age=0; Path=/api/integrations/google-calendar; HttpOnly; Secure; SameSite=Lax, google_oauth_verifier=; Max-Age=0; Path=/api/integrations/google-calendar; HttpOnly; Secure; SameSite=Lax",
    },
  });
}

export async function GET(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return redirect(request, "error=admin");
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = cookie(request, "google_oauth_state");
  const verifier = cookie(request, "google_oauth_verifier");
  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    return redirect(request, "error=state");
  }
  try {
    const { clientId, clientSecret } = await googleOAuthConfiguration();
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: new URL(
          "/api/integrations/google-calendar/callback",
          request.url,
        ).toString(),
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    });
    const token = (await tokenResponse.json().catch(() => ({}))) as {
      refresh_token?: string;
      error_description?: string;
    };
    if (!tokenResponse.ok || !token.refresh_token) {
      throw new Error(token.error_description || "O Google não forneceu uma autorização permanente.");
    }
    await saveGoogleRefreshToken(token.refresh_token);
    await listGoogleCalendarEvents(
      new Date(Date.now() - 86_400_000),
      new Date(Date.now() + 30 * 86_400_000),
    );
    return redirect(request, "connected=1");
  } catch (error) {
    console.error("google_calendar_oauth_failed", error);
    return redirect(request, "error=oauth");
  }
}
