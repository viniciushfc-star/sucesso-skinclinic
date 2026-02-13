import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";

function getOrgOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

/**
 * Lista participação nos lucros (master e sócios) por período (apenas master).
 */
export async function listParticipacaoLucros(periodoRef = null) {
  let q = withOrg(
    supabase.from("participacao_lucros").select("*").order("periodo_ref", { ascending: false }).order("tipo")
  );
  if (periodoRef) q = q.eq("periodo_ref", periodoRef);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/**
 * Cria registro de participação (ex.: sócio João 20% ou valor fixo).
 */
export async function createParticipacaoLucros({ tipo, nomeLabel, percentual, valorFixo, periodoRef }) {
  const orgId = getOrgOrThrow();
  if (!["master", "socio"].includes(tipo)) throw new Error("Tipo deve ser master ou socio");
  if ((percentual == null || percentual === "") && (valorFixo == null || valorFixo === ""))
    throw new Error("Informe percentual ou valor fixo");
  const payload = {
    org_id: orgId,
    tipo,
    nome_label: (nomeLabel || "").trim(),
    periodo_ref: (periodoRef || "").trim(),
    percentual: percentual !== "" && percentual != null ? Number(percentual) : null,
    valor_fixo: valorFixo !== "" && valorFixo != null ? Number(valorFixo) : null,
  };
  const { data, error } = await supabase.from("participacao_lucros").insert(payload).select().single();
  if (error) throw error;
  return data;
}

/**
 * Atualiza participação (ex.: valor_calculado, pago_em).
 */
export async function updateParticipacaoLucros(id, { nomeLabel, percentual, valorFixo, valorCalculado, pagoEm, periodoRef }) {
  const payload = {};
  if (nomeLabel !== undefined) payload.nome_label = (nomeLabel || "").trim();
  if (percentual !== undefined) payload.percentual = percentual === "" || percentual == null ? null : Number(percentual);
  if (valorFixo !== undefined) payload.valor_fixo = valorFixo === "" || valorFixo == null ? null : Number(valorFixo);
  if (valorCalculado !== undefined) payload.valor_calculado = valorCalculado == null ? null : Number(valorCalculado);
  if (pagoEm !== undefined) payload.pago_em = pagoEm || null;
  if (periodoRef !== undefined) payload.periodo_ref = (periodoRef || "").trim();
  const { data, error } = await withOrg(
    supabase.from("participacao_lucros").update(payload).eq("id", id).select().single()
  );
  if (error) throw error;
  return data;
}

/**
 * Exclui registro de participação.
 */
export async function deleteParticipacaoLucros(id) {
  const { error } = await withOrg(supabase.from("participacao_lucros").delete().eq("id", id));
  if (error) throw error;
}
