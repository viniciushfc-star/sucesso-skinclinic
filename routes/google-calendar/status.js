/**
 * Retorna quais usuários da org têm Google Calendar conectado (sem expor tokens).
 * GET /api/google-calendar/status?orgId=xxx
 */

import { requireStaffAccess, sendAuthError, getAdminClient } from "../../lib/api-auth.js";

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
  const { data: rows, error } = await supabase
    .from("google_calendar_connections")
    .select("user_id, last_sync_at, created_at")
    .eq("org_id", auth.orgId);

  if (error) {
    console.error("[google-calendar/status]", error);
    return res.status(500).json({ error: "Erro interno" });
  }

  const connections = (rows || []).map((r) => ({
    user_id: r.user_id,
    last_sync_at: r.last_sync_at,
    connected_at: r.created_at,
  }));

  return res.status(200).json({ connections });
}
