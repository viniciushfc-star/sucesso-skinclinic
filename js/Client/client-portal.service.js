import { supabase } from "../core/supabase.js";

/* =========================
   SESSION
========================= */

/**
 * Valida sessão do cliente via token (RPC — funciona sem login staff).
 * Retorna client_id, org_id, expires_at, registration_completed_at.
 */
export async function initClientSession(token) {
  if (!token) {
    throw new Error("Token inválido");
  }

  const { data, error } = await supabase.rpc("get_client_session_by_token", {
    p_token: token
  });

  if (error || !data || data.length === 0) {
    throw new Error("Sessão inválida ou expirada");
  }

  const row = data[0];
  if (!row.client_id) {
    throw new Error("Sessão inválida ou expirada");
  }

  try {
    await supabase.rpc("set_config", {
      key: "app.client_token",
      value: token,
      is_local: true
    });
  } catch (_) {}

  return row;
}

/**
 * Dados do cliente para o portal (completar cadastro).
 */
export async function getClientByToken(token) {
  if (!token) throw new Error("Token inválido");
  const { data, error } = await supabase.rpc("get_client_by_token", { p_token: token });
  if (error) throw error;
  return data?.[0] ?? null;
}

/**
 * Cliente completa o próprio cadastro (nome, contato, termo de consentimento).
 * Auditoria registra "cliente X completou o próprio cadastro" e aceite do termo.
 */
export async function completeRegistration(token, payload) {
  if (!token) throw new Error("Token inválido");
  const { data, error } = await supabase.rpc("client_complete_registration", {
    p_token: token,
    p_name: payload.name || "",
    p_phone: payload.phone || null,
    p_email: payload.email || null,
    p_birth_date: payload.birth_date || null,
    p_sex: payload.sex || null,
    p_notes: payload.notes || null,
    p_cpf: payload.cpf || null,
    p_consent_terms_accepted: payload.consent_terms_accepted === true,
    p_consent_image_use: payload.consent_image_use === true,
    p_consent_terms_version: payload.consent_terms_version || "v1"
  });
  if (error) throw error;
  return data;
}

/**
 * Cliente assina apenas o termo de consentimento (link com ?mode=consent).
 * Exige nome por extenso para respaldo jurídico.
 */
export async function signConsentOnly(token, payload) {
  if (!token) throw new Error("Token inválido");
  const { error } = await supabase.rpc("client_sign_consent_only", {
    p_token: token,
    p_signed_name: payload.signed_name || "",
    p_consent_image_use: payload.consent_image_use === true,
    p_consent_terms_version: payload.consent_terms_version || "v1",
  });
  if (error) throw error;
}

/* =========================
   READ — PRONTUÁRIO
========================= */

/**
 * Retorna registros compartilhados do cliente
 */
export async function getSharedRecords() {
  const { data, error } = await supabase
    .from("client_records")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

/* =========================
   RELATAR EVENTO (painel do cliente)
========================= */

/**
 * Cliente relata um evento (relato do cliente).
 * Usa token em sessionStorage (client_portal_token).
 */
export async function reportClientEvent(eventType, description) {
  if (!eventType || !eventType.trim()) {
    throw new Error("Tipo do evento é obrigatório");
  }
  const token =
    typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem("client_portal_token")
      : null;
  if (!token) {
    throw new Error("Sessão inválida. Acesse novamente pelo link enviado.");
  }

  const { data, error } = await supabase.rpc("report_client_event", {
    p_token: token,
    p_event_type: eventType.trim(),
    p_description: description ? description.trim() : null,
  });

  if (error) throw error;
  return data;
}

/**
 * Cliente envia mensagem (relato/dúvida) — usa report_client_event com tipo "Mensagem".
 */
export async function sendClientMessage(description) {
  return reportClientEvent("Mensagem", description || "");
}

/* =========================
   READ — PROTOCOLO (FUTURO)
========================= */

/**
 * Retorna dados básicos do protocolo ativo
 * (somente leitura)
 */
export async function getActiveProtocol() {
  const { data, error } = await supabase
    .from("client_protocols")
    .select("*")
    .eq("status", "active")
    .single();

  if (error) throw error;
  return data;
}

/* =========================
   ANÁLISE DE PELE POR IA (MVP)
========================= */

function getToken() {
  return typeof sessionStorage !== "undefined" ? sessionStorage.getItem("client_portal_token") : null;
}

/**
 * Lista análises de pele do cliente (por token).
 */
export async function getAnalisesPeleByToken() {
  const token = getToken();
  if (!token) throw new Error("Sessão inválida. Acesse pelo link enviado.");
  const { data, error } = await supabase.rpc("get_analises_pele_by_token", { p_token: token });
  if (error) throw error;
  return data ?? [];
}

/**
 * Submete análise de pele: envia para a API (imagens + respostas), que chama IA e salva via RPC.
 */
export async function submitAnalisePele(payload) {
  const token = getToken();
  if (!token) throw new Error("Sessão inválida. Acesse pelo link enviado.");
  const { getApiBase } = await import("../core/api-base.js");
  const res = await fetch(`${getApiBase()}/api/analise-pele`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      consentimento_imagens: payload.consentimento_imagens,
      menor_responsavel: payload.menor_responsavel || null,
      imagens: payload.imagens || [],
      respostas: payload.respostas || {},
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Erro ao enviar análise.");
  return json;
}

/* =========================
   ROTINA DE SKINCARE (portal — só se clínica liberou)
========================= */

/**
 * Retorna a rotina de skincare do cliente (só se a clínica tiver liberado).
 * @returns {Promise<{ id, conteudo, liberado_em, updated_at } | null>}
 */
export async function getSkincareRotinaByToken() {
  const token = getToken();
  if (!token) throw new Error("Sessão inválida. Acesse pelo link enviado.");
  const { data, error } = await supabase.rpc("get_skincare_rotina_by_token", { p_token: token });
  if (error) throw error;
  const row = data?.[0] ?? null;
  return row;
}

/**
 * Confirma horário pelo token do link (enviado por WhatsApp ou e-mail).
 * Não exige sessão do portal; qualquer pessoa com o link pode confirmar.
 * @returns {{ ok: boolean, error?: string }}
 */
export async function confirmarHorarioByToken(confirmToken) {
  if (!confirmToken || !String(confirmToken).trim()) {
    return { ok: false, error: "Link inválido." };
  }
  const { data, error } = await supabase.rpc("confirm_appointment_by_token", {
    p_token: String(confirmToken).trim(),
  });
  if (error) {
    console.warn("[PORTAL] confirm_appointment_by_token", error);
    return { ok: false, error: error.message || "Erro ao confirmar." };
  }
  const result = data || {};
  if (result.ok === true) return { ok: true };
  return { ok: false, error: result.error || "Link já utilizado ou inválido." };
}
