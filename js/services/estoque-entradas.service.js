/**
 * Estoque — entradas (OCR, manual, XML) e consumo estimado.
 * Canon: referência inteligente, não verdade absoluta; entrada facilitada.
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg } from "../core/org.js";
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

/** Registra consumo estimado (quando procedimento ocorre). */
export async function registrarConsumoEstimado(payload) {
  const orgId = getOrgOrThrow();
  const { data: { user } } = await supabase.auth.getUser();
  const { produto_nome, quantidade, procedure_id, agenda_id, tipo = "estimado" } = payload;

  if (!(produto_nome && produto_nome.trim())) throw new Error("Informe o produto.");
  const qty = Number(quantidade);
  if (isNaN(qty) || qty < 0) throw new Error("Quantidade inválida.");

  const tipoVal = tipo === "ajuste" ? "ajuste" : tipo === "real" ? "real" : "estimado";
  const { data, error } = await supabase
    .from("estoque_consumo")
    .insert({
      org_id: orgId,
      produto_nome: (produto_nome || "").trim(),
      quantidade: qty,
      procedure_id: procedure_id || null,
      agenda_id: agenda_id || null,
      tipo: tipoVal,
      created_by: user?.id ?? null
    })
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
