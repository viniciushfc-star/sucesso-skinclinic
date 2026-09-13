/**
 * Remove a conexão Google Calendar.
 * POST /api/google-calendar/disconnect
 * Body: { orgId, userId? } — userId do body só vale se for o JWT ou se o role for master.
 */

import { requireStaffAccess, sendAuthError, getAdminClient } from "../../lib/api-auth.js";

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

  const userIdParam = String(req.body?.userId || req.body?.user_id || "").trim();
  const targetUserId =
    !userIdParam || userIdParam === auth.user.id
      ? auth.user.id
      : auth.membership?.role === "master"
        ? userIdParam
        : null;

  if (!targetUserId) {
    return res.status(403).json({ error: "Sem permissão" });
  }

  const supabase = getAdminClient();
  const { error } = await supabase
    .from("google_calendar_connections")
    .delete()
    .eq("org_id", auth.orgId)
    .eq("user_id", targetUserId);

  if (error) {
    console.error("[google-calendar/disconnect]", error);
    return res.status(500).json({ error: "Erro interno" });
  }

  return res.status(200).json({ ok: true });
}
