/**
 * Anamnese: contexto vivo, conduzida pelo atendimento.
 * Pele é função da anamnese, não módulo isolado.
 * @see .cursor/rules/anamnese-canon.mdc
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";

function getOrgOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

/** Áreas por queixa: cabelo → Capilar; rosto → Pele ou Injetáveis; corpo → Corporal */
const FUNCOES_PADRAO = [
  { nome: "Capilar (cabelo)", slug: "capilar", ordem: 1 },
  { nome: "Rosto — Pele", slug: "rosto_pele", ordem: 2 },
  { nome: "Rosto — Injetáveis", slug: "rosto_injetaveis", ordem: 3 },
  { nome: "Corporal (corpo)", slug: "corporal", ordem: 4 }
];

/**
 * Lista funções clínicas da anamnese (Pele, Corporal, Capilar, etc.).
 * Garante funções padrão se a org ainda não tiver nenhuma.
 */
export async function listFuncoes() {
  const orgId = getOrgOrThrow();
  const { data, error } = await withOrg(
    supabase
      .from("anamnesis_funcoes")
      .select("id, nome, slug, ordem")
      .eq("active", true)
      .order("ordem")
  );
  if (error) throw error;
  const list = data ?? [];
  if (list.length === 0) {
    await ensureDefaultFuncoes(orgId);
    return listFuncoes();
  }
  return list;
}

/**
 * Insere funções padrão (Pele, Corporal, Capilar) para a org.
 */
export async function ensureDefaultFuncoes(orgId) {
  if (!orgId) return;
  for (const f of FUNCOES_PADRAO) {
    const { error } = await supabase
      .from("anamnesis_funcoes")
      .upsert(
        { org_id: orgId, nome: f.nome, slug: f.slug, ordem: f.ordem, active: true },
        { onConflict: "org_id,slug" }
      );
    if (error && error.code !== "23505") throw error;
  }
}

/**
 * Sugere slug de função a partir do nome do procedimento (ex.: "Limpeza de pele" → "pele").
 */
export function suggestFuncaoFromProcedimento(procedimentoNome) {
  if (!procedimentoNome || typeof procedimentoNome !== "string") return null;
  const lower = procedimentoNome.toLowerCase();
  if (/\b(pele|facial|estética facial|skin|derma)\b/.test(lower)) return "pele";
  if (/\b(corporal|corpo|massagem|corporal)\b/.test(lower)) return "corporal";
  if (/\b(capilar|cabelo|couro cabeludo)\b/.test(lower)) return "capilar";
  return null;
}

/**
 * Lista registros evolutivos da anamnese de um cliente para uma função.
 * Ordem: mais recente primeiro.
 */
export async function listRegistrosByClientAndFuncao(clientId, funcaoId) {
  if (!clientId || !funcaoId) return [];
  const orgId = getOrgOrThrow();
  const cols = "id, conteudo, ficha, fotos, conduta_tratamento, agenda_id, author_id, created_at";
  const { data, error } = await withOrg(
    supabase
      .from("anamnesis_registros")
      .select(cols + ", resultado_resumo")
      .eq("org_id", orgId)
      .eq("client_id", clientId)
      .eq("funcao_id", funcaoId)
      .order("created_at", { ascending: false })
  );
  if (error) {
    const colMissing = (error.code === "42703" || error.message?.includes("does not exist")) && String(error.message || "").includes("resultado_resumo");
    if (colMissing) {
      const { data: fallback, error: err2 } = await withOrg(
        supabase
          .from("anamnesis_registros")
          .select(cols)
          .eq("org_id", orgId)
          .eq("client_id", clientId)
          .eq("funcao_id", funcaoId)
          .order("created_at", { ascending: false })
      );
      if (err2) throw err2;
      return (fallback ?? []).map((r) => ({ ...r, resultado_resumo: r.ficha?.resultado_resumo ?? null }));
    }
    throw error;
  }
  return data ?? [];
}

