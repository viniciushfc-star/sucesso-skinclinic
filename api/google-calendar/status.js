/**
 * Retorna quais usuários da org têm Google Calendar conectado (sem expor tokens).
 * GET /api/google-calendar/status?orgId=xxx
 * Requer Authorization: Bearer <supabase_jwt>.
 */

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método não permitido" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return res.status(401).json({ error: "Authorization Bearer obrigatório" });
  }

  const supabaseAnon = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
  const { data: { user }, error: userError } = await supabaseAnon.auth.getUser(token);
  if (userError || !user) {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }

  const orgId = req.query.orgId || "";
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const { data: membership } = await supabase
    .from("organization_users")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .single();

  if (!membership || !orgId) {
    return res.status(403).json({ error: "Sem permissão para esta organização" });
  }

  const { data: rows, error } = await supabase
    .from("google_calendar_connections")
    .select("user_id, last_sync_at, created_at")
    .eq("org_id", orgId);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const connections = (rows || []).map((r) => ({
    user_id: r.user_id,
    last_sync_at: r.last_sync_at,
    connected_at: r.created_at,
  }));

  return res.status(200).json({ connections });
}
