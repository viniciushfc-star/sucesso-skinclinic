/**
 * POST /api/create-portal-session
 * Cria link do portal do cliente (alternativa à RPC quando a API REST do Supabase retorna 404).
 * Body: { org_id, client_id }
 * Requer: Authorization: Bearer <supabase_jwt>
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { randomBytes } from "node:crypto";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const isProduction = process.env.NODE_ENV === "production";
/** Em dev (NODE_ENV !== production) ou ALLOW_PORTAL_SESSION_DEV=1: ignora checagem de org (só exige JWT + cliente na org). */
const skipOrgCheck = !isProduction || process.env.ALLOW_PORTAL_SESSION_DEV === "1";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return res.status(401).json({ error: "Envie o token de sessão (Authorization: Bearer)" });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: "Supabase não configurado no servidor" });
  }

  if (!supabaseAnonKey) {
    return res.status(500).json({
      error: "Configure SUPABASE_ANON_KEY no .env (Supabase → Project Settings → API → anon public)",
    });
  }

  const orgId = String(req.body?.org_id ?? "").trim();
  const clientId = String(req.body?.client_id ?? "").trim();
  if (!orgId || !clientId) {
    return res.status(400).json({ error: "Envie org_id e client_id no body" });
  }

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
  if (userError || !user) {
    console.warn("[create-portal-session] getUser falhou:", userError?.message || "sem user");
    return res.status(401).json({
      error: userError?.message || "Token inválido ou expirado. Confira se SUPABASE_ANON_KEY está no .env (chave anon do projeto).",
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let hasAccess = false;
  let membership = null;
  if (skipOrgCheck) {
    hasAccess = true;
    if (!isProduction) console.warn("[create-portal-session] Dev: checagem de organização ignorada");
  } else {
    const { data: membershipData } = await supabase
      .from("organization_users")
      .select("org_id")
      .eq("user_id", user.id)
      .eq("org_id", orgId)
      .maybeSingle();
    membership = membershipData;
    hasAccess = !!membership;
    if (!hasAccess) {
      const { data: org } = await supabase
        .from("organizations")
        .select("id")
        .eq("id", orgId)
        .eq("owner_id", user.id)
        .maybeSingle();
      hasAccess = !!org;
    }
  }

  if (!hasAccess) {
    const debug = process.env.NODE_ENV !== "production"
      ? { membership: !!membership, hint: "Confira no Supabase: organization_users tem (user_id, org_id)? organizations.owner_id = seu user_id? Ou em dev use ALLOW_PORTAL_SESSION_DEV=1 no .env" }
      : undefined;
    console.warn("[create-portal-session] 403", { userId: user.id, orgId, membership: !!membership });
    return res.status(403).json({
      error: "Você não tem permissão nesta organização. Selecione a clínica no seletor de organização e tente de novo.",
      ...(debug && { debug }),
    });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("org_id", orgId)
    .single();

  if (!client) {
    return res.status(404).json({ error: "Cliente não encontrado" });
  }

  await supabase
    .from("client_sessions")
    .update({ expires_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("client_id", clientId)
    .gt("expires_at", new Date().toISOString());

  const newToken = randomUUID() + "-" + randomBytes(12).toString("hex");

  const { error: insertErr } = await supabase
    .from("client_sessions")
    .insert({
      org_id: orgId,
      client_id: clientId,
      token: newToken,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

  if (insertErr) {
    console.error("[create-portal-session]", insertErr);
    return res.status(500).json({ error: insertErr.message || "Erro ao criar sessão" });
  }

  const baseUrl = process.env.BASE_URL || (req.headers.origin || "").replace(/\/$/, "") || "http://localhost:3000";
  const url = `${baseUrl}/portal.html?token=${encodeURIComponent(newToken)}`;

  return res.status(200).json({ token: newToken, url });
}

