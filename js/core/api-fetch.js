/**
 * Fetch autenticado para /api/*.
 * Envia Authorization Bearer da sessão Supabase.
 * Se o body JSON não tiver org, inclui a organização ativa (contexto, não prova).
 */

import { supabase } from "./supabase.js";
import { getApiBase } from "./api-base.js";
import { getActiveOrg } from "./org.js";
import { mensagemDeRespostaHttp, userFacingError } from "./errors.js";

export async function apiFetch(path, options = {}) {
  const { json, headers: extraHeaders, ...rest } = options;
  const { data } = await supabase.auth.getSession();
  const headers = { ...(extraHeaders || {}) };
  if (data?.session?.access_token) {
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }

  let body = rest.body;
  if (json !== undefined) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    const payload = json && typeof json === "object" && !Array.isArray(json) ? { ...json } : json;
    const orgId = getActiveOrg();
    if (payload && typeof payload === "object" && !Array.isArray(payload) && orgId) {
      if (payload.org_id == null && payload.orgId == null && payload.org == null) {
        payload.org_id = orgId;
      }
    }
    body = JSON.stringify(payload);
  }

  return fetch(`${getApiBase()}${path}`, { ...rest, headers, body });
}

/**
 * Falha HTTP vira Error com .status e mensagem em português (nunca só "403").
 */
export async function falhaApi(res) {
  const msg = await mensagemDeRespostaHttp(res);
  const err = new Error(msg);
  err.status = Number(res?.status) || 0;
  return err;
}

export async function apiJson(path, options = {}) {
  const res = await apiFetch(path, options);
  if (!res.ok) throw await falhaApi(res);
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    throw new Error(userFacingError({ status: res.status, message: "Resposta inválida do servidor." }));
  }
  return res.json();
}
