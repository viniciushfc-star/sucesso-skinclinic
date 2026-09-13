/**
 * POST /api/analise-pele-portal-list
 * Portal: token de sessão do cliente. Sem ia_preliminar, sem fotos.
 */

import { getAdminClient } from "../lib/api-auth.js";
import { sanitizePortalAnaliseRow } from "../lib/analise-pele-storage.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido" });
  }

  const token = String(req.body?.token || "").trim();
  if (!token) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const admin = getAdminClient();
  const { data: session, error: sessionError } = await admin.rpc("get_client_session_by_token", {
    p_token: token,
  });
  if (sessionError || !session?.length) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  const { client_id, org_id } = session[0];
  if (!client_id || !org_id) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const { data: rows, error } = await admin
    .from("analise_pele")
    .select("id, status, created_at, texto_validado")
    .eq("org_id", org_id)
    .eq("client_id", client_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[analise-pele-portal-list]", error.message);
    return res.status(500).json({ error: "Erro interno" });
  }

  const list = (rows || []).map(sanitizePortalAnaliseRow).filter(Boolean);
  return res.status(200).json({ analises: list });
}
