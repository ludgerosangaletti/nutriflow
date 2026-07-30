import { getAdminSession } from "../../../../supabase/server";
import { googleOAuthConfiguration } from "../../../../google-calendar";

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function GET(request: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return Response.redirect(new URL("/admin/entrar?next=/admin/integracoes/google-agenda", request.url));
  }
  const { clientId } = await googleOAuthConfiguration();
  const state = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = base64Url(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    ),
  );
  const redirectUri = new URL(
    "/api/integrations/google-calendar/callback",
    request.url,
  ).toString();
  const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorization.searchParams.set("client_id", clientId);
  authorization.searchParams.set("redirect_uri", redirectUri);
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set(
    "scope",
    "https://www.googleapis.com/auth/calendar.events",
  );
  authorization.searchParams.set("access_type", "offline");
  authorization.searchParams.set("prompt", "consent");
  authorization.searchParams.set("state", state);
  authorization.searchParams.set("code_challenge", challenge);
  authorization.searchParams.set("code_challenge_method", "S256");

  const headers = new Headers({ location: authorization.toString() });
  headers.append(
    "set-cookie",
    `google_oauth_state=${state}; Max-Age=600; Path=/api/integrations/google-calendar; HttpOnly; Secure; SameSite=Lax`,
  );
  headers.append(
    "set-cookie",
    `google_oauth_verifier=${verifier}; Max-Age=600; Path=/api/integrations/google-calendar; HttpOnly; Secure; SameSite=Lax`,
  );
  return new Response(null, { status: 302, headers });
}
