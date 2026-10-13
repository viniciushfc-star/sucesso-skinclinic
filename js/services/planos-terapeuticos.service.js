import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";
import { retryUnknownColumns } from "../utils/supabase-unknown-col.js";
import { audit } from "./audit.service.js";

function missingPlanosTable(error) {
  const msg = String(error?.message || "");
  const code = String(error?.code || "");
  return code === "42P01" || code === "PGRST205" || /planos_terapeuticos|does not exist|schema cache/i.test(msg);
}

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
  if (error) {
    if (missingPlanosTable(error)) return [];
    throw error;
  }
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
  const { data: plano, error: errPlano } = await retryUnknownColumns(
    {
      org_id: orgId,
      nome: (nome || "").trim(),
      dor_cliente: (dorCliente || "").trim() || null,
      explicacao_terapeutica: (explicacaoTerapeutica || "").trim() || null,
    },
    (row) => supabase.from("planos_terapeuticos").insert(row).select().single(),
    { immutable: ["org_id", "nome"] }
  );
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
  await audit({
    action: "plano.create",
    tableName: "planos_terapeuticos",
    recordId: plano.id,
    permissionUsed: "planos:view",
    metadata: {
      nome: plano.nome,
      procedure_ids_count: procedureIds ? procedureIds.length : 0,
    },
  });
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
  const { data: plano, error: errPlano } = await retryUnknownColumns(
    payload,
    (row) => supabase.from("planos_terapeuticos").update(row).eq("id", id).eq("org_id", orgId).select().single(),
    { immutable: ["nome"] }
  );
  if (errPlano) throw errPlano;
  if (procedureIds !== undefined) {
    await supabase.from("planos_terapeuticos_procedimentos").delete().eq("plano_id", id);
    if (procedureIds.length > 0) {
      const rows = procedureIds.map((procedure_id, i) => ({ plano_id: id, procedure_id, ordem: i, quantidade: 1 }));
      await supabase.from("planos_terapeuticos_procedimentos").insert(rows);
    }
  }
  await audit({
    action: "plano.update",
    tableName: "planos_terapeuticos",
    recordId: id,
    permissionUsed: "planos:view",
    metadata: {
      nome: plano?.nome || payload.nome,
      procedure_ids_count: procedureIds !== undefined ? procedureIds.length : undefined,
    },
  });
  return plano;
}

/**
 * Remove um plano terapêutico (e vínculos).
 */
export async function deletePlanoTerapeutico(id) {
  const orgId = getOrgOrThrow();
  const { error } = await supabase.from("planos_terapeuticos").delete().eq("id", id).eq("org_id", orgId);
  if (error) throw error;
  await audit({
    action: "plano.delete",
    tableName: "planos_terapeuticos",
    recordId: id,
    permissionUsed: "planos:view",
    metadata: {},
  });
}

/**
 * Planos terapêuticos ligados a horários desta pessoa (agenda.plano_id).
 */
export async function listPlanosDoCliente(clientId) {
  if (!clientId) return [];
  getOrgOrThrow();
  const { data: rows, error } = await withOrg(
    supabase
      .from("agenda")
      .select("id, plano_id, procedimento, data, hora")
      .eq("cliente_id", clientId)
      .not("plano_id", "is", null)
  );
  if (error || !rows?.length) return [];
  const ids = [...new Set(rows.map((r) => r.plano_id).filter(Boolean))];
  if (!ids.length) return [];
  const catalog = await listPlanosTerapeuticos().catch(() => []);
  const byId = new Map((catalog || []).map((p) => [p.id, p]));
  return ids.map((id) => {
    const p = byId.get(id);
    const sessoes = rows.filter((r) => r.plano_id === id);
    return {
      id,
      nome: p?.nome || sessoes[0]?.procedimento || "Plano terapêutico",
      procedimentos: p?.procedimentos || [],
      sessoes: sessoes.map((s) => ({
        id: s.id,
        procedimento: s.procedimento,
        data: s.data,
        hora: s.hora,
      })),
      sessoes_utilizadas: sessoes.length,
    };
  });
}
