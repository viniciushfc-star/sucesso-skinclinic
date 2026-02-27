import { supabase } from "../core/supabase.js"
import { withOrg } from "../core/org.js"

/**
 * Lista transações da organização (para resumo, lista e "por procedimento").
 */
export async function getFinanceiro() {
  const { data, error } = await withOrg(
    supabase.from("financeiro").select("*").order("data", { ascending: false })
  )
  if (error) throw error
  return data ?? []
}

/**
 * Lista entradas de hoje que vieram da agenda (dar baixa) — para "Concluídos hoje" no dashboard.
 * @param {string} dataHoje - YYYY-MM-DD
 */
export async function getEntradasHojeComAgenda(dataHoje) {
  if (!dataHoje) return []
  const { data, error } = await withOrg(
    supabase
      .from("financeiro")
      .select("id, descricao, valor, valor_recebido, agenda_id, created_at")
      .eq("data", dataHoje)
      .eq("tipo", "entrada")
      .not("agenda_id", "is", null)
      .order("created_at", { ascending: false })
  )
  if (error) return []
  return data ?? []
}

/**
 * Lista entradas do Financeiro vinculadas a um agendamento (dar baixa).
 * Usado para saber se o agendamento já teve baixa e evitar duplicar.
 */
export async function getEntradasByAgendaId(agendaId) {
  if (!agendaId) return []
  const { data, error } = await withOrg(
    supabase
      .from("financeiro")
      .select("id, descricao, valor, valor_recebido, data, created_at")
      .eq("tipo", "entrada")
      .eq("agenda_id", agendaId)
      .order("created_at", { ascending: false })
  )
  if (error) return []
  return data ?? []
}

/**
 * Exclui um lançamento do Financeiro (entrada ou saída).
 */
export async function deleteFinanceiro(id) {
  if (!id) throw new Error("ID inválido")
  const { error } = await withOrg(
    supabase.from("financeiro").delete().eq("id", id)
  )
  if (error) throw error
}

/**
 * Valor previsto a receber com base nos agendamentos no período (ainda não dado baixa).
 * Soma valor_cobrado dos procedimentos agendados (exclui retornos; aplica desconto modelo se houver).
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Promise<{ valor: number, quantidade: number }>}
 */
export async function getPrevistoReceitaFromAgenda(startDate, endDate) {
  const { data: agendaRows, error: errAg } = await withOrg(
    supabase
      .from("agenda")
      .select("id, data, procedure_id, is_retorno, is_modelo_agendamento, desconto_modelo_pct")
      .gte("data", startDate)
      .lte("data", endDate)
  )
  if (errAg || !agendaRows?.length) return { valor: 0, quantidade: 0 }
  const procedureIds = [...new Set(agendaRows.map((r) => r.procedure_id).filter(Boolean))]
  if (procedureIds.length === 0) {
    const qtd = agendaRows.filter((r) => !r.is_retorno).length
    return { valor: 0, quantidade: qtd }
  }
  const { data: procedures, error: errProc } = await withOrg(
    supabase.from("procedures").select("id, valor_cobrado").in("id", procedureIds)
  )
  if (errProc) return { valor: 0, quantidade: 0 }
  const valorPorProc = (procedures || []).reduce((acc, p) => {
    acc[p.id] = Number(p.valor_cobrado) || 0
    return acc
  }, {})

  let valor = 0
  let quantidade = 0
  for (const row of agendaRows) {
    if (row.is_retorno) continue
    const v = row.procedure_id ? valorPorProc[row.procedure_id] : 0
    if (v <= 0) continue
    quantidade += 1
    let itemValor = v
    if (row.is_modelo_agendamento && row.desconto_modelo_pct != null) {
      itemValor = v * (1 - Number(row.desconto_modelo_pct) / 100)
    }
    valor += itemValor
  }
  return { valor, quantidade }
}

/**
 * Faturamento por profissional (entradas com agenda_id → user_id da agenda).
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Promise<Array<{ user_id: string, total: number }>>}
 */
export async function getFaturamentoPorUsuario(startDate, endDate) {
  const { data: entradas, error } = await withOrg(
    supabase
      .from("financeiro")
      .select("id, valor, valor_recebido, data, agenda_id")
      .eq("tipo", "entrada")
      .not("agenda_id", "is", null)
      .gte("data", startDate)
      .lte("data", endDate)
  )
  if (error) return []
  const agendaIds = [...new Set((entradas || []).map((e) => e.agenda_id).filter(Boolean))]
  if (agendaIds.length === 0) return []
  const { data: agendas, error: errAg } = await withOrg(
    supabase.from("agenda").select("id, user_id").in("id", agendaIds)
  )
  if (errAg || !agendas?.length) return []
  const agendaById = (agendas || []).reduce((acc, a) => { acc[a.id] = a.user_id; return acc }, {})
  const byUser = {}
  for (const e of entradas || []) {
    const uid = agendaById[e.agenda_id]
    if (!uid) continue
    const v = e.valor_recebido != null && e.valor_recebido !== "" ? Number(e.valor_recebido) : Number(e.valor) || 0
    byUser[uid] = (byUser[uid] || 0) + v
  }
  return Object.entries(byUser).map(([user_id, total]) => ({ user_id, total }))
}

/**
 * DRE simplificado por período: receitas (entradas), despesas (saídas) e resultado.
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Promise<{ receitas: number, despesas: number, resultado: number, transacoes: Array }>}
 */
export async function getDrePeriodo(startDate, endDate) {
  if (!startDate || !endDate) return { receitas: 0, despesas: 0, resultado: 0, transacoes: [] }
  const { data, error } = await withOrg(
    supabase
      .from("financeiro")
      .select("id, tipo, valor, valor_recebido, data, descricao")
      .gte("data", startDate)
      .lte("data", endDate)
      .order("data", { ascending: true })
  )
  if (error) return { receitas: 0, despesas: 0, resultado: 0, transacoes: [] }
  const transacoes = data ?? []
  let receitas = 0
  let despesas = 0
  for (const t of transacoes) {
    const v = t.tipo === "entrada"
      ? (t.valor_recebido != null && t.valor_recebido !== "" ? Number(t.valor_recebido) : Number(t.valor) || 0)
      : 0
    const s = t.tipo === "saida" ? Number(t.valor) || 0 : 0
    receitas += v
    despesas += s
  }
  return {
    receitas,
    despesas,
    resultado: receitas - despesas,
    transacoes,
  }
}
