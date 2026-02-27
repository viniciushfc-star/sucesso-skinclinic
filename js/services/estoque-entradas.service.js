/**
 * Estoque — entradas (OCR, manual, XML) e consumo estimado.
 * Canon: referência inteligente, não verdade absoluta; entrada facilitada.
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";
import { audit } from "./audit.service.js";
import { createAfazer, TIPOS_AFAZERES } from "./afazeres.service.js";

function getOrgOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

/** Lista entradas recentes (últimas N). */
export async function listEntradas(limit = 100) {
  const orgId = getOrgOrThrow();
  const { data, error } = await supabase
    .from("estoque_entradas")
    .select("*")
    .eq("org_id", orgId)
    .order("data_entrada", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Cria uma entrada (manual ou após OCR). */
export async function createEntrada(payload) {
  const orgId = getOrgOrThrow();
  const { data: { user } } = await supabase.auth.getUser();
  const {
    produto_nome,
    quantidade,
    valor_unitario,
    valor_total,
    fornecedor,
    data_entrada,
    data_validade,
    lote,
    origem = "manual",
    ocr_nota_id
  } = payload;

  if (!(produto_nome && produto_nome.trim())) throw new Error("Informe o produto.");

  const qty = Number(quantidade);
  if (isNaN(qty) || qty <= 0) throw new Error("Quantidade inválida.");

  const dataEntrada = data_entrada ? new Date(data_entrada).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const unit = valor_unitario != null && valor_unitario !== "" ? Number(valor_unitario) : null;
  const total = valor_total != null && valor_total !== "" ? Number(valor_total) : null;

  const { data, error } = await supabase
    .from("estoque_entradas")
    .insert({
      org_id: orgId,
      produto_nome: (produto_nome || "").trim(),
      quantidade: qty,
      valor_unitario: unit,
      valor_total: total,
      fornecedor: (fornecedor || "").trim() || null,
      data_entrada: dataEntrada,
      data_validade: data_validade ? new Date(data_validade).toISOString().slice(0, 10) : null,
      lote: (lote || "").trim() || null,
      origem: origem === "ocr" || origem === "xml" ? origem : "manual",
      ocr_nota_id: ocr_nota_id || null,
      created_by: user?.id ?? null
    })
    .select()
    .single();
  if (error) throw error;

  try {
    await checkMargemPosEntrada(orgId, data);
  } catch (e) {
    console.warn("[ESTOQUE] checkMargemPosEntrada falhou:", e);
  }

  return data;
}

/** Resumo por produto: total entradas, total consumo, saldo estimado. */
export async function getResumoPorProduto() {
  const orgId = getOrgOrThrow();
  const [entradasRes, consumoRes] = await Promise.all([
    supabase.from("estoque_entradas").select("produto_nome, quantidade, valor_unitario, valor_total").eq("org_id", orgId),
    supabase.from("estoque_consumo").select("produto_nome, quantidade").eq("org_id", orgId)
  ]);
  if (entradasRes.error) throw entradasRes.error;
  if (consumoRes.error) throw consumoRes.error;

  const entradas = entradasRes.data ?? [];
  const consumos = consumoRes.data ?? [];

  const byProduto = {};
  for (const e of entradas) {
    const nome = (e.produto_nome || "").trim();
    if (!nome) continue;
    if (!byProduto[nome]) {
      byProduto[nome] = { produto_nome: nome, entrada_qty: 0, entrada_total: 0, consumo_qty: 0 };
    }
    byProduto[nome].entrada_qty += Number(e.quantidade) || 0;
    byProduto[nome].entrada_total += Number(e.valor_total) || Number(e.valor_unitario) * Number(e.quantidade) || 0;
  }
  for (const c of consumos) {
    const nome = (c.produto_nome || "").trim();
    if (!nome) continue;
    if (!byProduto[nome]) byProduto[nome] = { produto_nome: nome, entrada_qty: 0, entrada_total: 0, consumo_qty: 0 };
    byProduto[nome].consumo_qty += Number(c.quantidade) || 0;
  }

  return Object.values(byProduto).map((p) => ({
    ...p,
    saldo_estimado: Math.max(0, p.entrada_qty - p.consumo_qty),
    custo_medio: p.entrada_qty > 0 ? p.entrada_total / p.entrada_qty : null
  }));
}

/** Registra consumo estimado (quando procedimento ocorre ou registro de protocolo com produtos). */
export async function registrarConsumoEstimado(payload) {
  const orgId = getOrgOrThrow();
  const { data: { user } } = await supabase.auth.getUser();
  const { produto_nome, quantidade, procedure_id, agenda_id, protocolo_aplicado_id, tipo = "estimado" } = payload;

  if (!(produto_nome && produto_nome.trim())) throw new Error("Informe o produto.");
  const qty = Number(quantidade);
  if (isNaN(qty) || qty < 0) throw new Error("Quantidade inválida.");

  const tipoVal = tipo === "ajuste" ? "ajuste" : tipo === "real" ? "real" : "estimado";
  const insertPayload = {
    org_id: orgId,
    produto_nome: (produto_nome || "").trim(),
    quantidade: qty,
    procedure_id: procedure_id || null,
    agenda_id: agenda_id || null,
    tipo: tipoVal,
    created_by: user?.id ?? null
  };
  if (protocolo_aplicado_id) insertPayload.protocolo_aplicado_id = protocolo_aplicado_id;

  const { data, error } = await supabase
    .from("estoque_consumo")
    .insert(insertPayload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Registra consumo real (para indicador de acurácia: previsto vs real).
 * A clínica informa o que foi realmente usado no período (ex.: após contagem).
 */
export async function registrarConsumoReal(payload) {
  return registrarConsumoEstimado({ ...payload, tipo: "real" });
}

const META_ACURACIA_PCT = 85;

/**
 * Indicador de acurácia: consumo previsto (protocolo/estimado) vs consumo real no período.
 * @param {number} periodoDias - Últimos N dias (default 30)
 * @returns {{ totalPrevisto, totalReal, acuraciaPct, metaPct, porProduto }}
 */
export async function getAcuraciaEstoque(periodoDias = 30) {
  const orgId = getOrgOrThrow();
  const desde = new Date();
  desde.setDate(desde.getDate() - Math.max(1, periodoDias));

  const { data, error } = await supabase
    .from("estoque_consumo")
    .select("produto_nome, quantidade, tipo")
    .eq("org_id", orgId)
    .gte("created_at", desde.toISOString());

  if (error) throw error;
  const rows = data ?? [];

  const byProduto = {};
  for (const r of rows) {
    const nome = (r.produto_nome || "").trim();
    if (!nome) continue;
    if (!byProduto[nome]) byProduto[nome] = { produto_nome: nome, previsto: 0, real: 0 };
    const qty = Number(r.quantidade) || 0;
    if (r.tipo === "estimado") byProduto[nome].previsto += qty;
    else if (r.tipo === "real") byProduto[nome].real += qty;
  }

  let totalPrevisto = 0;
  let totalReal = 0;
  const porProduto = Object.values(byProduto).map((p) => {
    totalPrevisto += p.previsto;
    totalReal += p.real;
    const acuraciaPct =
      p.previsto > 0 ? Math.min(100, (p.real / p.previsto) * 100) : (p.real > 0 ? 100 : null);
    return { ...p, acuraciaPct };
  });

  const acuraciaPct =
    totalPrevisto > 0 ? Math.min(100, (totalReal / totalPrevisto) * 100) : null;

  return {
    totalPrevisto,
    totalReal,
    acuraciaPct,
    metaPct: META_ACURACIA_PCT,
    porProduto: porProduto.filter((p) => p.previsto > 0 || p.real > 0)
  };
}

/**
 * Verifica se a nova entrada aumentou demais o custo médio do produto
 * e, se sim, registra alerta em auditoria + cria afazer para compras.
 */
async function checkMargemPosEntrada(orgId, entrada) {
  const nome = (entrada.produto_nome || "").trim();
  if (!nome) return;

  // Busca últimas 5 entradas deste produto (incluindo a atual)
  const { data, error } = await supabase
    .from("estoque_entradas")
    .select("id, valor_unitario, valor_total, quantidade, data_entrada")
    .eq("org_id", orgId)
    .eq("produto_nome", nome)
    .order("data_entrada", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length < 2) return; // precisa ter histórico

  const newest = rows[0];
  const anteriores = rows.slice(1);
  const custoNovo = getUnitCost(newest);
  const custosAntigos = anteriores.map(getUnitCost).filter((v) => v > 0);
  if (!(custoNovo > 0) || custosAntigos.length === 0) return;

  const mediaAntiga = custosAntigos.reduce((s, v) => s + v, 0) / custosAntigos.length;
  if (!(mediaAntiga > 0)) return;

  const variacao = ((custoNovo - mediaAntiga) / mediaAntiga) * 100;
  const LIMIAR_ALERTA = 15; // % de aumento para alertar
  if (variacao < LIMIAR_ALERTA) return;

  // Auditoria de aumento de custo
  await audit({
    action: "estoque.custo_aumentou",
    tableName: "estoque_entradas",
    recordId: newest.id,
    permissionUsed: "estoque:manage",
    metadata: {
      produto_nome: nome,
      custo_medio_anterior: mediaAntiga,
      custo_novo: custoNovo,
      variacao_percentual: variacao,
    },
  });

  // Afazer para conferência / compras
  const prazo = newest.data_entrada || new Date().toISOString().slice(0, 10);
  await createAfazer({
    responsavelUserId: null,
    titulo: `Rever custo de ${nome}`,
    descricao: `O custo médio subiu aproximadamente ${variacao.toFixed(
      1
    )}%. Avaliar fornecedor, alternativa ou ajuste de precificação.`,
    prazo,
    tipo: TIPOS_AFAZERES.conferencia_estoque ? "conferencia_estoque" : "geral",
  });
}

function getUnitCost(row) {
  const unit = Number(row.valor_unitario ?? 0);
  if (unit > 0) return unit;
  const total = Number(row.valor_total ?? 0);
  const qty = Number(row.quantidade ?? 0);
  if (total > 0 && qty > 0) return total / qty;
  return 0;
}

/**
 * Produtos com data de validade nos próximos N dias (para alertas e campanhas).
 * @param {number} dias - ex.: 60
 * @returns {Promise<Array<{ produto_nome: string, data_validade: string, quantidade: number, lote: string | null, id: string }>>}
 */
export async function getProdutosProximosVencer(dias = 60) {
  const orgId = getActiveOrg();
  if (!orgId) return [];
  const hoje = new Date().toISOString().slice(0, 10);
  const fim = new Date();
  fim.setDate(fim.getDate() + Number(dias));
  const fimStr = fim.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("estoque_entradas")
    .select("id, produto_nome, data_validade, quantidade, lote")
    .eq("org_id", orgId)
    .not("data_validade", "is", null)
    .gte("data_validade", hoje)
    .lte("data_validade", fimStr)
    .order("data_validade", { ascending: true });

  if (error) return [];
  return (data ?? []).map((r) => ({
    id: r.id,
    produto_nome: r.produto_nome || "",
    data_validade: r.data_validade,
    quantidade: Number(r.quantidade) || 0,
    lote: r.lote || null,
  }));
}

/**
 * Custo real calculado do procedimento: soma (quantity_used × custo_medio) por item.
 * Usa procedure_stock_usage e custo_medio do resumo de estoque (getResumoPorProduto).
 * @param {string} procedureId
 * @returns {Promise<{ custoReal: number, itens: Array<{ item_ref: string, quantity_used: number, custo_unitario: number | null, subtotal: number }> }>}
 */
export async function getCustoRealProcedimento(procedureId) {
  const { getProcedureStockUsage } = await import("./procedimentos.service.js");
  const usage = await getProcedureStockUsage(procedureId);
  if (usage.length === 0) return { custoReal: 0, itens: [] };

  const resumo = await getResumoPorProduto();
  const custoPorNome = {};
  for (const r of resumo) {
    const nome = (r.produto_nome || "").trim();
    if (nome) custoPorNome[nome.toLowerCase()] = r.custo_medio != null ? Number(r.custo_medio) : null;
  }

  let custoReal = 0;
  const itens = usage.map((u) => {
    const key = u.item_ref.toLowerCase();
    let custo_unitario = custoPorNome[key] ?? null;
    if (custo_unitario == null) {
      const partial = Object.keys(custoPorNome).find((k) => k.includes(key) || key.includes(k));
      if (partial) custo_unitario = custoPorNome[partial];
    }
    const subtotal = (custo_unitario != null ? custo_unitario : 0) * u.quantity_used;
    custoReal += subtotal;
    return { item_ref: u.item_ref, quantity_used: u.quantity_used, custo_unitario, subtotal };
  });

  return { custoReal, itens };
}

/**
 * Procedimentos que usam determinado produto (procedure_stock_usage.item_ref).
 * Útil para campanhas: "produto X vence em 30 dias → promova procedimentos que usam X".
 * @param {string} produtoNome - nome do produto (match por item_ref ilike)
 * @returns {Promise<Array<{ procedure_id: string, procedure_name: string }>>}
 */
export async function getProcedimentosQueUsamProduto(produtoNome) {
  if (!(produtoNome && String(produtoNome).trim())) return [];
  const { data: usages, error: errU } = await withOrg(
    supabase
      .from("procedure_stock_usage")
      .select("procedure_id, item_ref")
      .ilike("item_ref", "%" + String(produtoNome).trim() + "%")
  );
  if (errU || !usages?.length) return [];
  const procedureIds = [...new Set(usages.map((u) => u.procedure_id).filter(Boolean))];
  if (procedureIds.length === 0) return [];
  const { data: procedures, error: errP } = await withOrg(
    supabase.from("procedures").select("id, name").in("id", procedureIds)
  );
  if (errP) return [];
  const byId = (procedures ?? []).reduce((acc, p) => {
    acc[p.id] = p.name || "—";
    return acc;
  }, {});
  return procedureIds.map((id) => ({ procedure_id: id, procedure_name: byId[id] || "—" }));
}
