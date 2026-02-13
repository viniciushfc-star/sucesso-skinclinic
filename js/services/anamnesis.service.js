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
  const { data, error } = await withOrg(
    supabase
      .from("anamnesis_registros")
      .select("id, conteudo, ficha, fotos, conduta_tratamento, resultado_resumo, agenda_id, author_id, created_at")
      .eq("org_id", orgId)
      .eq("client_id", clientId)
      .eq("funcao_id", funcaoId)
      .order("created_at", { ascending: false })
  );
  if (error) throw error;
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
 * Cria um novo registro evolutivo na anamnese.
 * @param {Object} p - clientId, funcaoId, conteudo (opcional), ficha (objeto), fotos (array URLs), conduta_tratamento, agendaId, authorId
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
  const hasContent =
    (conteudo && conteudo.trim()) ||
    (ficha && Object.keys(ficha).length > 0) ||
    (conduta_tratamento && conduta_tratamento.trim()) ||
    (fotos && fotos.length > 0) ||
    (resultado_resumo && resultado_resumo.trim());
  if (!hasContent) throw new Error("Preencha ao menos a ficha, observações, conduta ou envie fotos.");
  const orgId = getOrgOrThrow();
  const { data, error } = await supabase
    .from("anamnesis_registros")
    .insert({
      org_id: orgId,
      client_id: clientId,
      funcao_id: funcaoId,
      agenda_id: agendaId || null,
      conteudo: (conteudo || "").trim(),
      ficha: ficha && typeof ficha === "object" ? ficha : {},
      fotos: Array.isArray(fotos) ? fotos : [],
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
 * Caminho: org_id/cliente_id/nome_arquivo
 */
export async function uploadFotoAnamnese(file, clientId) {
  if (!file || !clientId) throw new Error("Arquivo e clientId são obrigatórios.");
  const orgId = getOrgOrThrow();
  const ext = (file.name || "").split(".").pop() || "jpg";
  const path = `${orgId}/${clientId}/${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage.from(BUCKET_ANAMNESE).upload(path, file, {
    cacheControl: "3600",
    upsert: false
  });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from(BUCKET_ANAMNESE).getPublicUrl(data.path);
  return urlData?.publicUrl || data.path;
}
