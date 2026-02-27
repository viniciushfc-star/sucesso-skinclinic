/**
 * Protocolo — cadastro e registro do que foi aplicado (proteção da empresa).
 * Alinha com PROTOCOLO-IDEIA-AMADURECIDA.md: protocolo na aba do cliente, estoque assume descartáveis.
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg } from "../core/org.js";
import { getTodayLocal } from "./metrics.service.js";
import { getResumoPorProduto, registrarConsumoEstimado } from "./estoque-entradas.service.js";

function getOrgId() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

/**
 * Lista descartáveis de um protocolo (para alerta de estoque).
 * @param {string} protocoloId
 * @returns {Promise<Array<{ produto_nome, quantidade }>>}
 */
export async function getDescartaveisByProtocolo(protocoloId) {
  if (!protocoloId) return [];
  const { data, error } = await supabase
    .from("protocolos_descartaveis")
    .select("produto_nome, quantidade")
    .eq("protocolo_id", protocoloId);
  if (error) throw error;
  return (data ?? []).map((r) => ({ produto_nome: (r.produto_nome || "").trim(), quantidade: Number(r.quantidade) || 0 }));
}

/**
 * Verifica se, ao aplicar este protocolo, algum descartável está em estoque baixo ou zerado.
 * Não bloqueia o registro; serve para exibir alerta opcional.
 * @param {string} protocoloId
 * @returns {Promise<{ alertas: Array<{ produto_nome, quantidade_necessaria, saldo_estimado }> }>}
 */
export async function getAlertaEstoqueProtocolo(protocoloId) {
  const descartaveis = await getDescartaveisByProtocolo(protocoloId);
  if (descartaveis.length === 0) return { alertas: [] };

  const resumos = await getResumoPorProduto();
  const porNome = {};
  for (const r of resumos) {
    const n = (r.produto_nome || "").trim();
    if (n) porNome[n] = r.saldo_estimado ?? 0;
  }

  const alertas = [];
  for (const d of descartaveis) {
    const nome = d.produto_nome;
    if (!nome) continue;
    const saldo = porNome[nome] ?? 0;
    const necessidade = d.quantidade;
    if (saldo < necessidade) {
      alertas.push({ produto_nome: nome, quantidade_necessaria: necessidade, saldo_estimado: saldo });
    }
  }
  return { alertas };
}

/**
 * Lista protocolos ativos da organização (para dropdown e cadastro).
 * @returns {Promise<Array<{ id, nome, descricao_passos, observacoes }>>}
 */
export async function getProtocolos() {
  const orgId = getOrgId();
  const { data, error } = await supabase
    .from("protocolos")
    .select("id, nome, descricao_passos, observacoes")
    .eq("org_id", orgId)
    .eq("active", true)
    .order("nome");
  if (error) throw error;
  return data ?? [];
}

/**
 * Lista protocolos aplicados a um cliente (histórico na aba do cliente).
 * @param {string} clientId
 * @returns {Promise<Array<{ id, protocolo_id, aplicado_em, observacao, descricao, produtos_usados, protocolos: { nome } }>>}
 */
export async function getProtocolosAplicadosByClient(clientId) {
  if (!clientId) return [];
  const orgId = getOrgId();
  const { data, error } = await supabase
    .from("protocolos_aplicados")
    .select("id, protocolo_id, aplicado_em, observacao, descricao, produtos_usados, protocolos(nome)")
    .eq("org_id", orgId)
    .eq("client_id", clientId)
    .order("aplicado_em", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Lista protocolos aplicados hoje (visão "protocolos do dia").
 * @returns {Promise<Array<{ id, client_id, aplicado_em, observacao, protocolos(nome), clients(name) }>>}
 */
export async function getProtocolosAplicadosHoje() {
  const orgId = getOrgId();
  const hoje = getTodayLocal();
  const startLocal = new Date(hoje + "T00:00:00");
  const endLocal = new Date(startLocal.getTime() + 24 * 60 * 60 * 1000 - 1);
  const inicio = startLocal.toISOString();
  const fim = endLocal.toISOString();
  const { data, error } = await supabase
    .from("protocolos_aplicados")
    .select("id, client_id, aplicado_em, observacao, protocolos(nome)")
    .eq("org_id", orgId)
    .gte("aplicado_em", inicio)
    .lte("aplicado_em", fim)
    .order("aplicado_em", { ascending: false });
  if (error) throw error;
  const ids = [...new Set((data ?? []).map((r) => r.client_id))];
  const names = {};
  if (ids.length > 0) {
    const { data: clients } = await supabase.from("clients").select("id, name").in("id", ids);
    (clients ?? []).forEach((c) => (names[c.id] = c.name));
  }
  return (data ?? []).map((r) => ({ ...r, client_name: names[r.client_id] ?? "—" }));
}

/**
 * Registra o que foi feito no atendimento: opcionalmente um protocolo cadastrado, descrição livre e produtos usados (estoque).
 * Ligado ao prontuário do paciente e à data (aplicado_em).
 * @param {{ clientId: string, protocoloId?: string, agendaId?: string, observacao?: string, descricao?: string, aplicado_em?: string, produtos_usados?: Array<{ produto_nome: string, quantidade?: number }> }} payload
 */
export async function createProtocoloAplicado(payload) {
  const orgId = getOrgId();
  const {
    clientId,
    protocoloId = null,
    agendaId = null,
    observacao = "",
    descricao = "",
    aplicado_em = null,
    produtos_usados = [],
  } = payload || {};
  if (!clientId) throw new Error("Cliente é obrigatório.");
  if (!protocoloId && !(descricao && descricao.trim()) && (!produtos_usados || produtos_usados.length === 0)) {
    throw new Error("Informe pelo menos: um protocolo, o que foi feito (descrição) ou produtos utilizados.");
  }

  const { data: uid } = await supabase.auth.getUser();
  const aplicadoAt = aplicado_em ? new Date(aplicado_em).toISOString() : new Date().toISOString();
  const produtosUsados = Array.isArray(produtos_usados)
    ? produtos_usados
        .filter((p) => p && (p.produto_nome || "").trim())
        .map((p) => ({
          produto_nome: (p.produto_nome || "").trim(),
          quantidade: Math.max(0, Number(p.quantidade) || 1),
        }))
    : [];

  const { data, error } = await supabase
    .from("protocolos_aplicados")
    .insert({
      org_id: orgId,
      client_id: clientId,
      protocolo_id: protocoloId || null,
      agenda_id: agendaId || null,
      aplicado_em: aplicadoAt,
      observacao: (observacao || "").trim(),
      descricao: (descricao || "").trim(),
      produtos_usados: produtosUsados,
      created_by: uid?.user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  for (const p of produtosUsados) {
    try {
      await registrarConsumoEstimado({
        produto_nome: p.produto_nome,
        quantidade: p.quantidade,
        protocolo_aplicado_id: data.id,
        tipo: "estimado",
      });
    } catch (e) {
      console.warn("[protocolo] consumo produto:", p.produto_nome, e);
    }
  }

  return data;
}
