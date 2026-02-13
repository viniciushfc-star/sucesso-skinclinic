import { supabase } from "../core/supabase.js";
import { getActiveOrg } from "../core/org.js";

/* =========================
   HELPERS
========================= */

function getOrgOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) {
    throw new Error("Organização ativa não definida");
  }
  return orgId;
}

/* =========================
   READ
========================= */

/**
 * Lista registros do prontuário de um protocolo
 * (uso interno da clínica)
 */
export async function getRecordsByProtocol(protocolId) {
  if (!protocolId) {
    throw new Error("Protocolo inválido");
  }

  const orgId = getOrgOrThrow();

  const { data, error } = await supabase
    .from("client_records")
    .select("*")
    .eq("org_id", orgId)
    .eq("protocol_id", protocolId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

/* =========================
   CREATE
========================= */

/**
 * Cria um novo registro de prontuário
 * (nota, reação, ajuste, IA, etc.)
 */
export async function createRecord({
  clientId,
  protocolId,
  recordType,
  content,
  visibility = "internal"
}) {
  if (!clientId) throw new Error("Cliente inválido");
  if (!protocolId) throw new Error("Protocolo inválido");
  if (!recordType) throw new Error("Tipo de registro obrigatório");
  if (!content) throw new Error("Conteúdo obrigatório");

  const orgId = getOrgOrThrow();

  const { data, error } = await supabase
    .from("client_records")
    .insert({
      org_id: orgId,
      client_id: clientId,
      protocol_id: protocolId,
      author_id: null, // será preenchido via trigger ou view
      record_type: recordType,
      content,
      visibility
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
