import { supabase } from "../core/supabase.js"
import { withOrg } from "../core/org.js"

/**
 * Métricas do dashboard (clientes, agendamentos hoje, faturamento mês).
 * Tabela de clientes: "clients" ou "clientes" conforme seu schema.
 */
export async function getMasterMetrics() {

 try{

  const metrics = {}

  /* CLIENTES - tenta clients (schema comum), depois clientes */
  let totalClientes = 0
  const clientesRes = await withOrg(
    supabase.from("clients").select("*", { count: "exact", head: true })
  )
  if (clientesRes?.count != null) totalClientes = clientesRes.count
  else {
   const alt = await withOrg(
    supabase.from("clientes").select("*", { count: "exact", head: true })
   )
   if (alt?.count != null) totalClientes = alt.count
  }

  /* AGENDAMENTOS HOJE */
  const hoje =
   new Date()
    .toISOString()
    .split("T")[0]

  const { count: agHoje } =
   await withOrg(
    supabase
     .from("agenda")
     .select("*", { count: "exact", head: true })
   )
   .eq("data", hoje)

  /* FATURAMENTO MÊS */
  const mes =
   new Date().toISOString().slice(0, 7)

  const { data: fat } =
   await withOrg(
    supabase
     .from("financeiro")
     .select("valor,data")
   )

  const totalMes =
   (fat || [])
    .filter(f => f.data && String(f.data).startsWith(mes))
    .reduce((s, f) => s + Number(f.valor || 0), 0)

  metrics.clientes = totalClientes
  metrics.agendamentosHoje = agHoje ?? 0
  metrics.faturamentoMes = totalMes

  return metrics
 } catch (err) {
  console.error("[METRICS]", err)
  throw err
 }
}

/**
 * Retorna startDate e endDate (YYYY-MM-DD) para o período selecionado.
 */
export function getPeriodRange(period, customStart, customEnd) {
  const today = new Date()
  const hoje = today.toISOString().split("T")[0]
  if (period === "today") return { startDate: hoje, endDate: hoje }
  if (period === "week") {
    const d = new Date(today)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const start = new Date(d)
    start.setDate(diff)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    }
  }
  if (period === "month") {
    const y = today.getFullYear()
    const m = today.getMonth()
    const start = new Date(y, m, 1)
    const end = new Date(y, m + 1, 0)
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    }
  }
  if (period === "custom" && customStart && customEnd) {
    return { startDate: customStart, endDate: customEnd }
  }
  return { startDate: hoje, endDate: hoje }
}

/**
 * Métricas do dashboard conforme o usuário logado.
 * opts: { startDate, endDate } — se não informado, usa "hoje" para agenda e mês atual para faturamento.
 * - clientes: total (não filtra por período)
 * - agenda: count no período
 * - faturamento: soma entradas no período
 */
export async function getDashboardMetricsForUser(opts = {}) {
 try {
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? null

  const startDate = opts.startDate || new Date().toISOString().split("T")[0]
  const endDate = opts.endDate || startDate

  let totalClientes = 0
  const clientesRes = await withOrg(
   supabase.from("clients").select("*", { count: "exact", head: true })
  )
  if (clientesRes?.count != null) totalClientes = clientesRes.count
  else {
   const alt = await withOrg(
    supabase.from("clientes").select("*", { count: "exact", head: true })
   )
   if (alt?.count != null) totalClientes = alt.count
  }

  const { count: agPeriod } = await withOrg(
   supabase
    .from("agenda")
    .select("*", { count: "exact", head: true })
    .gte("data", startDate)
    .lte("data", endDate)
  )

  let meusAtendimentosPeriod = 0
  if (userId) {
   const { count: meus } = await withOrg(
    supabase
     .from("agenda")
     .select("*", { count: "exact", head: true })
     .gte("data", startDate)
     .lte("data", endDate)
     .eq("user_id", userId)
   )
   meusAtendimentosPeriod = meus ?? 0
  }

  const { data: fat } = await withOrg(
   supabase.from("financeiro").select("valor,data,tipo")
  )
  const faturamentoPeriod = (fat || [])
   .filter(f => f.tipo === "entrada" && f.data && f.data >= startDate && f.data <= endDate)
   .reduce((s, f) => s + Number(f.valor || 0), 0)

  return {
   clientes: totalClientes,
   agendamentosHoje: agPeriod ?? 0,
   meusAtendimentosHoje: meusAtendimentosPeriod,
   faturamentoMes: faturamentoPeriod,
   startDate,
   endDate,
  }
 } catch (err) {
  console.error("[METRICS-DASH-USER]", err)
  throw err
 }
}

