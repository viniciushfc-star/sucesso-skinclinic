/* =========================
   DASHBOARD VIEW
   Métricas conforme permissões:
   - clientes:view → card "Clientes" (total da clínica)
   - agenda:manage → card "Agenda" no período (total da clínica)
   - agenda:view (sem manage) → card "Meus atendimentos" no período + "Meu previsto hoje" se % configurado
   - financeiro:view → card "Saldo" (faturamento no período)
   Filtro de período (Hoje/Semana/Mês/Personalizado) aplicado às métricas e gráficos.
========================= */

import {
  getDashboardMetricsForUser,
  getPeriodRange,
  getMeuPrevistoHoje,
  getTodayLocal,
  getFaturamentoPorDia,
  getRankingProcedimentosComReceita,
  getRankingProdutosPorUso,
} from "../services/metrics.service.js"
import { checkPermission } from "../core/permissions.js"
import { getProtocolosAplicadosHoje } from "../services/protocolo-db.service.js"
import { listAppointmentsByDate } from "../services/appointments.service.js"
import { listProcedures } from "../services/procedimentos.service.js"
import { getEntradasHojeComAgenda } from "../services/financeiro.service.js"
import { navigate } from "../core/spa.js"
// Chart.js 3: aguardar window.Chart (script pode carregar após o módulo)
async function waitForChart(retries = 25) {
  for (let i = 0; i < retries; i++) {
    const C = typeof window !== "undefined" ? window.Chart : null;
    if (C && typeof C === "function") return C;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}
const chartJsPromise = waitForChart();

let chartFinanceiroInstance = null
let chartAgendaInstance = null

function formatTime(val) {
  if (!val) return "—"
  const d = new Date(val)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

/** Retorna texto do período para exibir no card de faturamento (ex.: " (hoje)", " (3–9 fev)", " (fev/2026)"). */
function formatPeriodLabel(startDate, endDate) {
  if (!startDate || !endDate) return ""
  const today = getTodayLocal()
  if (startDate === endDate && startDate === today) return " (hoje)"
  const s = new Date(startDate + "T12:00:00")
  const e = new Date(endDate + "T12:00:00")
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return ""
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()
  if (sameMonth && s.getDate() === 1 && e.getDate() === new Date(s.getFullYear(), s.getMonth() + 1, 0).getDate()) {
    return " (" + s.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }) + ")"
  }
  return " (" + s.getDate() + "–" + e.getDate() + " " + s.toLocaleDateString("pt-BR", { month: "short" }) + ")"
}

function getPeriodFromUI() {
  const period = document.getElementById("filterPeriod")?.value || "today"
  const customStart = document.getElementById("startDate")?.value?.trim()
  const customEnd = document.getElementById("endDate")?.value?.trim()
  return getPeriodRange(period, customStart, customEnd)
}

function toggleCustomDates(show) {
  const start = document.getElementById("startDate")
  const end = document.getElementById("endDate")
  if (start) start.hidden = !show
  if (end) end.hidden = !show
}

