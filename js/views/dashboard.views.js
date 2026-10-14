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
import { listAppointmentsByDate, markAgendaArrival } from "../services/appointments.service.js"
import { salaEsperaStatus } from "../utils/sala-espera.js"
import { listProcedures } from "../services/procedimentos.service.js"
import { resumoAluguelNaAgenda, textoAluguelNaAgenda } from "../utils/aluguel-dia.js"
import { getEntradasHojeComAgenda } from "../services/financeiro.service.js"
import { getCockpitSnapshot, getCockpitMesSnapshot } from "../services/cockpit.service.js"
import { textoContextoReuniao } from "../utils/reuniao-hoje.js"
import { chaveSessaoFecharDia, payloadAuditoriaFecharDia } from "../utils/fechar-dia.js"
import { audit } from "../services/audit.service.js"
import { toast } from "../ui/toast.js"
import { getSetupProgress } from "../services/setup-progress.service.js"
import { proximoPassoSetup } from "../utils/golden-flow.js"
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
let lastFecharDia = null

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

  const [canSeeClientes, canSeeAgendaTotal, canSeeMeusAtendimentos, canSeeSaldo] = await Promise.all([
    checkPermission("clientes:view"),
    checkPermission("agenda:manage"),
    checkPermission("agenda:view"),
    checkPermission("financeiro:view"),
  ]);

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
    await renderCockpit()
  } catch (e) {
    console.warn("[DASHBOARD] Cockpit:", e)
  }
  try {
    await renderSetupProgress()
  } catch (e) {
    console.warn("[DASHBOARD] Setup:", e)
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

  document.querySelectorAll("[data-cockpit-tab]").forEach((btn) => {
    btn.addEventListener("click", () => setCockpitTab(btn.dataset.cockpitTab))
  })

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
          const { key, label } = statusFromRow(a)
          const espera = salaEsperaStatus(a)
          const esperaCls = espera && espera.minutes >= 20 ? " dashboard-sala-espera-item--longa" : ""
          const dataItem = String(a.data || hoje).slice(0, 10)
          return `<button type="button" class="dashboard-agenda-hoje-item${esperaCls}" data-agenda-id="${escapeHtml(a.id)}" data-agenda-data="${escapeHtml(dataItem)}" title="Abrir na Agenda">
            <span class="dashboard-agenda-hoje-hora">${hora(a)}</span>
            <span class="dashboard-agenda-hoje-nome">${escapeHtml(nome)}</span>
            <span class="dashboard-agenda-hoje-proc">${escapeHtml(proc)}${retornoBadge}${modeloBadge}</span>
            <span class="cockpit-status cockpit-status--${key}">${escapeHtml(label)}</span>
          </button>`
        })
        .join("")
      listEl.querySelectorAll("[data-agenda-id]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.agendaId
          const data = btn.dataset.agendaData
          if (data) sessionStorage.setItem("agendaDefaultDate", data)
          if (id) sessionStorage.setItem("agendaOpenSlotId", id)
          navigate("agenda")
        })
      })
    }

    if (previstoEl) {
      const aluguelRows = resumoAluguelNaAgenda(appointments, procedures)
      const aluguelTxt = textoAluguelNaAgenda(aluguelRows)
      const previstoTxt = previstoTotal > 0
        ? `<p class="dashboard-agenda-hoje-previsto-texto">Faturamento previsto hoje: <strong>R$ ${previstoTotal.toFixed(2).replace(".", ",")}</strong> (${itens.length} atendimento(s) com valor)</p>`
        : `<p class="dashboard-agenda-hoje-previsto-texto">Nenhum valor cadastrado nos procedimentos de hoje, ou só eventos. Cadastre valor nos <a href="#" data-view="procedimento">Procedimentos</a> para ver o previsto.</p>`
      previstoEl.innerHTML = previstoTxt + (aluguelTxt ? `<p class="dashboard-agenda-hoje-aluguel">${escapeHtml(aluguelTxt)}</p>` : "")
    }

    await renderSalaEsperaHoje(appointments)

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