/**
 * "Meu previsto hoje": soma do valor dos procedimentos do usuário hoje × percentual.
 * Só faz sentido para quem tem percentual_procedimento no team_payment_models.
 */
export async function getMeuPrevistoHoje() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return null
    const orgId = (await import("../core/org.js")).getActiveOrg()
    if (!orgId) return null

    const { data: model, error: modelError } = await supabase
      .from("team_payment_models")
      .select("percentual_procedimento")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (modelError) return null
    const pct = model?.percentual_procedimento
    if (pct == null || pct <= 0) return null

    const hoje = new Date().toISOString().split("T")[0]
    const { data: agendaRows } = await withOrg(
    supabase
      .from("agenda")
      .select("id, procedure_id")
      .eq("data", hoje)
      .eq("user_id", user.id)
  )
  if (!agendaRows?.length) return { valor: 0, percentual: pct }

  const procedureIds = [...new Set(agendaRows.map((r) => r.procedure_id).filter(Boolean))]
  if (procedureIds.length === 0) return { valor: 0, percentual: pct }

  const { data: procedures } = await withOrg(
    supabase.from("procedures").select("id, valor_cobrado")
  )
  const valorPorId = (procedures || []).reduce((acc, p) => {
    acc[p.id] = Number(p.valor_cobrado) || 0
    return acc
  }, {})

  let soma = 0
  for (const row of agendaRows) {
    if (row.procedure_id) soma += valorPorId[row.procedure_id] || 0
  }
  const previsto = (soma * pct) / 100
  return { valor: previsto, percentual: pct }
  } catch (_) {
    return null
  }
}

export async function getClinicsComparison(){

 try{

  const { data:orgs, error } =
   await supabase
    .from("organizations")
    .select("id,name")

  if(error) throw error

  const result = []

  for(const org of (orgs || [])){

   /* CLIENTES - tenta clients, depois clientes */
   let totalClientes = 0
   let cr = await supabase.from("clients").select("*", { count: "exact", head: true }).eq("org_id", org.id)
   if (cr?.count != null) totalClientes = cr.count
   else {
    cr = await supabase.from("clientes").select("*", { count: "exact", head: true }).eq("org_id", org.id)
    if (cr?.count != null) totalClientes = cr.count
   }

   /* FATURAMENTO */
   const { data: fat } =
    await supabase
     .from("financeiro")
     .select("valor")
     .eq("org_id", org.id)

   const totalFat =
    (fat || []).reduce(
     (s,f)=>s+Number(f.valor),0
    )

   result.push({
    id:org.id,
    name:org.name,
    clientes:totalClientes,
    faturamento:totalFat
   })
  }

  return result

 }catch(err){
  console.error(
   "[METRICS-COMPARE]",
   err
  )
  throw err
 }
}

/**
 * Relatório: procedimentos realizados por período (agenda com procedure_id no intervalo).
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @param {{ professionalId?: string, procedureId?: string }} opts - Filtros opcionais: profissional (user_id) e/ou procedimento
 * @returns {Promise<Array<{ procedure_id: string, procedure_name: string, total: number }>>}
 */
export async function getProcedimentosRealizadosPorPeriodo(startDate, endDate, opts = {}) {
  let q = supabase
    .from("agenda")
    .select("id, procedure_id")
    .gte("data", startDate)
    .lte("data", endDate)
    .not("procedure_id", "is", null)
  if (opts.professionalId) q = q.eq("user_id", opts.professionalId)
  if (opts.procedureId) q = q.eq("procedure_id", opts.procedureId)
  const { data: agendaRows, error: errAgenda } = await withOrg(q)
  if (errAgenda) throw errAgenda
  const rows = agendaRows ?? []
  const byProc = {}
  for (const r of rows) {
    const id = r.procedure_id
    if (!id) continue
    byProc[id] = (byProc[id] || 0) + 1
  }
  const procedureIds = Object.keys(byProc)
  if (procedureIds.length === 0) return []
  const { data: procedures, error: errProc } = await withOrg(
    supabase.from("procedures").select("id, name").in("id", procedureIds)
  )
  if (errProc) throw errProc
  const names = (procedures ?? []).reduce((acc, p) => { acc[p.id] = p.name || "—"; return acc }, {})
  return procedureIds.map((id) => ({
    procedure_id: id,
    procedure_name: names[id] || "—",
    total: byProc[id],
  })).sort((a, b) => b.total - a.total)
}
