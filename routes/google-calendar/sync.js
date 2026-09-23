/**
 * Sincroniza ocupação (FreeBusy) → external_calendar_blocks.
 * POST /api/google-calendar/sync
 * Só start/end. Não grava título. Eventos da própria clínica não viram “agenda pessoal”.
 */

import { requireStaffAccess, sendAuthError, getAdminClient } from "../../lib/api-auth.js";
import { getGoogleAccessToken, fetchFreeBusy } from "../../lib/google-calendar.js";
import { busyMenosAgendaClinica } from "../../js/utils/agenda-ocupacao.js";

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
    const accessToken = await getGoogleAccessToken(conn.refresh_token);
    if (!accessToken) continue;

    let busy = [];
    try {
      busy = await fetchFreeBusy(accessToken, conn.calendar_id || "primary", timeMinStr, timeMaxStr);
    } catch (err) {
      if (err?.status === 403) continue;
      console.error("[google-calendar/sync] freebusy");
      continue;
    }

    const { data: agendaRows } = await supabase
      .from("agenda")
      .select("data, hora, duration_minutes")
      .eq("org_id", orgId)
      .eq("user_id", conn.user_id)
      .is("cancelled_at", null)
      .gte("data", timeMinStr.slice(0, 10))
      .lte("data", timeMaxStr.slice(0, 10));

    const clinicSlots = (agendaRows || []).map((row) => {
      const hora = String(row.hora || "00:00").slice(0, 5);
      const start = new Date(`${row.data}T${hora}:00`);
      const end = new Date(start.getTime() + (Number(row.duration_minutes) || 60) * 60000);
      return { start, end };
    });

    const personal = busyMenosAgendaClinica(
      (busy || []).map((b) => ({ start: b.start, end: b.end })),
      clinicSlots
    );

    await supabase
      .from("external_calendar_blocks")
      .delete()
      .eq("org_id", orgId)
      .eq("user_id", conn.user_id)
      .gte("start_at", timeMinStr)
      .lt("start_at", timeMaxStr);

    for (const b of personal) {
      const startAt = new Date(b.start).toISOString();
      const endAt = new Date(b.end).toISOString();
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