async function renderSalaEsperaHoje(appointments) {
  const listEl = document.getElementById("dashboardSalaEsperaList")
  if (!listEl) return
  const canManage = await checkPermission("agenda:manage")
  const rows = (appointments || []).filter((a) => a.item_type !== "event")
  if (!rows.length) {
    listEl.innerHTML = "<p class=\"dashboard-sala-espera-empty\">Ninguém na grade de hoje.</p>"
    return
  }
  const cliente = (a) => a.clients || a.clientes || {}
  const hora = (a) => {
    const s = String(a.hora || "")
    return /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : "—"
  }
  listEl.innerHTML = rows.map((a) => {
    const nome = cliente(a).name || cliente(a).nome || "—"
    const st = salaEsperaStatus(a)
    const label = st ? st.label : "Não chegou"
    const longa = st && st.minutes >= 20 ? " dashboard-sala-espera-row--longa" : ""
    const btns = canManage
      ? `<button type="button" class="btn-secondary btn-sm sala-espera-btn" data-id="${escapeHtml(a.id)}" data-phase="chegou">Chegou</button>
         <button type="button" class="btn-secondary btn-sm sala-espera-btn" data-id="${escapeHtml(a.id)}" data-phase="em_atendimento">Em atendimento</button>
         ${(a.arrived_at || a.started_at) ? `<button type="button" class="btn-secondary btn-sm sala-espera-btn" data-id="${escapeHtml(a.id)}" data-phase="limpar">Limpar</button>` : ""}`
      : ""
    return `<div class="dashboard-sala-espera-row${longa}">
      <span class="dashboard-sala-espera-hora">${hora(a)}</span>
      <span class="dashboard-sala-espera-nome">${escapeHtml(nome)}</span>
      <span class="dashboard-sala-espera-status">${escapeHtml(label)}</span>
      <span class="dashboard-sala-espera-acoes">${btns}</span>
    </div>`
  }).join("")

  listEl.querySelectorAll(".sala-espera-btn").forEach((btn) => {
    btn.onclick = async () => {
      try {
        await markAgendaArrival(btn.dataset.id, btn.dataset.phase)
        await loadAndRender()
      } catch (err) {
        const msg = String(err?.message || err)
        if (/arrived_at|started_at|schema cache|column/i.test(msg)) {
          listEl.insertAdjacentHTML("afterbegin", "<p class=\"view-hint\">Cole o SQL <code>supabase-sala-espera-colar.sql</code> no Supabase para ativar a sala de espera.</p>")
          return
        }
        console.warn("[SALA ESPERA]", err)
      }
    }
  })
}

function statusFromRow(a) {
  const st = String(a.status || "").toLowerCase()
  if (a.item_type === "event") return { key: "evento", label: "Evento" }
  if (st === "released" || a.baixa_em) return { key: "feito", label: "Baixa" }
  const espera = salaEsperaStatus(a)
  if (espera) return { key: espera.key === "atendimento" ? "ok" : "espera", label: espera.label }
  if (st === "confirmed" || a.confirmed_at) return { key: "ok", label: "Confirmado" }
  const s = String(a.hora || "")
  const h = /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : ""
  const now = new Date()
  const nowH = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
  if (h && h < nowH) return { key: "atraso", label: "Atraso" }
  return { key: "espera", label: "Aguarda" }
}

