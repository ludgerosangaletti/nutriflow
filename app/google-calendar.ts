import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { clients, googleCalendarSettings } from "../db/schema";

const SETTINGS_ID = 1;
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

type GoogleEvent = {
  id?: string;
  summary?: string;
  status?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptionKey() {
  const encoded = process.env.GOOGLE_CREDENTIALS_ENCRYPTION_KEY;
  if (!encoded) throw new Error("A chave interna da integração não foi configurada.");
  return crypto.subtle.importKey(
    "raw",
    base64ToBytes(encoded),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptGoogleSecret(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(),
    new TextEncoder().encode(value),
  );
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;
}

export async function decryptGoogleSecret(value: string) {
  const [iv, payload] = value.split(".");
  if (!iv || !payload) throw new Error("Credencial armazenada inválida.");
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(iv) },
    await encryptionKey(),
    base64ToBytes(payload),
  );
  return new TextDecoder().decode(decrypted);
}

export async function getGoogleCalendarSettings() {
  const [settings] = await getDb()
    .select()
    .from(googleCalendarSettings)
    .where(eq(googleCalendarSettings.id, SETTINGS_ID))
    .limit(1);
  return settings || null;
}

export async function saveGoogleCredentials(input: {
  calendarId: string;
  clientId: string;
  clientSecret: string;
}) {
  const now = new Date().toISOString();
  await getDb()
    .insert(googleCalendarSettings)
    .values({
      id: SETTINGS_ID,
      calendarId: input.calendarId,
      encryptedClientId: await encryptGoogleSecret(input.clientId),
      encryptedClientSecret: await encryptGoogleSecret(input.clientSecret),
      status: "credentials_saved",
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: googleCalendarSettings.id,
      set: {
        calendarId: input.calendarId,
        encryptedClientId: await encryptGoogleSecret(input.clientId),
        encryptedClientSecret: await encryptGoogleSecret(input.clientSecret),
        encryptedRefreshToken: null,
        status: "credentials_saved",
        connectedAt: null,
        lastSyncError: null,
        updatedAt: now,
      },
    });
}

async function credentials() {
  const settings = await getGoogleCalendarSettings();
  if (!settings) throw new Error("Credenciais do Google não cadastradas.");
  return {
    settings,
    clientId: await decryptGoogleSecret(settings.encryptedClientId),
    clientSecret: await decryptGoogleSecret(settings.encryptedClientSecret),
  };
}

export async function googleOAuthConfiguration() {
  const { settings, clientId, clientSecret } = await credentials();
  return { settings, clientId, clientSecret };
}

export async function saveGoogleRefreshToken(refreshToken: string) {
  const now = new Date().toISOString();
  await getDb()
    .update(googleCalendarSettings)
    .set({
      encryptedRefreshToken: await encryptGoogleSecret(refreshToken),
      status: "connected",
      connectedAt: now,
      lastSyncError: null,
      updatedAt: now,
    })
    .where(eq(googleCalendarSettings.id, SETTINGS_ID));
}

async function accessToken() {
  const { settings, clientId, clientSecret } = await credentials();
  if (!settings.encryptedRefreshToken) {
    throw new Error("O Google Agenda ainda não foi autorizado.");
  }
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: await decryptGoogleSecret(settings.encryptedRefreshToken),
      grant_type: "refresh_token",
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    error_description?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || "Não foi possível acessar o Google Agenda.");
  }
  return { token: payload.access_token, settings };
}

export async function listGoogleCalendarEvents(timeMin: Date, timeMax: Date) {
  const { token, settings } = await accessToken();
  const url = new URL(
    `${CALENDAR_API}/calendars/${encodeURIComponent(settings.calendarId)}/events`,
  );
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("timeMin", timeMin.toISOString());
  url.searchParams.set("timeMax", timeMax.toISOString());
  url.searchParams.set("maxResults", "2500");
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  });
  const payload = (await response.json().catch(() => ({}))) as {
    items?: GoogleEvent[];
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message || "Falha ao consultar o Google Agenda.");
  }
  return (payload.items || []).filter(
    (event) => event.status !== "cancelled" && event.start?.dateTime,
  );
}