/**
 * Lista todos os registros de anamnese de um cliente (todas as funções), mais recentes primeiro.
 * Útil para montar contexto (ex.: Skincare IA).
 */
export async function listRegistrosByClient(clientId) {
  if (!clientId) return [];
  const orgId = getOrgOrThrow();
  const { data, error } = await withOrg(
    supabase
      .from("anamnesis_registros")
      .select("id, conteudo, ficha, conduta_tratamento, funcao_id, created_at, anamnesis_funcoes(nome, slug)")
      .eq("org_id", orgId)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
  );
  if (error) throw error;
  return data ?? [];
}

/**
 * Lista registros vinculados a um atendimento (agenda_id).
 */
export async function listRegistrosByAgenda(agendaId) {
  if (!agendaId) return [];
  const orgId = getOrgOrThrow();
  const { data, error } = await withOrg(
    supabase
      .from("anamnesis_registros")
      .select("id, conteudo, funcao_id, client_id, created_at, anamnesis_funcoes(nome, slug)")
      .eq("org_id", orgId)
      .eq("agenda_id", agendaId)
      .order("created_at", { ascending: false })
  );
  if (error) throw error;
  return data ?? [];
}

/**
 * Normaliza fotos para array de { url, data?, observacao? }.
 * Aceita: string[] (legado) ou { url, data?, observacao? }[].
 */
function normalizeFotos(fotos) {
  if (!Array.isArray(fotos)) return [];
  return fotos.map((item) => {
    if (typeof item === "string") return { url: item, data: null, observacao: null };
    if (item && typeof item.url === "string") return { url: item.url, data: item.data || null, observacao: item.observacao || null };
    return null;
  }).filter(Boolean);
}

/**
 * Cria um novo registro evolutivo na anamnese.
 * @param {Object} p - clientId, funcaoId, conteudo (opcional), ficha (objeto), fotos (array de { url, data?, observacao? } ou URLs), conduta_tratamento, agendaId, authorId
 */
