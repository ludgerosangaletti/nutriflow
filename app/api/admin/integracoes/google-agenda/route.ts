import { getAdminSession } from "../../../../supabase/server";
import {
  getGoogleCalendarSettings,
  saveGoogleCredentials,
  syncGoogleCalendar,
} from "../../../../google-calendar";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 403 });
  const settings = await getGoogleCalendarSettings();
  return Response.json({
    configured: Boolean(settings),
    connected: settings?.status === "connected",
    calendarId: settings?.calendarId || "",
    status: settings?.status || "not_configured",
    connectedAt: settings?.connectedAt || null,
    lastSyncAt: settings?.lastSyncAt || null,
    lastSyncError: settings?.lastSyncError || null,
  });
}

export async function POST(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    calendarId?: string;
    clientId?: string;
    clientSecret?: string;
  };
  if (body.action === "save_credentials") {
    const calendarId = String(body.calendarId || "").trim();
    const clientId = String(body.clientId || "").trim();
    const clientSecret = String(body.clientSecret || "").trim();
    if (!calendarId || !clientId.endsWith(".apps.googleusercontent.com") || !clientSecret) {
      return Response.json({ error: "Credenciais incompletas ou inválidas." }, { status: 400 });
    }
    await saveGoogleCredentials({ calendarId, clientId, clientSecret });
    return Response.json({ ok: true });
  }
  if (body.action === "sync") {
    try {
      return Response.json({ ok: true, ...(await syncGoogleCalendar()) });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Falha na sincronização." },
        { status: 502 },
      );
    }
  }
  return Response.json({ error: "Ação inválida." }, { status: 400 });
}
