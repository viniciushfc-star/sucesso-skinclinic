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
} from "../services/metrics.service.js"
import { checkPermission } from "../core/permissions.js"
import { getProtocolosAplicadosHoje } from "../services/protocolo-db.service.js"
// Chart.js 4: usar o global do script UMD (chart.umd.min.js) que já registra todos os componentes
const chartJsPromise = Promise.resolve(typeof window !== "undefined" && window.Chart ? window.Chart : null);

let chartFinanceiroInstance = null
let chartAgendaInstance = null

function formatTime(val) {
  if (!val) return "—"
  const d = new Date(val)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
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

  try {
    const m = await getDashboardMetricsForUser({ startDate, endDate })

    if (cardClientes) {
      if (canSeeClientes) {
        cardClientes.classList.remove("hidden")
        if (mClientes) mClientes.textContent = m.clientes
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
          mAgenda.textContent = canSeeAgendaTotal ? m.agendamentosHoje : m.meusAtendimentosHoje
        }
      } else {
        cardAgenda.classList.add("hidden")
      }
    }

    if (cardSaldo) {
      if (canSeeSaldo) {
        cardSaldo.classList.remove("hidden")
        const labelSaldo = grid?.querySelector("#statCardSaldo .stat-label")
        if (labelSaldo) labelSaldo.textContent = startDate === endDate && startDate === new Date().toISOString().split("T")[0] ? "Saldo (hoje)" : "Faturamento (período)"
        if (mSaldo) mSaldo.textContent = "R$ " + (m.faturamentoMes ?? 0).toFixed(2)
      } else {
        cardSaldo.classList.add("hidden")
      }
    }

    if (cardPrevisto && canSeeMeusAtendimentos) {
      const previsto = await getMeuPrevistoHoje()
      if (previsto != null) {
        cardPrevisto.classList.remove("hidden")
        if (mPrevisto) mPrevisto.textContent = "R$ " + (previsto.valor ?? 0).toFixed(2)
      } else {
        cardPrevisto.classList.add("hidden")
      }
    } else if (cardPrevisto) {
      cardPrevisto.classList.add("hidden")
    }

    await renderCharts(m)
    renderProtocolosDia()
  } catch (err) {
    console.error("[DASHBOARD]", err)
    if (mClientes) mClientes.textContent = "—"
    if (mAgenda) mAgenda.textContent = "—"
    if (mSaldo) mSaldo.textContent = "—"
  }
}

async function renderCharts(m) {
  const canvasFinanceiro = document.getElementById("chartFinanceiro")
  const canvasAgenda = document.getElementById("chartAgenda")
  if (chartFinanceiroInstance) {
    chartFinanceiroInstance.destroy()
    chartFinanceiroInstance = null
  }
  if (chartAgendaInstance) {
    chartAgendaInstance.destroy()
    chartAgendaInstance = null
  }
  const ChartConstructor = await chartJsPromise;
  const isConstructor = ChartConstructor && typeof ChartConstructor === "function";
  if (canvasFinanceiro && isConstructor) {
    try {
      chartFinanceiroInstance = new ChartConstructor(canvasFinanceiro, {
        type: "bar",
        data: {
          labels: ["Faturamento (período)"],
          datasets: [{ label: "R$", data: [m.faturamentoMes ?? 0], backgroundColor: "rgba(54, 162, 235, 0.5)" }],
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
      })
    } catch (e) {
      console.warn("[DASHBOARD] Chart financeiro:", e)
    }
  }
  if (canvasAgenda && isConstructor) {
    try {
      const total = m.agendamentosHoje ?? 0
      const meus = m.meusAtendimentosHoje ?? 0
      const outros = Math.max(0, total - meus)
      chartAgendaInstance = new ChartConstructor(canvasAgenda, {
        type: "doughnut",
        data: {
          labels: meus > 0 && outros > 0 ? ["Meus", "Outros"] : meus > 0 ? ["Meus"] : ["Total"],
          datasets: [{
            data: meus > 0 && outros > 0 ? [meus, outros] : [total || 0],
            backgroundColor: ["rgba(75, 192, 192, 0.6)", "rgba(200, 200, 200, 0.6)"],
          }],
        },
        options: { responsive: true, plugins: { legend: { display: true } } },
      })
    } catch (e) {
      console.warn("[DASHBOARD] Chart agenda:", e)
    }
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

  await loadAndRender()
}