async function loadAndRender() {
  const grid = document.getElementById("dashboardStatsGrid")
  const cardClientes = document.getElementById("statCardClientes")
  const cardAgenda = document.getElementById("statCardAgenda")
  const cardSaldo = document.getElementById("statCardSaldo")
  const cardPrevisto = document.getElementById("statCardPrevisto")
  const labelAgenda = document.getElementById("statLabelAgenda")
  const mClientes = document.getElementById("mClientes")
  const mAgenda = document.getElementById("mAgenda")
  const mSaldo = document.getElementById("mSaldo")
  const mPrevisto = document.getElementById("mPrevisto")

  if (!grid) return

  const canSeeClientes = await checkPermission("clientes:view")
  const canSeeAgendaTotal = await checkPermission("agenda:manage")
  const canSeeMeusAtendimentos = await checkPermission("agenda:view")
  const canSeeSaldo = await checkPermission("financeiro:view")

  const { startDate, endDate } = getPeriodFromUI()

  let m = { clientes: 0, agendamentosHoje: 0, meusAtendimentosHoje: 0, faturamentoMes: 0 }
  try {
    m = await getDashboardMetricsForUser({ startDate, endDate })
  } catch (err) {
    console.error("[DASHBOARD] Métricas:", err)
  }

  if (cardClientes) {
    if (canSeeClientes) {
      cardClientes.classList.remove("hidden")
      if (mClientes) mClientes.textContent = m.clientes ?? "—"
    } else {
      cardClientes.classList.add("hidden")
    }
  }

  if (cardAgenda) {
    if (canSeeAgendaTotal || canSeeMeusAtendimentos) {
      cardAgenda.classList.remove("hidden")
      if (labelAgenda) {
        labelAgenda.textContent = canSeeAgendaTotal ? "Agenda (período)" : "Meus atendimentos (período)"
      }
      if (mAgenda) {
        mAgenda.textContent = canSeeAgendaTotal ? (m.agendamentosHoje ?? "—") : (m.meusAtendimentosHoje ?? "—")
      }
    } else {
      cardAgenda.classList.add("hidden")
    }
  }

  if (cardSaldo) {
    if (canSeeSaldo) {
      cardSaldo.classList.remove("hidden")
      const labelSaldo = document.getElementById("statLabelSaldo")
      if (labelSaldo) labelSaldo.textContent = "Faturamento"
      if (mSaldo) mSaldo.textContent = "R$ " + (m.faturamentoMes ?? 0).toFixed(2).replace(".", ",")
      const saldoHint = document.getElementById("statSaldoHint")
      if (saldoHint) {
        const periodLabel = formatPeriodLabel(startDate, endDate)
        saldoHint.innerHTML = `Entradas no Financeiro${periodLabel}. <a href="#" data-view="financeiro" class="stat-hint-link">Ver entradas</a>`
        /* Navegação feita pelo SPA (bindMenu com delegação em data-view) */
      }
    } else {
      cardSaldo.classList.add("hidden")
    }
  }

  if (cardPrevisto && canSeeMeusAtendimentos) {
    try {
      const previsto = await getMeuPrevistoHoje()
      if (previsto != null) {
        cardPrevisto.classList.remove("hidden")
        if (mPrevisto) mPrevisto.textContent = "R$ " + (previsto.valor ?? 0).toFixed(2)
      } else {
        cardPrevisto.classList.add("hidden")
      }
    } catch (_) {
      cardPrevisto.classList.add("hidden")
    }
  } else if (cardPrevisto) {
    cardPrevisto.classList.add("hidden")
  }

  const chartWrap = document.getElementById("dashboardChartWrap")
  if (chartWrap) chartWrap.classList.toggle("hidden", !canSeeSaldo)
  let faturamentoPorDia = []
  if (canSeeSaldo) {
    try {
      faturamentoPorDia = await getFaturamentoPorDia(startDate, endDate)
    } catch (_) {}
  }
  try {
    await renderCharts(m, faturamentoPorDia)
  } catch (e) {
    console.warn("[DASHBOARD] Gráfico:", e)
  }
  try {
    await renderRankings(startDate, endDate)
  } catch (e) {
    console.warn("[DASHBOARD] Rankings:", e)
  }
  try {
    renderProtocolosDia()
  } catch (e) {
    console.warn("[DASHBOARD] Protocolos dia:", e)
  }
  try {
    await renderAgendaHoje()
  } catch (e) {
    console.warn("[DASHBOARD] Agenda hoje:", e)
  }
}

