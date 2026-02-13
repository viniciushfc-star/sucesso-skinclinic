/**
 * Protocolo — cadastro e registro do que foi aplicado (proteção da empresa).
 * Alinha com PROTOCOLO-IDEIA-AMADURECIDA.md: protocolo na aba do cliente, estoque assume descartáveis.
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg } from "../core/org.js";
import { getResumoPorProduto } from "./estoque-entradas.service.js";

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
 * @returns {Promise<Array<{ id, protocolo_id, aplicado_em, observacao, protocolos: { nome } }>>}
 */
export async function getProtocolosAplicadosByClient(clientId) {
  if (!clientId) return [];
  const orgId = getOrgId();
  const { data, error } = await supabase
    .from("protocolos_aplicados")
    .select("id, protocolo_id, aplicado_em, observacao, protocolos(nome)")
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
  const hoje = new Date().toISOString().slice(0, 10);
  const inicio = `${hoje}T00:00:00.000Z`;
  const fim = `${hoje}T23:59:59.999Z`;
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
 * Registra que um protocolo foi aplicado ao cliente (e dispara consumo estimado de descartáveis no estoque).
 * @param {{ clientId: string, protocoloId: string, agendaId?: string, observacao?: string }} payload
 */
export async function createProtocoloAplicado(payload) {
  const orgId = getOrgId();
  const { clientId, protocoloId, agendaId = null, observacao = "" } = payload || {};
  if (!clientId || !protocoloId) throw new Error("Cliente e protocolo são obrigatórios.");

  const { data: uid } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("protocolos_aplicados")
    .insert({
      org_id: orgId,
      client_id: clientId,
      protocolo_id: protocoloId,
      agenda_id: agendaId || null,
      observacao: (observacao || "").trim(),
      created_by: uid?.user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}
