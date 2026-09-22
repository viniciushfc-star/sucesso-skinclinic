import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";
import { isFonteCompleta } from "../utils/market-radar.js";

function orgOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

export async function listMarketRadar() {
  const { data, error } = await withOrg(
    supabase
      .from("market_radar_refs")
      .select("id, procedimento, procedure_id, regiao, preco_min, preco_max, fonte, data_ref, metodologia, confianca, amostra, notas, created_at")
      .order("data_ref", { ascending: false })
  );
  if (error) throw error;
  return (data || []).filter(isFonteCompleta);
}

export async function createMarketRadar(payload) {
  const orgId = orgOrThrow();
  const row = {
    org_id: orgId,
    procedimento: String(payload.procedimento || "").trim(),
    procedure_id: payload.procedure_id || null,
    regiao: String(payload.regiao || "").trim(),
    preco_min: Number(payload.preco_min),
    preco_max: Number(payload.preco_max),
    fonte: String(payload.fonte || "").trim(),
    data_ref: String(payload.data_ref || "").slice(0, 10),
    metodologia: String(payload.metodologia || "").trim(),
    confianca: String(payload.confianca || "").toLowerCase(),
    amostra: Number(payload.amostra),
    notas: String(payload.notas || "").trim() || null,
  };
  if (!isFonteCompleta(row)) {
    throw new Error("Preencha procedimento, região, faixa, fonte, data, metodologia, confiança e amostra.");
  }
  const { data, error } = await supabase.from("market_radar_refs").insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function deleteMarketRadar(id) {
  const orgId = orgOrThrow();
  const { error } = await supabase.from("market_radar_refs").delete().eq("id", id).eq("org_id", orgId);
  if (error) throw error;
}
