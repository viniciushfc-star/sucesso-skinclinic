/**
 * Fetch autenticado para /api/*.
 * Envia Authorization Bearer da sessão Supabase.
 * Se o body JSON não tiver org, inclui a organização ativa (contexto, não prova).
 */

import { supabase } from "./supabase.js";
import { getApiBase } from "./api-base.js";
import { getActiveOrg } from "./org.js";

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
