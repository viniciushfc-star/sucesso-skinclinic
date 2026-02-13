/**
 * Importação de gastos bancários — Projeto Sucesso
 * Financeiro como consolidador: captura a realidade, não controla.
 * Transações importadas: categoria inferida pela descrição (aluguel → custo fixo, etc.).
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg } from "../core/org.js";
import { inferirCategoriaSaida } from "../utils/categoria-financeiro.js";

/**
 * Normaliza valor numérico (aceita 1.234,56 ou 1234.56).
 */
export function parseValor(str) {
  if (str == null || str === "") return null;
  const s = String(str).trim().replace(/\s/g, "");
  const br = /^-?[\d.]*,\d+$/.test(s) || /^-?\d+,\d{2}$/.test(s);
  const num = br ? s.replace(/\./g, "").replace(",", ".") : s.replace(",", ".");
  const n = parseFloat(num);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normaliza data (dd/mm/yyyy, yyyy-mm-dd, etc.).
 */
export function parseData(str) {
  if (!str || typeof str !== "string") return null;
  const s = str.trim();
  const ddmmyyyy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

/**
 * Infere tipo (entrada/saída) a partir de valor ou coluna.
 */
function inferTipo(valor, textoColuna) {
  if (valor != null && valor < 0) return "saida";
  if (valor != null && valor > 0) return "entrada";
  const t = (textoColuna || "").toLowerCase();
  if (["d", "debito", "débito", "saída", "saida", "pagamento"].some((x) => t.includes(x))) return "saida";
  if (["c", "credito", "crédito", "entrada", "recebimento"].some((x) => t.includes(x))) return "entrada";
  return "saida";
}

/**
 * Parse de CSV de extrato bancário (formatos comuns no Brasil).
 * Retorna array de { data, valor, tipo, descricao, conta_origem }.
 * Aceita: separador ; ou ,; cabeçalho opcional; valor com vírgula ou ponto.
 */
export function parseCSVExtrato(textoCSV, contaOrigem = "") {
  const lines = textoCSV.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const sep = lines[0].includes(";") ? ";" : ",";
  const firstRow = lines[0].split(sep).map((c) => c.replace(/^"|"$/g, "").trim().toLowerCase());
  const hasHeader = firstRow.some((c) =>
    ["data", "valor", "historico", "histórico", "descricao", "descrição", "tipo", "debito", "credito"].some((k) => c.includes(k))
  );

  const dataStart = hasHeader ? 1 : 0;
  const rows = lines.slice(dataStart).map((line) => {
    const parts = line.split(sep).map((p) => p.replace(/^"|"$/g, "").trim());
    return parts;
  });

  const col = (name) => {
    const i = firstRow.findIndex((h) => h.includes(name));
    return i >= 0 ? i : null;
  };

  const idxData = hasHeader ? (col("data") ?? col("date") ?? 0) : 0;
  const idxValor = hasHeader ? (col("valor") ?? col("value") ?? 1) : 1;
  const idxDesc = hasHeader ? (col("historico") ?? col("histórico") ?? col("descricao") ?? col("descrição") ?? 2) : 2;
  const idxTipo = hasHeader ? (col("tipo") ?? col("d/c") ?? col("debito") ?? col("credito") ?? -1) : -1;

  const result = [];
  for (const parts of rows) {
    const dataStr = parseData(parts[idxData] ?? "");
    const valorRaw = parts[idxValor] ?? "";
    const valorAbs = Math.abs(parseValor(valorRaw) ?? 0);
    const tipo = inferTipo(parseValor(valorRaw), idxTipo >= 0 ? parts[idxTipo] : null);
    const valor = tipo === "entrada" ? valorAbs : tipo === "saida" ? valorAbs : valorAbs;
    const descricao = (parts[idxDesc] ?? valorRaw ?? "").trim() || "Importado";
    if (dataStr && valor > 0) {
      result.push({
        data: dataStr,
        valor,
        tipo,
        descricao: descricao.slice(0, 500),
        conta_origem: contaOrigem.trim() || null,
      });
    }
  }
  return result;
}

/**
 * Insere transações importadas na tabela financeiro (org_id, user_id, importado=true).
 */
export async function inserirTransacoesImportadas(transacoes, origem = "csv") {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada");

  const rows = transacoes.map((t) => {
    const descricao = t.descricao || "Importado";
    const tipo = t.tipo === "entrada" ? "entrada" : "saida";
    const categoria_saida = tipo === "saida" ? (inferirCategoriaSaida(descricao) || null) : null;
    return {
      org_id: orgId,
      user_id: user.id,
      descricao,
      tipo,
      valor: t.valor,
      data: t.data,
      importado: true,
      origem_importacao: origem,
      conta_origem: t.conta_origem || null,
      categoria_saida,
      procedure_id: null,
    };
  });

  const { data, error } = await supabase.from("financeiro").insert(rows).select("id");
  if (error) throw error;
  return { inseridas: data?.length ?? 0, ids: data?.map((r) => r.id) ?? [] };
}

/**
 * Conta transações importadas (hoje ou sem descrição editada) para mensagem de revisão.
 * "Descrição editada" = ainda não temos esse campo; considerar todas importadas como "para revisar" se quisermos.
 * Por simplicidade: retorna quantidade de importados recentes (últimos 7 dias) sem categoria em saídas.
 */
export async function contarImportadosParaRevisao() {
  const { data, error } = await supabase
    .from("financeiro")
    .select("id, data, importado, tipo, categoria_saida")
    .eq("org_id", getActiveOrg())
    .eq("importado", true)
    .gte("data", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));

  if (error) throw error;
  const list = data ?? [];
  const hoje = new Date().toISOString().slice(0, 10);
  const deHoje = list.filter((t) => t.data === hoje);
  return { totalUltimos7: list.length, deHoje: deHoje.length, lista: list };
}
