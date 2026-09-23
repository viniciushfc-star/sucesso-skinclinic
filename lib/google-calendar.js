/**
 * Cliente Google Calendar (servidor). Não persiste título, descrição nem convidados.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FREEBUSY_URL = "https://www.googleapis.com/calendar/v3/freeBusy";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

export const CLINIC_EVENT_PRIVATE = { skinclinic: "1" };

/** Conexão antiga (sem events) não pode ocupar o Google sem vazar o resto da agenda. */
export function connectionNeedsReconnect(row = {}) {
  if (row.reconnect_needed === true) return true;
  const s = String(row.granted_scopes || "");
  if (!s.trim()) return true;
  return !/calendar\.freebusy/i.test(s) || !/calendar\.events/i.test(s);
}

export async function getGoogleAccessToken(refreshToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret || !refreshToken) return null;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token || null;
}

export async function fetchFreeBusy(accessToken, calendarId, timeMin, timeMax) {
  const res = await fetch(FREEBUSY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: calendarId || "primary" }],
    }),
  });
  if (!res.ok) {
    const err = new Error("freebusy_failed");
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const cal = data.calendars?.[calendarId || "primary"] || data.calendars?.primary;
  return Array.isArray(cal?.busy) ? cal.busy : [];
}

function eventsBase(calendarId) {
  const id = encodeURIComponent(calendarId || "primary");
  return `${EVENTS_URL}/${id}/events`;
}

/** Evento genérico: ocupa o Google sem PII do paciente. */
export function buildClinicBusyEvent({ date, hora, durationMinutes, agendaId }) {
  const hhmm = String(hora || "00:00").slice(0, 5);
  const dur = Math.max(15, Number(durationMinutes) || 60);
  const [y, m, d] = String(date).split("-").map((n) => parseInt(n, 10));
  const [hh, mm] = hhmm.split(":").map((n) => parseInt(n, 10) || 0);
  const start = new Date(y, (m || 1) - 1, d || 1, hh, mm, 0);
  const end = new Date(start.getTime() + dur * 60000);
  const pad = (n) => String(n).padStart(2, "0");
  const local = (dt) =>
    `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:00`;
  return {
    summary: "Atendimento na clínica",
    description: "Horário reservado pela clínica. Sem dados pessoais.",
    start: { dateTime: local(start), timeZone: "America/Sao_Paulo" },
    end: { dateTime: local(end), timeZone: "America/Sao_Paulo" },
    transparency: "opaque",
    visibility: "private",
    extendedProperties: {
      private: { ...CLINIC_EVENT_PRIVATE, agenda_id: String(agendaId || "") },
    },
  };
}

export async function insertClinicBusyEvent(accessToken, calendarId, eventBody) {
  const res = await fetch(eventsBase(calendarId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventBody),
  });
  if (res.status === 403) {
    const err = new Error("needs_reconnect");
    err.status = 403;
    throw err;
  }
  if (!res.ok) return null;
  const data = await res.json();
  return data.id || null;
}

export async function updateClinicBusyEvent(accessToken, calendarId, eventId, eventBody) {
  const res = await fetch(`${eventsBase(calendarId)}/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventBody),
  });
  if (res.status === 403) {
    const err = new Error("needs_reconnect");
    err.status = 403;
    throw err;
  }
  if (res.status === 404) return null;
  if (!res.ok) return eventId;
  return eventId;
}

export async function deleteClinicBusyEvent(accessToken, calendarId, eventId) {
  if (!eventId) return;
  await fetch(`${eventsBase(calendarId)}/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
