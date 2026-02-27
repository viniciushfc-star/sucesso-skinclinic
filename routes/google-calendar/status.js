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

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("[google-calendar/status] SUPABASE_URL ou SUPABASE_ANON_KEY ausente");
    return res.status(500).json({ error: "Configuração do servidor incompleta" });
  }

  const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error: userError } = await supabaseAnon.auth.getUser(token);
  if (userError || !user) {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }

  const orgId = (req.query.orgId || "").trim();
  if (!orgId) {
    return res.status(400).json({ error: "orgId é obrigatório" });
  }

  let membership = null;
  const supabaseWithUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: membershipUser } = await supabaseWithUser
    .from("organization_users")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (membershipUser) membership = membershipUser;

  if (!membership && supabaseServiceKey) {
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
    const { data: membershipSvc } = await supabaseService
      .from("organization_users")
      .select("org_id")
      .eq("user_id", user.id)
      .eq("org_id", orgId)
      .maybeSingle();
    if (membershipSvc) membership = membershipSvc;
  }

  if (!membership) {
    console.warn("[google-calendar/status] 403: usuário não encontrado em organization_users", { userId: user.id, orgId });
    return res.status(403).json({ error: "Sem permissão para esta organização" });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);
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

