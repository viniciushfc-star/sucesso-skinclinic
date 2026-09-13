/**
 * Sincroniza a agenda Google do profissional com external_calendar_blocks.
 * POST /api/google-calendar/sync
 * Body: { userId, orgId } ou apenas orgId (sincroniza todos os usuários conectados da org).
 * Requer Authorization: Bearer <supabase_jwt> (usuário da org).
 */

import { requireStaffAccess, sendAuthError, getAdminClient } from "../../lib/api-auth.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido" });
  }

  let auth;
  try {
    auth = await requireStaffAccess(req, { permission: "dashboard:view" });
  } catch (e) {
    return sendAuthError(res, e);
  }

  const orgId = auth.orgId;
  const userIdParam = req.body?.userId || req.body?.user_id || null;
  const isMaster = auth.membership?.role === "master";

  if (userIdParam && String(userIdParam) !== String(auth.user.id) && !isMaster) {
    return res.status(403).json({ error: "Sem permissão" });
  }

  const supabase = getAdminClient();

  let connections;
  if (userIdParam) {
    const targetId = isMaster ? userIdParam : auth.user.id;
    const { data: conn, error: connErr } = await supabase
      .from("google_calendar_connections")
      .select("id, user_id, refresh_token, calendar_id")
      .eq("org_id", orgId)
      .eq("user_id", targetId)
      .single();
    if (connErr || !conn) {
      return res.status(404).json({ error: "Conexão Google não encontrada para este usuário" });
    }
    connections = [conn];
  } else {
    let q = supabase
      .from("google_calendar_connections")
      .select("id, user_id, refresh_token, calendar_id")
      .eq("org_id", orgId);
    if (!isMaster) q = q.eq("user_id", auth.user.id);
    const { data: list } = await q;
    connections = list || [];
  }

  const now = new Date();
  const timeMax = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const timeMinStr = now.toISOString();
  const timeMaxStr = timeMax.toISOString();
  let totalBlocks = 0;

  for (const conn of connections) {
    const accessToken = await getAccessToken(conn.refresh_token);
    if (!accessToken) continue;

    const events = await fetchCalendarEvents(accessToken, timeMinStr, timeMaxStr);
    if (!events.length) {
      await supabase.from("google_calendar_connections").update({ last_sync_at: new Date().toISOString() }).eq("id", conn.id);
      continue;
    }

    await supabase
      .from("external_calendar_blocks")
      .delete()
      .eq("org_id", orgId)
      .eq("user_id", conn.user_id)
      .gte("start_at", timeMinStr)
      .lt("start_at", timeMaxStr);

    for (const ev of events) {
      const start = ev.start?.dateTime || ev.start?.date;
      const end = ev.end?.dateTime || ev.end?.date;
      if (!start || !end) continue;
      const startAt = new Date(start).toISOString();
      const endAt = new Date(end).toISOString();
      if (endAt <= startAt) continue;
      const { error: insErr } = await supabase.from("external_calendar_blocks").insert({
        org_id: orgId,
        user_id: conn.user_id,
        start_at: startAt,
        end_at: endAt,
      });
      if (!insErr) totalBlocks++;
    }

    await supabase.from("google_calendar_connections").update({ last_sync_at: new Date().toISOString() }).eq("id", conn.id);
  }

  return res.status(200).json({ ok: true, blocksCreated: totalBlocks });
}

async function getAccessToken(refreshToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
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

async function fetchCalendarEvents(accessToken, timeMin, timeMax) {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
  });
  const res = await fetch(`${CALENDAR_EVENTS_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.items || [];
}

