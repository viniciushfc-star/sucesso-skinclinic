import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";

function getOrgOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

/**
 * Lista planos terapêuticos da organização (com procedimentos vinculados).
 */
export async function listPlanosTerapeuticos() {
  const orgId = getOrgOrThrow();
  const { data: planos, error } = await withOrg(
    supabase.from("planos_terapeuticos").select("id, nome, dor_cliente, explicacao_terapeutica, created_at").order("nome")
  );
  if (error) throw error;
  const list = planos ?? [];
  const { data: links } = await supabase.from("planos_terapeuticos_procedimentos").select("plano_id, procedure_id, ordem, quantidade");
  const linksByPlano = {};
  (links ?? []).forEach((l) => {
    if (!linksByPlano[l.plano_id]) linksByPlano[l.plano_id] = [];
    linksByPlano[l.plano_id].push({ procedure_id: l.procedure_id, ordem: l.ordem, quantidade: l.quantidade });
  });
  return list.map((p) => ({
    ...p,
    procedimentos: (linksByPlano[p.id] ?? []).sort((a, b) => a.ordem - b.ordem),
  }));
}

/**
 * Cria um plano terapêutico e vincula procedimentos.
 */
export async function createPlanoTerapeutico({ nome, dorCliente, explicacaoTerapeutica, procedureIds }) {
  const orgId = getOrgOrThrow();
  const { data: plano, error: errPlano } = await supabase
    .from("planos_terapeuticos")
    .insert({
      org_id: orgId,
      nome: (nome || "").trim(),
      dor_cliente: (dorCliente || "").trim() || null,
      explicacao_terapeutica: (explicacaoTerapeutica || "").trim() || null,
    })
    .select()
    .single();
  if (errPlano) throw errPlano;
  if (procedureIds && procedureIds.length > 0) {
    const rows = procedureIds.map((procedure_id, i) => ({
      plano_id: plano.id,
      procedure_id,
      ordem: i,
      quantidade: 1,
    }));
    const { error: errLinks } = await supabase.from("planos_terapeuticos_procedimentos").insert(rows);
    if (errLinks) throw errLinks;
  }
  return plano;
}

/**
 * Atualiza um plano terapêutico e seus vínculos com procedimentos.
 */
export async function updatePlanoTerapeutico(id, { nome, dorCliente, explicacaoTerapeutica, procedureIds }) {
  const orgId = getOrgOrThrow();
  const payload = {};
  if (nome !== undefined) payload.nome = (nome || "").trim();
  if (dorCliente !== undefined) payload.dor_cliente = (dorCliente || "").trim() || null;
  if (explicacaoTerapeutica !== undefined) payload.explicacao_terapeutica = (explicacaoTerapeutica || "").trim() || null;
  payload.updated_at = new Date().toISOString();
  const { data: plano, error: errPlano } = await supabase
    .from("planos_terapeuticos")
    .update(payload)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .single();
  if (errPlano) throw errPlano;
  if (procedureIds !== undefined) {
    await supabase.from("planos_terapeuticos_procedimentos").delete().eq("plano_id", id);
    if (procedureIds.length > 0) {
      const rows = procedureIds.map((procedure_id, i) => ({ plano_id: id, procedure_id, ordem: i, quantidade: 1 }));
      await supabase.from("planos_terapeuticos_procedimentos").insert(rows);
    }
  }
  return plano;
}

/**
 * Remove um plano terapêutico (e vínculos).
 */
export async function deletePlanoTerapeutico(id) {
  const orgId = getOrgOrThrow();
  const { error } = await supabase.from("planos_terapeuticos").delete().eq("id", id).eq("org_id", orgId);
  if (error) throw error;
}