async function renderCockpit() {
  const kpisEl = document.getElementById("cockpitKpis")
  const atencaoEl = document.getElementById("cockpitAtencaoList")
  const oportEl = document.getElementById("cockpitOportunidadesList")
  if (!kpisEl && !atencaoEl) return

  const snap = await getCockpitSnapshot()
  const k = snap.kpis
  if (kpisEl) {
    kpisEl.innerHTML = `
      <div class="cockpit-kpi"><b>${k.hojeCount}</b><span>hoje</span></div>
      <div class="cockpit-kpi"><b>${k.confirmados}</b><span>confirmados</span></div>
      <div class="cockpit-kpi"><b>${k.atrasos}</b><span>atrasos</span></div>
      <div class="cockpit-kpi"><b>R$ ${Number(k.previsto || 0).toFixed(2).replace(".", ",")}</b><span>previsto</span></div>
      <div class="cockpit-kpi"><b>R$ ${Number(k.recebido || 0).toFixed(2).replace(".", ",")}</b><span>recebido</span></div>`
  }

  renderReuniaoHoje(snap.reuniao)
  renderFecharDia(snap.fecharDia, snap.lembretesAmanha || [])

  const mudEl = document.getElementById("cockpitMudancaOntem")
  if (mudEl) {
    const linhas = snap.mudancaOntem || []
    mudEl.innerHTML = linhas.length
      ? `<h3 class="cockpit-mudanca-title">O que mudou vs ontem</h3><ul class="cockpit-mudanca-list">${linhas.map((l) => `<li class="cockpit-mudanca-item cockpit-mudanca-item--${escapeHtml(l.direcao)}">${escapeHtml(l.texto)}</li>`).join("")}</ul>`
      : ""
  }

  const execEl = document.getElementById("cockpitExecutive")
  if (execEl) {
    const cards = snap.executive?.cards || []
    execEl.innerHTML = cards.length
      ? `<h3 class="cockpit-executive-title">Por que mudou</h3><div class="cockpit-executive-list">${cards.map((c) => `<article class="cockpit-executive-card cockpit-executive-card--${escapeHtml(c.direcao)}"><strong>${escapeHtml(c.titulo)}</strong><span class="cockpit-row-causa">Causa: ${escapeHtml(c.causa)}</span><span class="cockpit-row-impacto">Impacto: ${escapeHtml(c.impacto)}</span><span class="cockpit-row-fonte">Fonte: ${escapeHtml(c.fonte)}</span></article>`).join("")}</div>`
      : ""
  }

  if (atencaoEl) {
    const rows = (snap.atencao || []).map((card) => insightRow(card));
    atencaoEl.innerHTML = rows.length
      ? rows.join("")
      : `<p class="cockpit-empty">Nada urgente. Bom sinal.</p>`
  }

  if (oportEl) {
    const rows = (snap.oportunidades || []).map((card) => insightRow(card));
    oportEl.innerHTML = rows.length
      ? rows.join("")
      : `<p class="cockpit-empty">Sem lista de espera nem radar de retorno agora. Horários vagos estão na <a href="#" data-view="agenda">Agenda</a>.</p>`
  }
}

function cardReuniao(tipo, item) {
  if (!item) {
    return `<article class="cockpit-reuniao-card cockpit-reuniao-card--${tipo}"><span class="cockpit-reuniao-kicker">${tipo}</span><strong>Não informado</strong><span class="cockpit-reuniao-fonte">Sem número com fonte neste elo.</span></article>`
  }
  return `<button type="button" class="cockpit-reuniao-card cockpit-reuniao-card--${tipo}" data-view="${escapeHtml(item.view || "dashboard")}">
    <span class="cockpit-reuniao-kicker">${tipo}</span>
    <strong>${escapeHtml(item.titulo)}</strong>
    <span>${escapeHtml(item.texto)}</span>
    <span class="cockpit-reuniao-fonte">Fonte: ${escapeHtml(item.fonte || "—")}</span>
  </button>`
}

function renderReuniaoHoje(reuniao) {
  const el = document.getElementById("cockpitReuniao")
  if (!el) return
  const r = reuniao || {}
  el.innerHTML = `
    <h3 class="cockpit-reuniao-title">${escapeHtml(r.titulo || "Reunião de hoje")}</h3>
    <p class="cockpit-reuniao-lead">${escapeHtml(r.lead || "")}</p>
    <div class="cockpit-reuniao-grid">
      ${cardReuniao("forte", r.forte)}
      ${cardReuniao("fraco", r.fraco)}
      ${cardReuniao("gargalo", r.gargalo)}
    </div>
    <div class="cockpit-reuniao-acoes">
      <button type="button" class="btn-primary btn-sm" data-view="${escapeHtml(r.proximo?.view || "agenda")}">${escapeHtml(r.proximo?.acao || "Abrir a agenda")}</button>
      <button type="button" class="btn-secondary btn-sm" id="btnReuniaoExplicar">Pedir ao assistente para explicar</button>
    </div>`
  document.getElementById("btnReuniaoExplicar")?.addEventListener("click", async (e) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      if (typeof window.__scOpenCopilot === "function") {
        window.__scOpenCopilot({
          origem: "reuniao",
          titulo: r.titulo || "Reunião de hoje",
          mensagem: textoContextoReuniao(r),
        })
        return
      }
      const { initCopilotPanel, openCopilotPanel } = await import("./notificacoes.views.js")
      initCopilotPanel()
      openCopilotPanel({
        origem: "reuniao",
        titulo: r.titulo || "Reunião de hoje",
        mensagem: textoContextoReuniao(r),
      })
    } catch (err) {
      console.warn("[REUNIAO] assistente", err)
    }
  })
}

