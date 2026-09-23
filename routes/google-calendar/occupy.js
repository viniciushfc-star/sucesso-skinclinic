/**
 * POST /api/google-calendar/occupy
 * Clínica agenda → ocupa o Google do profissional com evento genérico (sem PII).
 * Body: { agenda_id } ou { agenda_id, action: "release" }
 */

import { requireStaffAccess, sendAuthError, getAdminClient } from "../../lib/api-auth.js";
import {
  getGoogleAccessToken,
  buildClinicBusyEvent,
  insertClinicBusyEvent,
  updateClinicBusyEvent,
  deleteClinicBusyEvent,
} from "../../lib/google-calendar.js";
import { publicSubmitOccupyBody } from "../../js/utils/agenda-ocupacao.js";

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

  const agendaId = String(req.body?.agenda_id || req.body?.agendaId || "").trim();
  const release = req.body?.action === "release";
  if (!agendaId) {
    return res.status(400).json({ error: "Agendamento não informado." });
  }

  const supabase = getAdminClient();
  const { data: row, error } = await supabase
    .from("agenda")
    .select("id, org_id, user_id, data, hora, duration_minutes, cancelled_at")
    .eq("id", agendaId)
    .eq("org_id", auth.orgId)
    .maybeSingle();

  if (error || !row) {
    return res.status(404).json({ error: "Agendamento não encontrado." });
  }

  const { data: mapping } = await supabase
    .from("agenda_google_events")
    .select("google_event_id, calendar_id, user_id")
    .eq("agenda_id", agendaId)
    .maybeSingle();

  const userId = row.user_id;
  if (!userId || release || row.cancelled_at) {
    if (mapping?.google_event_id) {
      await releaseMapped(supabase, mapping, auth.orgId, userId || mapping.user_id, agendaId);
    }
    return res.status(200).json(publicSubmitOccupyBody({ ok: true, skipped: true }));
  }

  const { data: conn } = await supabase
    .from("google_calendar_connections")
    .select("refresh_token, calendar_id")
    .eq("org_id", auth.orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!conn?.refresh_token) {
    return res.status(200).json(publicSubmitOccupyBody({ ok: true, skipped: true }));
  }

  const accessToken = await getGoogleAccessToken(conn.refresh_token);
  if (!accessToken) {
    await markReconnect(supabase, auth.orgId, userId);
    return res.status(200).json(publicSubmitOccupyBody({ ok: false, needs_reconnect: true }));
  }

  const calendarId = conn.calendar_id || "primary";
  const eventBody = buildClinicBusyEvent({
    date: row.data,
    hora: row.hora,
    durationMinutes: row.duration_minutes,
    agendaId: row.id,
  });

  try {
    let eventId = mapping?.google_event_id || null;
    if (eventId && mapping.user_id === userId) {
      const patched = await updateClinicBusyEvent(accessToken, calendarId, eventId, eventBody);
      if (!patched) {
        eventId = await insertClinicBusyEvent(accessToken, calendarId, eventBody);
      }
    } else {
      if (eventId) {
        await releaseMapped(supabase, mapping, auth.orgId, mapping.user_id, agendaId);
      }
      eventId = await insertClinicBusyEvent(accessToken, calendarId, eventBody);
    }
    if (!eventId) {
      return res.status(200).json(publicSubmitOccupyBody({ ok: false, skipped: true }));
    }
    await supabase.from("agenda_google_events").upsert(
      {
        agenda_id: row.id,
        org_id: auth.orgId,
        user_id: userId,
        google_event_id: eventId,
        calendar_id: calendarId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "agenda_id" }
    );
    return res.status(200).json(publicSubmitOccupyBody({ ok: true }));
  } catch (err) {
    if (err?.message === "needs_reconnect" || err?.status === 403) {
      await markReconnect(supabase, auth.orgId, userId);
      return res.status(200).json(publicSubmitOccupyBody({ ok: false, needs_reconnect: true }));
    }
    console.error("[google-calendar/occupy]");
    return res.status(200).json(publicSubmitOccupyBody({ ok: false, skipped: true }));
  }
}

async function markReconnect(supabase, orgId, userId) {
  if (!orgId || !userId) return;
  await supabase
    .from("google_calendar_connections")
    .update({ reconnect_needed: true })
    .eq("org_id", orgId)
    .eq("user_id", userId);
}

async function releaseMapped(supabase, mapping, orgId, userId, agendaId) {
  const { data: conn } = await supabase
    .from("google_calendar_connections")
    .select("refresh_token, calendar_id")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (conn?.refresh_token && mapping?.google_event_id) {
    const token = await getGoogleAccessToken(conn.refresh_token);
    if (token) {
      await deleteClinicBusyEvent(token, mapping.calendar_id || conn.calendar_id || "primary", mapping.google_event_id);
    }
  }
  await supabase.from("agenda_google_events").delete().eq("agenda_id", agendaId);
}
