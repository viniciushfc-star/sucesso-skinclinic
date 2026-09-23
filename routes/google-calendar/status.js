/**
 * Retorna quais usuários da org têm Google Calendar conectado (sem expor tokens).
 * GET /api/google-calendar/status?orgId=xxx
 */

import { requireStaffAccess, sendAuthError, getAdminClient } from "../../lib/api-auth.js";
import { connectionNeedsReconnect } from "../../lib/google-calendar.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método não permitido" });
  }

  let auth;
  try {
    auth = await requireStaffAccess(req, { permission: "dashboard:view" });
  } catch (e) {
    return sendAuthError(res, e);
  }

  const supabase = getAdminClient();
  let q = await supabase
    .from("google_calendar_connections")
    .select("user_id, last_sync_at, created_at, granted_scopes, reconnect_needed")
    .eq("org_id", auth.orgId);

  if (q.error && /granted_scopes|reconnect_needed|schema cache|column/i.test(q.error.message || "")) {
    q = await supabase
      .from("google_calendar_connections")
      .select("user_id, last_sync_at, created_at")
      .eq("org_id", auth.orgId);
  }

  if (q.error) {
    console.error("[google-calendar/status]", q.error);
    return res.status(500).json({ error: "Erro interno" });
  }

  const connections = (q.data || []).map((r) => ({
    user_id: r.user_id,
    last_sync_at: r.last_sync_at,
    connected_at: r.created_at,
    needs_reconnect: connectionNeedsReconnect(r),
  }));

  return res.status(200).json({ connections });
}