function fmtLinhaValor(linha) {
  if (linha?.fmt === "brl") return `R$ ${Number(linha.valor || 0).toFixed(2).replace(".", ",")}`
  return String(linha?.valor ?? "—")
}

function renderFecharDia(resumo, lembretes = []) {
  const el = document.getElementById("cockpitFecharDia")
  if (!el) return
  lastFecharDia = resumo || null
  const r = resumo || {}
  const ja = typeof sessionStorage !== "undefined" && r.data && sessionStorage.getItem(chaveSessaoFecharDia(r.data))
  const linhas = (r.linhas || [])
    .map(
      (l) =>
        `<li><span>${escapeHtml(l.label)}</span><strong>${escapeHtml(fmtLinhaValor(l))}</strong><span class="cockpit-fechar-dia-fonte">Fonte: ${escapeHtml(l.fonte || "—")}</span></li>`
    )
    .join("")
  const nomes = (lembretes || [])
    .slice(0, 5)
    .map((x) => `<li>${escapeHtml(x.hora || "")} · ${escapeHtml(x.nome || "—")}</li>`)
    .join("")
  const nLembrete = (lembretes || []).length
  const extra = nLembrete > 5 ? `<li>+${nLembrete - 5} na agenda</li>` : ""
  const confirmarHtml = r.status === "vazio"
    ? ""
    : ja
      ? `<p class="cockpit-fechar-dia-lead">Conferência já registrada nesta sessão. Não criou lançamento.</p>`
      : `<button type="button" class="btn-primary btn-sm" id="btnFecharDia">Confirmar fechamento do dia</button>`
  el.classList.toggle("cockpit-fechar-dia--ok", r.status === "ok")
  el.classList.toggle("cockpit-fechar-dia--aberto", r.status === "aberto")
  el.innerHTML = `
    <h3 class="cockpit-fechar-dia-title">Fechar o dia</h3>
    <p class="cockpit-fechar-dia-lead">${escapeHtml(r.lead || "")}</p>
    <ul class="cockpit-fechar-dia-linhas">${linhas}</ul>
    <div class="cockpit-fechar-dia-acoes">
      ${confirmarHtml}
      <button type="button" class="btn-secondary btn-sm" data-view="financeiro" data-financeiro-tab="fechamento">Gaveta no Financeiro</button>
    </div>
    <div class="cockpit-lembretes">
      <h4 class="cockpit-lembretes-title">Lembrete de amanhã (${nLembrete})</h4>
      <p class="cockpit-fechar-dia-lead">WhatsApp só no clique, um a um, na Agenda. O lote da madrugada não dispara mensagem.</p>
      ${nLembrete ? `<ul class="cockpit-lembretes-list">${nomes}${extra}</ul>` : `<p class="cockpit-fechar-dia-lead">Nenhum horário de amanhã pendente de lembrete.</p>`}
      <div class="cockpit-fechar-dia-acoes">
        <button type="button" class="btn-secondary btn-sm" data-view="agenda">Abrir agenda de amanhã</button>
      </div>
    </div>`
  document.getElementById("btnFecharDia")?.addEventListener("click", async (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!lastFecharDia) return
    const [canFin, canAgenda] = await Promise.all([
      checkPermission("financeiro:manage"),
      checkPermission("agenda:manage"),
    ])
    if (!canFin && !canAgenda) {
      toast("Sem permissão para confirmar o fechamento.", "error")
      return
    }
    const permissionUsed = canFin ? "financeiro:manage" : "agenda:manage"
    try {
      await audit({
        action: "operacao.fechar_dia",
        tableName: "agenda",
        permissionUsed,
        metadata: payloadAuditoriaFecharDia(lastFecharDia),
      })
      if (typeof sessionStorage !== "undefined" && lastFecharDia.data) {
        sessionStorage.setItem(chaveSessaoFecharDia(lastFecharDia.data), "1")
      }
      toast("Fechamento conferido na auditoria. Nenhum lançamento extra foi criado.", "success")
      renderFecharDia(lastFecharDia, lembretes)
    } catch (err) {
      console.warn("[FECHAR-DIA]", err)
      toast(err?.message || "Não foi possível registrar o fechamento.", "error")
    }
  })
}

