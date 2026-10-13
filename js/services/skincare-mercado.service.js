import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";
import { isDestaqueFonteCompleta } from "../utils/skincare-mercado.js";

export const SQL_SKINCARE_MERCADO = "supabase-fase0-skincare-mercado-colar.sql";

function missingTable(error) {
  const msg = String(error?.message || "");
  const code = String(error?.code || "");
  return code === "42P01" || code === "PGRST205" || /skincare_mercado_refs|does not exist|schema cache/i.test(msg);
}

function orgOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

export async function listSkincareMercado() {
  const { data, error } = await withOrg(
    supabase
      .from("skincare_mercado_refs")
      .select("id, marca_produto, porque, fonte, data_ref, metodologia, confianca, amostra, regiao, notas, created_at")
      .order("data_ref", { ascending: false })
  );
  if (error) {
    if (missingTable(error)) {
      const e = new Error("SQL_AUSENTE");
      e.code = "SQL_AUSENTE";
      throw e;
    }
    throw error;
  }
  return (data || []).filter(isDestaqueFonteCompleta);
}

export async function createSkincareMercado(payload) {
  const orgId = orgOrThrow();
  const row = {
    org_id: orgId,
    marca_produto: String(payload.marca_produto || "").trim(),
    porque: String(payload.porque || "").trim(),
    fonte: String(payload.fonte || "").trim(),
    data_ref: String(payload.data_ref || "").slice(0, 10),
    metodologia: String(payload.metodologia || "").trim(),
    confianca: String(payload.confianca || "").toLowerCase(),
    amostra: Number(payload.amostra),
    regiao: String(payload.regiao || "").trim() || null,
    notas: String(payload.notas || "").trim() || null,
  };
  if (!isDestaqueFonteCompleta(row)) {
    throw new Error("Preencha produto/marca, por que destaca, fonte, data, método, confiança e amostra.");
  }
  const { data, error } = await supabase.from("skincare_mercado_refs").insert(row).select().single();
  if (error) {
    if (missingTable(error)) {
      throw new Error("Cole no Supabase o SQL " + SQL_SKINCARE_MERCADO + " para cadastrar destaques.");
    }
    throw error;
  }
  return data;
}

export async function deleteSkincareMercado(id) {
  const orgId = orgOrThrow();
  const { error } = await supabase.from("skincare_mercado_refs").delete().eq("id", id).eq("org_id", orgId);
  if (error) throw error;
}
