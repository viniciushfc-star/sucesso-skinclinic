/**
 * POST /api/analise-pele-fotos
 * Dashboard: JWT + membership. Gera Signed URL só para fotos da análise da org autenticada.
 * Body: { analise_id } — path não é autoridade.
 */

import { requireStaffAccess, sendAuthError, getAdminClient } from "../lib/api-auth.js";
import {
  ANALISE_PELE_BUCKET,
  collectOwnedAnalisePelePaths,
} from "../lib/analise-pele-storage.js";

const SIGNED_TTL_SEC = 60 * 60;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido" });
  }

  let auth;
  try {
    auth = await requireStaffAccess(req, { permission: "clientes:view" });
  } catch (e) {
    return sendAuthError(res, e);
  }

  const analiseId = String(req.body?.analise_id || req.body?.id || "").trim();
  if (!analiseId) {
    return res.status(400).json({ error: "Informe a análise." });
  }

  const admin = getAdminClient();
  const { data: row, error } = await admin
    .from("analise_pele")
    .select("id, org_id, client_id, imagens")
    .eq("id", analiseId)
    .eq("org_id", auth.orgId)
    .maybeSingle();

  if (error) {
    console.error("[analise-pele-fotos]", error.message);
    return res.status(500).json({ error: "Erro interno" });
  }
  if (!row) {
    return res.status(403).json({ error: "Sem permissão" });
  }

  const paths = collectOwnedAnalisePelePaths(row.imagens, row.org_id, row.client_id);
  if (!paths.length) {
    return res.status(200).json({ urls: [] });
  }

  const signed = [];
  for (const path of paths) {
    const { data, error: signErr } = await admin.storage
      .from(ANALISE_PELE_BUCKET)
      .createSignedUrl(path, SIGNED_TTL_SEC);
    if (signErr || !data?.signedUrl) {
      console.warn("[analise-pele-fotos] signed url falhou");
      continue;
    }
    signed.push({ path, url: data.signedUrl });
  }

  return res.status(200).json({ urls: signed, expires_in: SIGNED_TTL_SEC });
}
