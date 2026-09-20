/**
 * POST /api/create-portal-session
 * Body: { org_id, client_id } — contexto; identidade vem do JWT.
 */

import { randomUUID, randomBytes } from "node:crypto";
import { requireStaffAccess, sendAuthError, getAdminClient } from "../lib/api-auth.js";
import {
  PORTAL_SESSION_TTL_MS,
  hashPortalToken,
  isPortalSessionDevBypassEnabled,
} from "../lib/portal-token.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido" });
  }

  const skipPermissao = isPortalSessionDevBypassEnabled();
  let auth;
  try {
    auth = await requireStaffAccess(req, {
      permission: skipPermissao ? undefined : "clientes:manage",
    });
    if (skipPermissao) {
      console.warn("[create-portal-session] ALLOW_PORTAL_SESSION_DEV só vale em desenvolvimento local");
    }
  } catch (e) {
    return sendAuthError(res, e);
  }

  const { orgId } = auth;
  const clientId = String(req.body?.client_id ?? "").trim();
  if (!clientId) {
    return res.status(400).json({ error: "Envie org_id e client_id no body" });
  }

  const supabase = getAdminClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("org_id", orgId)
    .maybeSingle();

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
  const tokenHash = hashPortalToken(newToken);

  const { error: insertErr } = await supabase
    .from("client_sessions")
    .insert({
      org_id: orgId,
      client_id: clientId,
      token: tokenHash,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + PORTAL_SESSION_TTL_MS).toISOString(),
    });

  if (insertErr) {
    console.error("[create-portal-session]", insertErr);
    return res.status(500).json({ error: "Erro ao criar sessão" });
  }

  const baseUrl = process.env.BASE_URL || (req.headers.origin || "").replace(/\/$/, "") || "http://localhost:3000";
  const url = `${baseUrl}/portal.html?token=${encodeURIComponent(newToken)}`;

  return res.status(200).json({ token: newToken, url });
}