export async function createRegistro({
  clientId,
  funcaoId,
  conteudo = "",
  ficha = {},
  fotos = [],
  conduta_tratamento = null,
  agendaId = null,
  authorId = null,
  resultado_resumo = null
}) {
  if (!clientId || !funcaoId) throw new Error("Cliente e função são obrigatórios.");
  const fotosNorm = normalizeFotos(fotos);
  const hasContent =
    (conteudo && conteudo.trim()) ||
    (ficha && Object.keys(ficha).length > 0) ||
    (conduta_tratamento && conduta_tratamento.trim()) ||
    fotosNorm.length > 0 ||
    (resultado_resumo && resultado_resumo.trim());
  if (!hasContent) throw new Error("Preencha ao menos a ficha, observações, conduta ou envie fotos.");
  const orgId = getOrgOrThrow();
  const fichaSafe = ficha && typeof ficha === "object" ? JSON.parse(JSON.stringify(ficha)) : {};
  const { data, error } = await supabase
    .from("anamnesis_registros")
    .insert({
      org_id: orgId,
      client_id: clientId,
      funcao_id: funcaoId,
      agenda_id: agendaId || null,
      conteudo: (conteudo || "").trim(),
      ficha: fichaSafe,
      fotos: fotosNorm,
      conduta_tratamento: conduta_tratamento && conduta_tratamento.trim() ? conduta_tratamento.trim() : null,
      resultado_resumo: resultado_resumo && resultado_resumo.trim() ? resultado_resumo.trim() : null,
      author_id: authorId || null
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Atualiza apenas o resumo de resultado de um registro de anamnese.
 */
export async function updateResultadoResumo(registroId, resultado_resumo) {
  if (!registroId) throw new Error("Registro inválido.");
  const orgId = getOrgOrThrow();
  const { data, error } = await withOrg(
    supabase
      .from("anamnesis_registros")
      .update({
        resultado_resumo:
          resultado_resumo && resultado_resumo.trim() ? resultado_resumo.trim() : null
      })
      .eq("org_id", orgId)
      .eq("id", registroId)
      .select()
      .single()
  );
  if (error) throw error;
  return data;
}

const BUCKET_ANAMNESE = "anamnese-fotos";

/**
 * Faz upload de uma foto da anamnese e retorna a URL pública (ou signed).
 * Caminho: org_id/cliente_id/nome_arquivo. Use suffix (ex.: índice) para vários arquivos no mesmo segundo.
 */
export async function uploadFotoAnamnese(file, clientId, suffix = "") {
  if (!file || !clientId) throw new Error("Arquivo e clientId são obrigatórios.");
  const orgId = getOrgOrThrow();
  const ext = (file.name || "").split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = /^[a-z0-9]+$/i.test(ext) ? ext : "jpg";
  const uniq = suffix !== "" ? `${Date.now()}_${suffix}` : String(Date.now());
  const path = `${orgId}/${clientId}/${uniq}.${safeExt}`;
  const { data, error } = await supabase.storage.from(BUCKET_ANAMNESE).upload(path, file, {
    cacheControl: "3600",
    upsert: false
  });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from(BUCKET_ANAMNESE).getPublicUrl(data.path);
  return urlData?.publicUrl || data.path;
}

/* =====================
   CAMPOS PERSONALIZADOS (conforme demanda da clínica)
===================== */

/**
 * Lista campos personalizados de uma função (área) para a org ativa.
 */
export async function listCamposPersonalizados(funcaoId) {
  if (!funcaoId) return [];
  const orgId = getOrgOrThrow();
  const { data, error } = await withOrg(
    supabase
      .from("anamnesis_campos_personalizados")
      .select("id, key, label, type, placeholder, options, ordem")
      .eq("org_id", orgId)
      .eq("funcao_id", funcaoId)
      .eq("active", true)
      .order("ordem")
  );
  if (error) {
    if (error.code === "PGRST205" || error.message?.includes("Could not find the table")) return [];
    throw error;
  }
  return data ?? [];
}

/**
 * Cria um campo personalizado. key: identificador único na ficha (ex.: medicacao_rotina).
 */
export async function createCampoPersonalizado({ funcaoId, key, label, type = "text", placeholder = null, options = [] }) {
  if (!funcaoId || !key || !label) throw new Error("Função, chave e label são obrigatórios.");
  const slug = key.replace(/[^a-z0-9_]/gi, "_").toLowerCase() || "custom_" + Date.now();
  const orgId = getOrgOrThrow();
  const { data, error } = await supabase
    .from("anamnesis_campos_personalizados")
    .insert({
      org_id: orgId,
      funcao_id: funcaoId,
      key: slug,
      label: label.trim(),
      type: type || "text",
      placeholder: placeholder && placeholder.trim() ? placeholder.trim() : null,
      options: Array.isArray(options) ? options : [],
      ordem: 999
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Atualiza um campo personalizado.
 */
export async function updateCampoPersonalizado(id, { label, type, placeholder, options, ordem }) {
  if (!id) throw new Error("ID do campo é obrigatório.");
  const orgId = getOrgOrThrow();
  const payload = {};
  if (label != null) payload.label = label.trim();
  if (type != null) payload.type = type;
  if (placeholder != null) payload.placeholder = placeholder && placeholder.trim() ? placeholder.trim() : null;
  if (options != null) payload.options = Array.isArray(options) ? options : [];
  if (ordem != null) payload.ordem = Number(ordem);
  const { data, error } = await withOrg(
    supabase.from("anamnesis_campos_personalizados").update(payload).eq("id", id).eq("org_id", orgId).select().single()
  );
  if (error) throw error;
  return data;
}

/**
 * Desativa (soft delete) um campo personalizado.
 */
export async function deleteCampoPersonalizado(id) {
  if (!id) throw new Error("ID do campo é obrigatório.");
  const orgId = getOrgOrThrow();
  const { error } = await withOrg(
    supabase.from("anamnesis_campos_personalizados").update({ active: false }).eq("id", id).eq("org_id", orgId)
  );
  if (error) throw error;
}