export async function googleCalendarHasConflict(
  start: string,
  ignoredEventId?: string | null,
) {
  const startDate = new Date(start);
  const endDate = new Date(startDate.getTime() + 3_600_000);
  const events = await listGoogleCalendarEvents(
    new Date(startDate.getTime() - 3_600_000),
    new Date(endDate.getTime() + 3_600_000),
  );
  return events.some((event) => {
    if (!event.id || event.id === ignoredEventId || !event.start?.dateTime) return false;
    const eventStart = new Date(event.start.dateTime).getTime();
    const eventEnd = event.end?.dateTime
      ? new Date(event.end.dateTime).getTime()
      : eventStart + 3_600_000;
    return startDate.getTime() < eventEnd && endDate.getTime() > eventStart;
  });
}

export async function upsertPatientCalendarEvent(input: {
  email: string;
  name: string;
  appointmentAt: string;
  existingEventId?: string | null;
}) {
  const { token, settings } = await accessToken();
  const event = {
    summary: `${input.name} - Nutri Ludgero`,
    description: "Atendimento nutricional presencial. Gerenciado pela plataforma Ludgero Sangaletti.",
    start: { dateTime: input.appointmentAt, timeZone: "America/Sao_Paulo" },
    end: {
      dateTime: new Date(new Date(input.appointmentAt).getTime() + 3_600_000).toISOString(),
      timeZone: "America/Sao_Paulo",
    },
    visibility: "private",
    extendedProperties: {
      private: { source: "ludgero-platform", patientEmail: input.email },
    },
  };
  const base = `${CALENDAR_API}/calendars/${encodeURIComponent(settings.calendarId)}/events`;
  const url = input.existingEventId
    ? `${base}/${encodeURIComponent(input.existingEventId)}`
    : base;
  const response = await fetch(url, {
    method: input.existingEventId ? "PATCH" : "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(event),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string };
  };
  if (!response.ok || !payload.id) {
    throw new Error(payload.error?.message || "Não foi possível salvar o evento no Google.");
  }
  const now = new Date().toISOString();
  await getDb()
    .update(clients)
    .set({ googleCalendarEventId: payload.id, googleCalendarSyncedAt: now })
    .where(eq(clients.email, input.email));
  return payload.id;
}

export async function deletePatientCalendarEvent(eventId?: string | null) {
  if (!eventId) return;
  const { token, settings } = await accessToken();
  const response = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(settings.calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE", headers: { authorization: `Bearer ${token}` } },
  );
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw new Error("Não foi possível cancelar o evento no Google Agenda.");
  }
}

function normalizedName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export async function syncGoogleCalendar() {
  const db = getDb();
  const allClients = await db.select().from(clients);
  const events = await listGoogleCalendarEvents(
    new Date(Date.now() - 7 * 86_400_000),
    new Date(Date.now() + 120 * 86_400_000),
  );
  let updated = 0;
  const now = new Date().toISOString();
  for (const event of events) {
    if (!event.id || !event.start?.dateTime || !event.summary) continue;
    const match = /^(.*?)\s*-\s*Nutri Ludgero\s*$/i.exec(event.summary);
    if (!match) continue;
    const eventName = normalizedName(match[1]);
    const client = allClients.find(
      (item) =>
        item.modality === "in_person" &&
        (normalizedName(item.name) === eventName ||
          normalizedName(item.name).startsWith(`${eventName} `) ||
          eventName.startsWith(`${normalizedName(item.name)} `)),
    );
    if (!client) continue;
    await db
      .update(clients)
      .set({
        nextAppointmentAt: new Date(event.start.dateTime).toISOString(),
        googleCalendarEventId: event.id,
        googleCalendarSyncedAt: now,
        appointmentStatus: "scheduled",
        updatedAt: now,
      })
      .where(eq(clients.email, client.email));
    updated += 1;
  }
  await db
    .update(googleCalendarSettings)
    .set({ lastSyncAt: now, lastSyncError: null, updatedAt: now })
    .where(eq(googleCalendarSettings.id, SETTINGS_ID));
  return { events: events.length, updated };
}
