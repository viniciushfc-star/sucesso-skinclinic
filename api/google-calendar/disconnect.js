/**
 * Remove a conexão Google Calendar do usuário.
 * POST /api/google-calendar/disconnect
 * Body: { userId, orgId }
 * Requer Authorization: Bearer <supabase_jwt> (usuário da org).
 */

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
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

  const orgId = req.body?.orgId || "";
  const userIdParam = req.body?.userId || "";

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

  const { error } = await supabase
    .from("google_calendar_connections")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", userIdParam);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
}