function insightRow(card) {
  const view = escapeHtml(card.view || "dashboard")
  const crmSection = card.theme === "radar" ? "radar" : card.theme === "espera" ? "espera" : ""
  const crmAttr = crmSection ? ` data-crm-section="${crmSection}"` : ""
  const title = escapeHtml(card.title || "Atenção")
  const causa = escapeHtml(card.causa || "")
  const impacto = escapeHtml(card.impacto || "")
  const fonte = escapeHtml(card.fonte || "")
  const reason = escapeHtml(card.reason || "")
  const action = escapeHtml(card.action || "")
  const corpo = causa
    ? `${causa ? `<span class="cockpit-row-causa">Causa: ${causa}</span>` : ""}${impacto ? `<span class="cockpit-row-impacto">Impacto: ${impacto}</span>` : ""}${fonte ? `<span class="cockpit-row-fonte">Fonte: ${fonte}</span>` : ""}`
    : (reason ? `<span class="cockpit-row-reason">${reason}</span>` : "")
  return `<button type="button" class="cockpit-row cockpit-row--insight" data-view="${view}"${crmAttr}><span class="cockpit-row-text"><strong>${title}</strong>${corpo}${action ? `<span class="cockpit-row-action">${action}</span>` : ""}</span></button>`
}

async function renderCockpitMes() {
  const kpisEl = document.getElementById("cockpitMesKpis")
  const rankEl = document.getElementById("cockpitMesRanking")
  const hintEl = document.getElementById("cockpitMesHint")
  const metasEl = document.getElementById("cockpitMesMetas")
  const lucroEl = document.getElementById("cockpitMesLucroHora")
  if (!kpisEl) return
  const snap = await getCockpitMesSnapshot()
  const k = snap.kpis
  kpisEl.innerHTML = `
    <div class="cockpit-kpi"><b>${k.sessoes}</b><span>sessões no mês</span></div>
    <div class="cockpit-kpi"><b>${k.clientes}</b><span>clientes</span></div>
    <div class="cockpit-kpi"><b>R$ ${Number(k.faturamento || 0).toFixed(2).replace(".", ",")}</b><span>entradas no mês</span></div>`
  if (rankEl) {
    if (!snap.ranking.length) {
      rankEl.innerHTML = `<p class="cockpit-empty">Ainda sem procedimentos com baixa neste mês. Use a Agenda e dê baixa no Financeiro.</p>`
    } else {
      rankEl.innerHTML = snap.ranking
        .map((p) => `<div class="cockpit-row" data-view="procedimento"><span>${escapeHtml(p.procedure_name)}</span><span class="muted">${p.total} · R$ ${Number(p.receita || 0).toFixed(2).replace(".", ",")}</span></div>`)
        .join("")
    }
  }
  if (hintEl) {
    const risco = snap.produtosRisco.length
    hintEl.innerHTML = risco
      ? `${risco} produto(s) com aumento de custo recente. Revise em <a href="#" data-view="procedimento">Procedimentos</a>. O sistema não altera preço.`
      : "Sem alerta de margem em risco neste recorte."
  }
  if (lucroEl) {
    lucroEl.textContent = snap.lucroHora?.copy || "Lucro/hora não informado."
  }
  if (metasEl) {
    const rows = snap.metasMes || []
    if (!rows.length) {
      metasEl.innerHTML = `<p class="cockpit-empty">Sem meta de receita/lucro neste mês. Master cadastra em Financeiro → Reserva e metas. Projeção, não garantia.</p>`
    } else {
      metasEl.innerHTML = rows
        .map((m) => {
          const label = m.tipo === "lucro_mensal" ? "Lucro" : "Receita"
          const copy = escapeHtml(m.ritmo?.copy || "")
          const cls = m.ritmo?.onTrack === false ? "cockpit-row cockpit-row--insight meta-offtrack" : "cockpit-row cockpit-row--insight"
          return `<button type="button" class="${cls}" data-view="financeiro"><span class="cockpit-row-text"><strong>${label}</strong><span class="cockpit-row-reason">${copy}</span></span></button>`
        })
        .join("")
    }
  }
}