async function renderCharts(m, faturamentoPorDia = []) {
  if (chartFinanceiroInstance) {
    chartFinanceiroInstance.destroy()
    chartFinanceiroInstance = null
  }
  if (chartAgendaInstance) {
    chartAgendaInstance.destroy()
    chartAgendaInstance = null
  }
  const ChartConstructor = await chartJsPromise
  const isConstructor = ChartConstructor && typeof ChartConstructor === "function"

  const canvasLinha = document.getElementById("chartFinanceiroLinha")
  if (canvasLinha && isConstructor) {
    try {
      const labels = faturamentoPorDia.map((x) => {
        const d = new Date(x.date + "T12:00:00")
        return isNaN(d.getTime()) ? x.date : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
      })
      const valores = faturamentoPorDia.map((x) => x.valor || 0)
      chartFinanceiroInstance = new ChartConstructor(canvasLinha, {
        type: "line",
        data: {
          labels: labels.length ? labels : ["Período"],
          datasets: [{
            label: "Faturamento",
            data: valores.length ? valores : [m.faturamentoMes ?? 0],
            borderColor: "rgb(78, 84, 200)",
            backgroundColor: "rgba(78, 84, 200, 0.15)",
            fill: true,
            tension: 0.3,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: { legend: { display: true, position: "top" } },
          scales: {
            y: { beginAtZero: true, ticks: { callback: (v) => "R$ " + (v >= 1000 ? (v / 1000).toFixed(1) + "k" : v) } },
            x: { grid: { display: false } },
          },
        },
      })
    } catch (e) {
      console.warn("[DASHBOARD] Chart faturamento:", e)
    }
  }
}

async function renderRankings(startDate, endDate) {
  const listProc = document.getElementById("dashboardRankingProcedimentosList")
  const listProd = document.getElementById("dashboardRankingProdutosList")
  const cardProc = document.getElementById("dashboardRankingProcedimentos")
  const cardProd = document.getElementById("dashboardRankingProdutos")
  if (!listProc || !listProd) return

  const medals = ["🥇", "🥈", "🥉"]
  try {
    const [procedimentos, produtos] = await Promise.all([
      getRankingProcedimentosComReceita(startDate, endDate, 5),
      getRankingProdutosPorUso(startDate, endDate, 5),
    ])

    if (procedimentos.length === 0) {
      listProc.innerHTML = "<p class=\"dashboard-ranking-empty\">Nenhum procedimento no período. Use a <a href=\"#\" data-view=\"agenda\">Agenda</a> e dê baixa no <a href=\"#\" data-view=\"financeiro\">Financeiro</a> vinculando ao procedimento.</p>"
    } else {
      listProc.innerHTML = procedimentos
        .map(
          (p, i) =>
            `<div class="dashboard-ranking-item">
              <span class="dashboard-ranking-medal">${medals[i] || (i + 1) + "º"}</span>
              <span class="dashboard-ranking-name">${escapeHtml(p.procedure_name)}</span>
              <span class="dashboard-ranking-meta">${p.total} atend. · R$ ${(p.receita || 0).toFixed(2).replace(".", ",")}</span>
            </div>`
        )
        .join("")
    }

    if (produtos.length === 0) {
      listProd.innerHTML = "<p class=\"dashboard-ranking-empty\">Nenhum produto usado no período. Registre produtos nos <a href=\"#\" data-view=\"protocolo\">protocolos aplicados</a>.</p>"
    } else {
      listProd.innerHTML = produtos
        .map(
          (p, i) =>
            `<div class="dashboard-ranking-item">
              <span class="dashboard-ranking-medal">${medals[i] || (i + 1) + "º"}</span>
              <span class="dashboard-ranking-name">${escapeHtml(p.produto_nome)}</span>
              <span class="dashboard-ranking-meta">${p.quantidade} un.</span>
            </div>`
        )
        .join("")
    }

    /* Navegação dos "Ver mais" é feita pelo SPA (bindMenu com delegação em data-view) */
  } catch (e) {
    console.warn("[DASHBOARD] Rankings:", e)
    listProc.innerHTML = "<p class=\"dashboard-ranking-empty\">Erro ao carregar.</p>"
    listProd.innerHTML = "<p class=\"dashboard-ranking-empty\">Erro ao carregar.</p>"
  }
}

async function renderProtocolosDia() {
  const wrap = document.getElementById("dashboardProtocolosDia")
  const list = document.getElementById("dashboardProtocolosDiaList")
  if (!wrap || !list) return
  try {
    const items = await getProtocolosAplicadosHoje()
    if (items.length === 0) {
      list.innerHTML = "<p class=\"dashboard-protocolos-dia-empty\">Nenhum protocolo aplicado hoje.</p>"
    } else {
      list.innerHTML = items
        .map(
          (r) => `
          <div class="dashboard-protocolos-dia-item">
            <span class="dashboard-protocolos-dia-hora">${formatTime(r.aplicado_em)}</span>
            <span class="dashboard-protocolos-dia-cliente">${(r.client_name || "—").replace(/</g, "&lt;")}</span>
            <span class="dashboard-protocolos-dia-protocolo">${(r.protocolos?.nome || "—").replace(/</g, "&lt;")}</span>
          </div>`
        )
        .join("")
    }
  } catch (e) {
    console.warn("[DASHBOARD] Protocolos do dia:", e)
    list.innerHTML = "<p class=\"dashboard-protocolos-dia-empty\">Não foi possível carregar.</p>"
  }
}

export async function init() {
  const filterPeriod = document.getElementById("filterPeriod")
  const startDate = document.getElementById("startDate")
  const endDate = document.getElementById("endDate")
  const applyFilter = document.getElementById("applyFilter")

  if (filterPeriod) {
    filterPeriod.addEventListener("change", () => {
      toggleCustomDates(filterPeriod.value === "custom")
    })
  }
  if (applyFilter) {
    applyFilter.addEventListener("click", () => loadAndRender())
  }
  toggleCustomDates(filterPeriod?.value === "custom")

  /* Botão "Abrir Agenda" já tem data-view="agenda"; navegação feita pelo SPA (bindMenu) */

  await loadAndRender()
}

/** Preenche o bloco "Agendamentos de hoje" e o faturamento previsto do dia. */
async function renderAgendaHoje() {
  const listEl = document.getElementById("dashboardAgendaHojeList")
  const previstoEl = document.getElementById("dashboardAgendaHojePrevisto")
  if (!listEl) return

  try {
    const hoje = getTodayLocal()
    const [appointments, procedures] = await Promise.all([
      listAppointmentsByDate(hoje),
      listProcedures(true).catch(() => []),
    ])
    const procMap = (procedures || []).reduce((acc, p) => { acc[p.id] = p; return acc }, {})

    const isEvent = (a) => a.item_type === "event"
    const cliente = (a) => a.clients || a.clientes || {}
    const hora = (a) => {
      if (!a.hora) return "—"
      const s = String(a.hora)
      if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5)
      return s
    }

    let previstoTotal = 0
    const itens = (appointments || []).filter((a) => !isEvent(a))
    for (const a of itens) {
      if (a.is_retorno) continue
      if (a.procedure_id && procMap[a.procedure_id]?.valor_cobrado != null) {
        let v = Number(procMap[a.procedure_id].valor_cobrado)
        if (!Number.isNaN(v) && v > 0) {
          if (a.is_modelo_agendamento && a.desconto_modelo_pct != null) {
            v = v * (1 - Number(a.desconto_modelo_pct) / 100)
          }
          previstoTotal += v
        }
      }
    }

    if (appointments.length === 0) {
      listEl.innerHTML = "<p class=\"dashboard-agenda-hoje-empty\">Nenhum agendamento para hoje. Use a <a href=\"#\" data-view=\"agenda\">Agenda</a> para agendar.</p>"
    } else {
      listEl.innerHTML = appointments
        .map((a) => {
          const nome = isEvent(a) ? (a.event_title || "Evento") : (cliente(a).name || cliente(a).nome || "—")
          const proc = isEvent(a) ? (a.event_type || "") : (a.procedimento || "Agendamento")
          const retornoBadge = a.is_retorno ? ' <span class="dashboard-agenda-hoje-retorno">Retorno</span>' : ""
          const modeloBadge = a.is_modelo_agendamento ? ' <span class="dashboard-agenda-hoje-modelo">Modelo</span>' : ""
          return `<div class="dashboard-agenda-hoje-item">
            <span class="dashboard-agenda-hoje-hora">${hora(a)}</span>
            <span class="dashboard-agenda-hoje-nome">${escapeHtml(nome)}</span>
            <span class="dashboard-agenda-hoje-proc">${escapeHtml(proc)}${retornoBadge}${modeloBadge}</span>
          </div>`
        })
        .join("")
    }

    if (previstoEl) {
      previstoEl.innerHTML = previstoTotal > 0
        ? `<p class="dashboard-agenda-hoje-previsto-texto">Faturamento previsto hoje: <strong>R$ ${previstoTotal.toFixed(2).replace(".", ",")}</strong> (${itens.length} atendimento(s) com valor)</p>`
        : `<p class="dashboard-agenda-hoje-previsto-texto">Nenhum valor cadastrado nos procedimentos de hoje, ou só eventos. Cadastre valor nos <a href="#" data-view="procedimento">Procedimentos</a> para ver o previsto.</p>`
    }

    const concluidosList = document.getElementById("dashboardConcluidosHojeList")
    const concluidosWrap = document.getElementById("dashboardConcluidosHoje")
    if (concluidosList && concluidosWrap) {
      try {
        const entradas = await getEntradasHojeComAgenda(hoje)
        if (entradas.length === 0) {
          concluidosList.innerHTML = "<p class=\"dashboard-concluidos-hoje-empty\">Nenhum atendimento dado baixa hoje.</p>"
        } else {
          concluidosList.innerHTML = entradas
            .map((e) => {
              const v = e.valor_recebido != null && e.valor_recebido !== "" ? Number(e.valor_recebido) : Number(e.valor)
              return `<div class="dashboard-concluidos-hoje-item">
                <span class="dashboard-concluidos-hoje-desc">${escapeHtml(e.descricao || "Entrada")}</span>
                <span class="dashboard-concluidos-hoje-valor">R$ ${(v || 0).toFixed(2).replace(".", ",")}</span>
              </div>`
            })
            .join("")
        }
      } catch (_) {
        concluidosList.innerHTML = "<p class=\"dashboard-concluidos-hoje-empty\">Erro ao carregar.</p>"
      }
    }

    /* Links data-view (Agenda, Procedimentos) são tratados pelo SPA (bindMenu com delegação) */
  } catch (err) {
    console.warn("[DASHBOARD] Agendamentos de hoje:", err)
    listEl.innerHTML = "<p class=\"dashboard-agenda-hoje-empty\">Erro ao carregar. Tente novamente.</p>"
    if (previstoEl) previstoEl.innerHTML = ""
  }
}

function escapeHtml(s) {
  if (!s) return ""
  const div = document.createElement("div")
  div.textContent = s
  return div.innerHTML
}