function setCockpitTab(tab) {
  const hoje = document.getElementById("cockpitPaneHoje")
  const mes = document.getElementById("cockpitPaneMes")
  document.querySelectorAll("[data-cockpit-tab]").forEach((btn) => {
    const on = btn.dataset.cockpitTab === tab
    btn.classList.toggle("is-active", on)
    btn.setAttribute("aria-selected", on ? "true" : "false")
  })
  if (hoje) {
    hoje.classList.toggle("hidden", tab !== "hoje")
    hoje.hidden = tab !== "hoje"
  }
  if (mes) {
    mes.classList.toggle("hidden", tab !== "mes")
    mes.hidden = tab !== "mes"
  }
  const titleEl = document.getElementById("headerViewTitle")
  if (titleEl) titleEl.textContent = tab === "mes" ? "Mês" : "Hoje"
  if (tab === "mes") renderCockpitMes().catch((e) => console.warn("[DASHBOARD] Mês:", e))
}

function escapeHtml(s) {
  if (!s) return ""
  const div = document.createElement("div")
  div.textContent = s
  return div.innerHTML
}

async function renderSetupProgress() {
  const el = document.getElementById("setupProgressBar")
  if (!el) return
  const p = await getSetupProgress()
  const faltaAha = p.pct >= 100 && !p.aha
  if (p.pct >= 100 && p.aha) {
    el.classList.add("hidden")
    el.hidden = true
    el.innerHTML = ""
    return
  }
  el.hidden = false
  el.classList.remove("hidden")
  const itens = p.steps
    .map((s) => {
      const mark = s.ok ? "✓" : "○"
      const cls = s.ok ? "setup-progress-ok" : "setup-progress-pendente"
      const openPlanos = s.openPlanos ? ` data-open-planos="1"` : ""
      return `<li class="${cls}"><button type="button" class="setup-progress-link" data-view="${s.view}"${openPlanos}>${mark} ${escapeHtml(s.label)}</button></li>`
    })
    .join("")
  const minutosRestantes = p.steps.filter((s) => !s.ok).reduce((acc, s) => acc + (Number(s.minutes) || 0), 0)
  const proximo = proximoPassoSetup(p.steps)
  const ahaHtml = faltaAha
    ? `<p class="setup-progress-aha">Falta o ciclo ouro: anamnese, plano, <strong>protocolo aplicado</strong> (estoque) e um lançamento no financeiro. Atalho na <a href="#" data-view="agenda">Agenda</a>.</p>`
    : `<p class="setup-progress-import">Vem de outro app, planilha ou caderno? <a href="#" data-view="export">Traga sua lista</a> — Excel .xlsx, CSV ou colar células; mapeia colunas, vê a prévia, só então grava. WhatsApp não sai daqui.</p>`
  const tempoHtml = minutosRestantes > 0
    ? `<p class="setup-progress-pct"><strong>Primeiro dia (~${minutosRestantes} min)</strong> · ${p.pct}% (${p.done}/${p.total})</p>`
    : `<p class="setup-progress-pct"><strong>${p.pct}% configurado</strong> (${p.done}/${p.total})</p>`
  const ctaHtml = proximo
    ? `<button type="button" class="btn-primary setup-progress-cta" data-view="${escapeHtml(proximo.view)}"${proximo.openPlanos ? " data-open-planos=\"1\"" : ""}>Fazer agora: ${escapeHtml(proximo.label)}</button>`
    : ""
  el.innerHTML = `
    ${tempoHtml}
    ${ctaHtml}
    <details class="setup-progress-mais">
      <summary>Checklist (${p.done}/${p.total})</summary>
      <ul class="setup-progress-list">${itens}</ul>
    </details>
    ${ahaHtml}
  `
}
