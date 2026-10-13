/* =====================
   IMPORTS
===================== */

import { openModal, closeModal, openConfirmModal }
from "../ui/modal.js"

import { supabase }
from "../core/supabase.js"

import { toast }
from "../ui/toast.js"

import { sendWhatsapp }
from "../services/whatsapp.service.js"

import { getActiveOrg, withOrg } from "../core/org.js"
import { retryUnknownColumns } from "../utils/supabase-unknown-col.js"
import { listClientesForSelect, createClient } from "../services/clientes.service.js"
import { bindPhoneMask } from "../utils/input-masks.js"

import {
 listAppointmentsByDate,
 listAppointmentsByMonth,
 listAppointmentsByRange,
 getAgendaItemById,
 getClientAgendaResumo,
 getAvailableProfessionals,
 checkProfessionalAvailable,
 checkSalaAvailable,
 checkProfessionalAvailableWithRespiro,
 getAvailableSalas,
 createExternalBlock,
 listExternalBlocksForRange,
 markAgendaArrival,
 releaseAppointment
} from "../services/appointments.service.js"

import { listSalas, listSalasQueSuportamTipo } from "../services/salas.service.js"
import { getAgendaConfig } from "../services/agenda-config.service.js"
import { getProcedure, getProcedureStockUsage, listProcedures } from "../services/procedimentos.service.js"
import { resumoAluguelNaAgenda, textoAluguelNaAgenda } from "../utils/aluguel-dia.js"
import {
  custoMedioPorNomeFromResumo,
  custoRealFromBaixaLinhas,
  labelUnidadeQtd,
  linhaBaixaFromUsage,
  quantidadeConsumoBaixa,
} from "../utils/estoque-custo.js"
import { getProfessionalIdsWhoCanDoProcedure } from "../services/professional-procedures.service.js"

import { getOrgMembers } from "../core/org.js"

import { audit } from "../services/audit.service.js"

import { listPlanosTerapeuticos } from "../services/planos-terapeuticos.service.js"
import { buildPlanoAgendaSlots, expandPlanoSessoes } from "../utils/plano-agenda.js"

import { navigate } from "../core/spa.js"
import { redirect } from "../core/base-path.js"

import { getEntradasByAgendaId, createLancamento } from "../services/financeiro.service.js"

import { listPacotesComSaldoByClient, consumirSessao } from "../services/pacotes.service.js"
import { createClientEvent } from "../services/client-events.service.js"
import { payloadCombinadoConsulta } from "../utils/consulta-combinado.js"
import { payloadSessaoProntuario } from "../utils/prontuario-sessao.js"
import { sugerirPacoteNaAgenda, valorFinanceiroNaBaixa, sugerirProximaAcaoNaBaixa } from "../utils/ciclo-ouro.js"
import { previstoVsRealizado } from "../utils/comissao-apuracao.js"
import { economiaSessaoPacote, textoEconomiaSessao } from "../utils/pacote-consumo-economia.js"
import {
  escolherCustoMaterial,
  economiaAtendimento,
  simularDescontoParcela,
  textoEconomiaAtendimento,
  textoSimulacaoBaixa,
} from "../utils/economia-atendimento.js"

import { createConfirmation } from "../services/confirmations.service.js"
import { getAniversariantes } from "../services/clientes.service.js"
import { getProtocolos, getProtocolosAplicadosByAgendaId, createProtocoloAplicado, getAlertaEstoqueProtocolo } from "../services/protocolo-db.service.js"
import { getCustoRealProcedimento, getResumoPorProduto, registrarConsumoEstimado } from "../services/estoque-entradas.service.js"
import { getTaxas, getTaxaForParcelas } from "../services/precificacao-taxas.service.js"
import { getOrganizationProfile } from "../services/organization-profile.service.js"
import { buildMessage, buildEmailLembrete } from "../services/message-templates.service.js"
import { importarLote, getTemplateHeaders } from "../services/importacao-lote.service.js"
import { listAfazeresByPrazo } from "../services/afazeres.service.js"
import { listWaitlist } from "../services/waitlist.service.js"
import { matchWaitlistToSlot } from "../utils/espera-encaixe.js"
import { proximaAcaoDoHorario } from "../utils/sala-espera.js"
import { filaWhatsappTemplate } from "../utils/crm-fila.js"
import { occupyProfessionalCalendar } from "../services/google-calendar.service.js"
import { rotuloLembrete, origemLembreteWhatsapp } from "../utils/confirmacao-tentativa.js"
import { labelOcupadoPessoal, rangesOverlap } from "../utils/agenda-ocupacao.js"

/* =====================
   ESTADO (calendário + dia selecionado)
===================== */

let selectedDate = ""
let calendarYear = 0
let calendarMonth = 0

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]

let agendaPanelEl = null

function getTodayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function ensureAgendaPanel() {
  if (agendaPanelEl) return
  const view = document.getElementById("view-agenda")
  if (!view) return
  agendaPanelEl = document.createElement("div")
  agendaPanelEl.id = "agendaSlotPanel"
  agendaPanelEl.className = "agenda-panel agenda-panel--hidden"
  agendaPanelEl.setAttribute("aria-label", "Detalhe do agendamento")
  view.appendChild(agendaPanelEl)
}

export async function init() {
  ensureAgendaPanel()
  const prefDate = sessionStorage.getItem("agendaDefaultDate")
  sessionStorage.removeItem("agendaDefaultDate")
  if (prefDate && /^\d{4}-\d{2}-\d{2}$/.test(prefDate)) {
    selectedDate = prefDate
    calendarYear = Number(prefDate.slice(0, 4))
    calendarMonth = Number(prefDate.slice(5, 7))
  } else {
    selectedDate = getTodayStr()
    const t = new Date()
    calendarYear = t.getFullYear()
    calendarMonth = t.getMonth() + 1
  }
  bindUI()
  getOrgMembers().catch(() => {})
  const openSlotId = sessionStorage.getItem("agendaOpenSlotId")
  const openAplicado = sessionStorage.getItem("agendaOpenAplicado") === "1"
  sessionStorage.removeItem("agendaOpenSlotId")
  sessionStorage.removeItem("agendaOpenAplicado")
  renderCalendarAndDay()
    .then(async () => {
      if (!openSlotId) return
      await openSlotPanel(openSlotId)
      if (!openAplicado) return
      const item = await getAgendaItemById(openSlotId)
      if (!item || item.item_type === "event") return
      closeSlotPanel()
      await openRegistrarProtocoloAgendaModal(item)
    })
    .catch((err) => {
    console.error("[AGENDA] erro render", err)
    toast("Erro ao carregar agenda")
  })
  renderAniversariantes()
  if (sessionStorage.getItem("agendaPrefillClientId")) {
    openCreateModal().catch(() => {})
  }
}

function bindUI() {
  const btnNovo = document.getElementById("btnNovoAgendamento")
  if (btnNovo) btnNovo.onclick = () => openCreateModal()

  const prev = document.getElementById("agendaPrevMonth")
  if (prev) prev.onclick = () => { changeMonth(-1); renderCalendarAndDay() }
  const next = document.getElementById("agendaNextMonth")
  if (next) next.onclick = () => { changeMonth(1); renderCalendarAndDay() }
  const prevWeek = document.getElementById("agendaPrevWeek")
  if (prevWeek) prevWeek.onclick = () => { shiftWeek(-1); renderCalendarAndDay() }
  const nextWeek = document.getElementById("agendaNextWeek")
  if (nextWeek) nextWeek.onclick = () => { shiftWeek(1); renderCalendarAndDay() }
  const goToday = document.getElementById("agendaGoToday")
  if (goToday) goToday.onclick = () => { goToToday(); renderCalendarAndDay() }

  const btnImport = document.getElementById("btnImportarAgenda")
  const inputImport = document.getElementById("importAgendaFile")
  if (btnImport && inputImport) {
    btnImport.onclick = () => inputImport.click()
    inputImport.onchange = async () => {
      const file = inputImport.files?.[0]
      if (!file) return
      inputImport.value = ""
      try {
        const r = await importarLote("agenda", file)
        toast(r.inseridos ? r.inseridos + " agendamento(s) importado(s)." : "Nenhum importado. Verifique o CSV.")
        if (r.erros?.length) toast("Erros: " + r.erros.length + " linha(s).", "warn")
        renderAgenda()
      } catch (e) {
        toast(e.message || "Erro ao importar.")
      }
    }
  }

  const btnModelo = document.getElementById("btnModeloAgenda")
  if (btnModelo) {
    btnModelo.onclick = (e) => {
      e.preventDefault()
      const headers = getTemplateHeaders("agenda")
      const line = headers.join(";")
      const blob = new Blob([line + "\n"], { type: "text/csv" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = "modelo_agenda.csv"
      a.click()
      toast("Modelo baixado!")
    }
  }

  const btnEspera = document.getElementById("btnAgendaListaEspera")
  if (btnEspera) {
    btnEspera.onclick = () => navigate("crm")
  }

  const filtroProf = document.getElementById("agendaFiltroProfissional")
  if (filtroProf && !filtroProf.dataset.bound) {
    filtroProf.dataset.bound = "1"
    filtroProf.addEventListener("change", () => renderCalendarAndDay())
  }
}

function changeMonth(delta) {
  calendarMonth += delta
  if (calendarMonth > 12) { calendarMonth = 1; calendarYear++ }
  if (calendarMonth < 1) { calendarMonth = 12; calendarYear-- }
}

function goToToday() {
  const t = new Date()
  selectedDate = getTodayStr()
  calendarYear = t.getFullYear()
  calendarMonth = t.getMonth() + 1
}

/* =====================
   RENDER CALENDÁRIO + LISTA DO DIA
===================== */

export async function renderAgenda() {
  renderCalendarAndDay()
}

async function renderCalendarAndDay() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast("Sessão expirada")
      redirect("/index.html")
      return
    }

    const filtroEl = document.getElementById("agendaFiltroProfissional")
    const professionalId = filtroEl?.value?.trim() || null

    if (filtroEl && filtroEl.options.length <= 1) {
      const members = await getOrgMembers()
      const uid = await agendaUserId()
      const opts = (members || []).map((m, i) => {
        const label = memberLabel(m, i, uid)
        return `<option value="${m.user_id}">${String(label).replace(/</g, "&lt;")}</option>`
      })
      filtroEl.innerHTML = "<option value=\"\">Todos</option>" + opts.join("")
      if (professionalId) filtroEl.value = professionalId
    }

    const monthData = await listAppointmentsByMonth(calendarYear, calendarMonth, professionalId)
    const countsByDay = {}
    for (const row of monthData) {
      const d = row.data
      if (d) countsByDay[d] = (countsByDay[d] || 0) + 1
    }

    renderCalendar(countsByDay)
    const weekItems = await renderWeekGrid(professionalId)
    await renderDayList(selectedDate, professionalId, weekItems)
  } catch (err) {
    console.error("[AGENDA] erro render", err)
    toast("Erro ao carregar agenda")
  }
}

function renderCalendar(countsByDay) {
  const titleEl = document.getElementById("agendaMonthTitle")
  const gridEl = document.getElementById("agendaCalendar")
  if (!titleEl || !gridEl) return

  titleEl.textContent = `${MONTHS[calendarMonth - 1]} ${calendarYear}`

  const first = new Date(calendarYear, calendarMonth - 1, 1)
  const firstWeekday = first.getDay()
  const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate()

  let html = `<div class="agenda-calendar-week agenda-calendar-week--head">`
  for (const w of WEEKDAYS) html += `<span class="agenda-calendar-cell agenda-calendar-cell--head">${w}</span>`
  html += `</div>`

  let day = 1
  let rowDays = 0
  let row = `<div class="agenda-calendar-week">`
  for (let i = 0; i < firstWeekday; i++) {
    row += `<span class="agenda-calendar-cell agenda-calendar-cell--empty"></span>`
    rowDays++
  }
  while (day <= daysInMonth) {
    const dateStr = `${calendarYear}-${String(calendarMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    const count = countsByDay[dateStr] || 0
    const isSelected = dateStr === selectedDate
    const isToday = dateStr === getTodayStr()
    row += `<button type="button" class="agenda-calendar-cell agenda-calendar-cell--day ${isSelected ? "agenda-calendar-cell--selected" : ""} ${isToday ? "agenda-calendar-cell--today" : ""}" data-date="${dateStr}" title="${count} agendamento(s)">
      <span class="agenda-calendar-day-num">${day}</span>
      ${count > 0 ? `<span class="agenda-calendar-dot" aria-hidden="true">${count > 9 ? "9+" : count}</span>` : ""}
    </button>`
    rowDays++
    day++
    if (rowDays === 7) {
      html += row + `</div>`
      row = `<div class="agenda-calendar-week">`
      rowDays = 0
    }
  }
  if (rowDays > 0) {
    for (let i = rowDays; i < 7; i++) row += `<span class="agenda-calendar-cell agenda-calendar-cell--empty"></span>`
    html += row + `</div>`
  }
  gridEl.innerHTML = html

  gridEl.querySelectorAll(".agenda-calendar-cell--day").forEach((btn) => {
    btn.onclick = () => {
      selectedDate = btn.dataset.date
      renderCalendarAndDay()
    }
  })
}

function isoFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function parseDateStr(dateStr) {
  const [y, m, d] = String(dateStr).split("-").map((n) => parseInt(n, 10))
  return new Date(y, m - 1, d)
}

function addDaysStr(dateStr, days) {
  const dt = parseDateStr(dateStr)
  dt.setDate(dt.getDate() + days)
  return isoFromDate(dt)
}

function mondayOf(dateStr) {
  const dt = parseDateStr(dateStr)
  const day = dt.getDay()
  const diff = day === 0 ? -6 : 1 - day
  dt.setDate(dt.getDate() + diff)
  return isoFromDate(dt)
}

function shiftWeek(deltaWeeks) {
  selectedDate = addDaysStr(mondayOf(selectedDate), deltaWeeks * 7)
  const dt = parseDateStr(selectedDate)
  calendarYear = dt.getFullYear()
  calendarMonth = dt.getMonth() + 1
}

const WEEK_START_HOUR = 8
const WEEK_END_HOUR = 20
const WEEK_DAY_COUNT = 6
const ROLE_AGENDA = { master: "Administrador", gestor: "Gestor", recepcao: "Recepção", profissional: "Profissional", funcionario: "Equipe", staff: "Colaborador", viewer: "Visualização" }

async function agendaUserId() {
  const { data } = await supabase.auth.getUser()
  return data?.user?.id || ""
}

function profPrimeiroNome(members, userId) {
  const m = (members || []).find((x) => x.user_id === userId)
  const full = String(m?.display_name || "").trim()
  if (full) return full.split(/\s+/)[0]
  return ""
}

function memberLabel(m, i = 0, currentUserId = "") {
  const name = String(m?.display_name || "").trim()
  if (name) return m?.user_id === currentUserId ? `${name} (você)` : name
  const role = ROLE_AGENDA[m?.role] || m?.role || `Profissional ${i + 1}`
  if (m?.user_id && m.user_id === currentUserId) return `${role} (você)`
  return role
}

function htmlQuemVendeuSelect(members, currentUserId, selectedId = "") {
  const opts = (members || []).map((m, i) => {
    const sel = selectedId && m.user_id === selectedId ? " selected" : ""
    return `<option value="${m.user_id}"${sel}>${escapeHtml(memberLabel(m, i, currentUserId))}</option>`
  }).join("")
  return `
   <label for="soldByUser">Quem vendeu (opcional)</label>
   <select id="soldByUser">
    <option value="">A mesma que aplica</option>
    ${opts}
   </select>
   <p class="form-hint">Quem fechou com a paciente. Quem aplica é o campo Profissional acima. Não muda preço e não paga sozinho.</p>`
}

function readSoldByUserId() {
  const v = document.getElementById("soldByUser")?.value?.trim() || ""
  return v || null
}

function nomeMembroPorId(members, userId, currentUserId = "") {
  if (!userId) return ""
  const list = members || []
  const i = list.findIndex((m) => m.user_id === userId)
  if (i < 0) return ""
  return memberLabel(list[i], i, currentUserId)
}

function escapeHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function htmlWeekAptBlock(apt, { showProf = false, members = [] } = {}) {
  const cliente = apt.clientes || apt.clients || {}
  const isEvent = apt.item_type === "event"
  const nome = isEvent ? apt.event_title || "Evento" : cliente.nome || cliente.name || "—"
  const proc = isEvent ? apt.event_type || "" : apt.procedimento || ""
  const kind = isEvent ? "event" : "ok"
  const horaTxt = String(apt.hora || "").slice(0, 5)
  const prof = showProf && !isEvent ? profPrimeiroNome(members, apt.user_id) : ""
  const retorno = !isEvent && apt.is_retorno ? " agenda-week-block--retorno" : ""
  const sub = [proc, prof].filter(Boolean).join(" · ")
  return `<button type="button" class="agenda-week-block agenda-week-block--${kind}${retorno}" data-id="${apt.id}">
            <b>${escapeHtml(horaTxt)} ${escapeHtml(nome)}</b>
            <span>${escapeHtml(sub)}</span>
          </button>`
}

function htmlWeekOcupado(b) {
  const ini = new Date(b.start_at)
  const fim = new Date(b.end_at)
  const t0 = `${String(ini.getHours()).padStart(2, "0")}:${String(ini.getMinutes()).padStart(2, "0")}`
  const t1 = `${String(fim.getHours()).padStart(2, "0")}:${String(fim.getMinutes()).padStart(2, "0")}`
  return `<span class="agenda-week-block agenda-week-block--ocupado" title="Agenda pessoal — sem detalhes">
            <b>${escapeHtml(labelOcupadoPessoal())}</b>
            <span>${t0}–${t1}</span>
          </span>`
}

function weekDayStripHtml(start) {
  const dayNames = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
  let html = `<div class="agenda-week-daystrip" role="tablist" aria-label="Dia da semana">`
  for (let i = 0; i < WEEK_DAY_COUNT; i++) {
    const ds = addDaysStr(start, i)
    const [, m, d] = ds.split("-")
    const isSelected = ds === selectedDate
    const isToday = ds === getTodayStr()
    html += `<button type="button" class="agenda-week-head${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}" data-date="${ds}" role="tab" aria-selected="${isSelected ? "true" : "false"}">${dayNames[i]} <span>${d}/${m}</span></button>`
  }
  html += `</div>`
  return html
}

function bindWeekGridClicks(grid, { bindDayHeads = true } = {}) {
  if (bindDayHeads) {
    grid.querySelectorAll(".agenda-week-head[data-date]").forEach((btn) => {
      btn.onclick = () => {
        selectedDate = btn.dataset.date
        renderCalendarAndDay()
      }
    })
  }
  grid.querySelectorAll(".agenda-week-block").forEach((el) => {
    el.onclick = (e) => {
      e.stopPropagation()
      if (!el.dataset.id) return
      openSlotPanel(el.dataset.id)
    }
  })
  grid.querySelectorAll(".agenda-week-cell").forEach((cell) => {
    cell.onclick = () => {
      if (cell.dataset.date) selectedDate = cell.dataset.date
      openCreateModal({
        hora: cell.dataset.hour,
        professionalId: cell.dataset.userId || undefined,
        date: cell.dataset.date || selectedDate,
      })
    }
  })
}

function formatConflitoHtml(c, extraLabel) {
  const proc = escapeHtml(c?.procedimento || "—")
  const inicio = escapeHtml(c?.inicio || "")
  const fim = escapeHtml(c?.fim || "")
  const motivo = c?.motivo ? ` ${escapeHtml(c.motivo)}` : ""
  const extra = c?.respiroNecessario
    ? ` (+${Number(c.respiroNecessario) || 0} min ${extraLabel || "de deslocamento/descanso"})`
    : ""
  return `${proc} às ${inicio}–${fim}${extra}${motivo}`
}

async function renderWeekGrid(professionalId = null) {
  const grid = document.getElementById("agendaWeekGrid")
  const weekTitle = document.getElementById("agendaWeekTitle")
  if (!grid) return []

  const start = mondayOf(selectedDate)
  const end = addDaysStr(start, WEEK_DAY_COUNT - 1)
  const a = parseDateStr(start)
  const b = parseDateStr(end)
  if (weekTitle) {
    weekTitle.textContent =
      a.getMonth() === b.getMonth()
        ? `${a.getDate()}–${b.getDate()} ${MONTHS[a.getMonth()]} ${a.getFullYear()}`
        : `${a.getDate()} ${MONTHS[a.getMonth()].slice(0, 3)} – ${b.getDate()} ${MONTHS[b.getMonth()].slice(0, 3)} ${b.getFullYear()}`
  }

  let items = []
  let externals = []
  const members = await getOrgMembers().catch(() => [])
  try {
    items = await listAppointmentsByRange(start, end, professionalId)
    if (professionalId) {
      externals = await listExternalBlocksForRange(start, end, professionalId).catch(() => [])
    }
  } catch (err) {
    console.error("[AGENDA] semana", err)
    grid.innerHTML = `<p class="agenda-empty">Não foi possível carregar a semana.</p>`
    return []
  }

  const byDate = {}
  for (const row of items) {
    if (!row?.data) continue
    ;(byDate[row.data] ||= []).push(row)
  }

  const hint = document.querySelector(".agenda-week-hint")
  const cols = !professionalId ? (members || []).filter((m) => m.user_id) : []
  const dayItems = byDate[selectedDate] || []
  if (cols.length && dayItems.some((a) => !a.user_id)) {
    cols.push({ user_id: "", display_name: "Clínica" })
  }
  const useProfCols = !professionalId && cols.length > 0

  if (hint) {
    hint.textContent = useProfCols
      ? "Cada coluna é uma profissional deste dia. Clique no vazio da coluna para marcar nela. Clique no bloco para ficha, WhatsApp e baixa."
      : "Clique no vazio para marcar. Clique no bloco para ficha, WhatsApp e baixa. Filtre o profissional no topo."
  }
  grid.classList.toggle("agenda-week--cols", useProfCols)
  grid.setAttribute("aria-label", useProfCols ? "Agenda do dia por profissional" : "Agenda da semana")

  if (useProfCols) {
    const n = cols.length
    grid.style.setProperty("--agenda-cols", String(n))
    let html = weekDayStripHtml(start)
    html += `<div class="agenda-week-row agenda-week-row--head agenda-week-row--prof"><span class="agenda-week-gutter"></span>`
    const uid = await agendaUserId()
    const colLabels = cols.map((m, i) => profPrimeiroNome([m], m.user_id) || memberLabel(m, i, uid))
    colLabels.forEach((label) => {
      html += `<span class="agenda-week-colh">${escapeHtml(label)}</span>`
    })
    html += `</div>`
    for (let h = WEEK_START_HOUR; h <= WEEK_END_HOUR; h++) {
      const hh = String(h).padStart(2, "0")
      html += `<div class="agenda-week-row agenda-week-row--prof"><span class="agenda-week-gutter">${hh}:00</span>`
      cols.forEach((m, i) => {
        const hourItems = dayItems.filter((apt) => {
          if (Math.floor(parseHoraToMinutes(apt.hora) / 60) !== h) return false
          return String(apt.user_id || "") === String(m.user_id || "")
        })
        const clinicBlocks = hourItems.map((apt) => htmlWeekAptBlock(apt, { showProf: false, members })).join("")
        const livre = clinicBlocks ? "" : " Livre"
        html += `<div class="agenda-week-cell" data-date="${selectedDate}" data-hour="${hh}:00" data-user-id="${escapeHtml(m.user_id || "")}" aria-label="${escapeHtml(colLabels[i])} ${hh}:00${livre}">${clinicBlocks}</div>`
      })
      html += `</div>`
    }
    grid.innerHTML = html
    bindWeekGridClicks(grid)
    return items
  }

  grid.style.removeProperty("--agenda-cols")
  let html = `<div class="agenda-week-row agenda-week-row--head"><span class="agenda-week-gutter"></span>`
  const dayNames = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
  for (let i = 0; i < WEEK_DAY_COUNT; i++) {
    const ds = addDaysStr(start, i)
    const [, m, d] = ds.split("-")
    const isSelected = ds === selectedDate
    const isToday = ds === getTodayStr()
    html += `<button type="button" class="agenda-week-head${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}" data-date="${ds}">${dayNames[i]} <span>${d}/${m}</span></button>`
  }
  html += `</div>`

  for (let h = WEEK_START_HOUR; h <= WEEK_END_HOUR; h++) {
    const hh = String(h).padStart(2, "0")
    html += `<div class="agenda-week-row"><span class="agenda-week-gutter">${hh}:00</span>`
    for (let i = 0; i < WEEK_DAY_COUNT; i++) {
      const ds = addDaysStr(start, i)
      const hourStart = new Date(`${ds}T${hh}:00:00`)
      const hourEnd = new Date(hourStart.getTime() + 60 * 60000)
      const hourItems = (byDate[ds] || []).filter((apt) => Math.floor(parseHoraToMinutes(apt.hora) / 60) === h)
      const clinicBlocks = hourItems.map((apt) => htmlWeekAptBlock(apt, { showProf: !professionalId, members })).join("")
      const ocupados = (externals || [])
        .filter((b) => rangesOverlap(hourStart.getTime(), hourEnd.getTime(), new Date(b.start_at).getTime(), new Date(b.end_at).getTime()))
        .map((b) => htmlWeekOcupado(b))
        .join("")
      html += `<div class="agenda-week-cell" data-date="${ds}" data-hour="${hh}:00">${clinicBlocks}${ocupados}</div>`
    }
    html += `</div>`
  }

  grid.innerHTML = html
  bindWeekGridClicks(grid)
  return items
}

/** Converte "09:00" ou "9:00" em minutos desde meia-noite. */
function parseHoraToMinutes(horaStr) {
  if (!horaStr) return 0
  const s = String(horaStr).trim().slice(0, 5)
  const [h, m] = s.split(":").map((n) => parseInt(n, 10) || 0)
  return h * 60 + m
}

function htmlAcoesLembrete(a) {
  if (a.item_type === "event") return ""
  const r = rotuloLembrete(a)
  if (!r.enviar) {
    return `<span class="agenda-lembrete-enviado" title="${escapeHtml(r.title)}">✓</span>`
  }
  const primeira = a.reminder_sent_at
    ? `<span class="agenda-lembrete-enviado" title="1ª tentativa enviada; ainda sem confirmação">1ª</span>`
    : ""
  const glyph = r.n >= 2 ? "2ª" : "📋"
  return `${primeira}<button type="button" class="btn-lembrete btn-icon-sm" data-id="${a.id}" data-tentativa="${r.n}" title="${escapeHtml(r.title)}">${glyph}</button>`
}

/** Timeline: 6h–22h (horário comercial), blocos maiores estilo Google. */
function renderDayList(date, professionalId = null, weekItems = null) {
  const listaAgenda = document.getElementById("listaAgenda")
  const dayTitleEl = document.getElementById("agendaDayTitle")
  if (!listaAgenda) return

  if (dayTitleEl) {
    const [y, m, d] = date.split("-")
    dayTitleEl.textContent = `Agendamentos do dia ${d}/${m}/${y}`
  }

  const dayFromWeek = Array.isArray(weekItems)
    ? weekItems.filter((a) => a?.data === date)
    : null
  const appointmentsP = dayFromWeek
    ? Promise.resolve(dayFromWeek)
    : listAppointmentsByDate(date, professionalId)

  Promise.all([
    appointmentsP,
    professionalId ? listExternalBlocksForRange(date, date, professionalId).catch(() => []) : Promise.resolve([]),
    listProcedures(true).catch(() => []),
  ])
    .then(async ([data, externals, procedures]) => {
      const cliente = (a) => a.clientes || a.clients || {}
      const hora = (a) => a.hora ?? ""
      const isEvent = (a) => a.item_type === "event"
      const items = data || []
      const members = !professionalId ? await getOrgMembers().catch(() => []) : []

      if (items.length === 0 && !(externals || []).length) {
        listaAgenda.innerHTML = `
          <p class="agenda-empty">Nenhum horário neste dia. Clique na grade acima ou em <strong>Novo horário</strong>.</p>
        `
        renderAgendaAfazeres(date)
        return
      }

      const rows = items
        .slice()
        .sort((a, b) => parseHoraToMinutes(a.hora) - parseHoraToMinutes(b.hora))
        .map((a) => {
          const nome = isEvent(a)
            ? (a.event_title || "Evento")
            : (cliente(a).nome || cliente(a).name || "—")
          const proc = isEvent(a) ? (a.event_type || "") : (a.procedimento || "")
          const prof = !professionalId && !isEvent(a) ? profPrimeiroNome(members, a.user_id) : ""
          const linha = [proc, prof, a.is_retorno ? "retorno" : ""].filter(Boolean).join(" · ")
          return `
    <div class="calendar-event agenda-day-row ${isEvent(a) ? "calendar-event--event" : "calendar-event--procedure"} ${a.is_retorno ? "calendar-event--retorno" : ""}"
         data-id="${a.id}"
         data-tel="${(cliente(a).telefone || cliente(a).phone || "").replace(/"/g, "&quot;")}"
         data-email="${(cliente(a).email || "").replace(/"/g, "&quot;")}">
      <div class="agenda-day-row-time">${escapeHtml(hora(a))}</div>
      <div class="agenda-day-row-main">
        <strong>${escapeHtml(nome)}</strong>
        <span>${escapeHtml(linha)}</span>
      </div>
      <div class="calendar-event-block-actions">
        ${htmlAcoesLembrete(a)}
        ${!isEvent(a) ? `<button type="button" class="btn-email-lembrete btn-icon-sm" data-id="${a.id}" title="E-mail">✉️</button>` : ""}
        ${!isEvent(a) ? `<button class="btn-whats btn-icon-sm" title="WhatsApp">📲</button>` : ""}
      </div>
    </div>`
        })
        .join("")

      const ocupadoRows = (externals || []).map((b) => {
        const ini = new Date(b.start_at)
        const fim = new Date(b.end_at)
        const t0 = `${String(ini.getHours()).padStart(2, "0")}:${String(ini.getMinutes()).padStart(2, "0")}`
        const t1 = `${String(fim.getHours()).padStart(2, "0")}:${String(fim.getMinutes()).padStart(2, "0")}`
        return `
    <div class="calendar-event agenda-day-row calendar-event--ocupado" title="Agenda pessoal — a clínica não vê o conteúdo">
      <div class="agenda-day-row-time">${t0}–${t1}</div>
      <div class="agenda-day-row-main"><strong>${escapeHtml(labelOcupadoPessoal())}</strong></div>
    </div>`
      }).join("")

      const aluguelTxt = textoAluguelNaAgenda(resumoAluguelNaAgenda(items, procedures))
      const aluguelBanner = aluguelTxt
        ? `<p class="agenda-aluguel-dia">${escapeHtml(aluguelTxt)}</p>`
        : ""
      listaAgenda.innerHTML = `${aluguelBanner}<div class="agenda-day-list">${rows}${ocupadoRows}</div>`

      bindEditEvents()
      bindLembreteButtons(items, date)
      bindEmailLembreteButtons(items, date)
      notificarSemResponsavel().catch(() => {})
      renderAgendaAfazeres(date)
    })
    .catch((err) => {
      console.error("[AGENDA] erro lista dia", err)
      listaAgenda.innerHTML = `<p class="agenda-empty">Erro ao carregar agendamentos.</p>`
    })
}

/** Preenche o bloco "Tarefas do dia" na agenda (afazeres com prazo nesta data; não ocupam horário). */
async function renderAgendaAfazeres(date) {
  const wrap = document.getElementById("agendaAfazeresWrap")
  const listEl = document.getElementById("listaAgendaAfazeres")
  if (!wrap || !listEl) return
  try {
    const afazeres = await listAfazeresByPrazo(date)
    const members = await getOrgMembers()
    const roleByUser = (members || []).reduce((acc, m) => { acc[m.user_id] = m.role; return acc }, {})
    const roleLabels = { master: "Administrador", gestor: "Gestor", staff: "Colaborador", viewer: "Visualização" }
    const { data: { user } } = await supabase.auth.getUser()
    const currentUserId = user?.id

    if (!afazeres || afazeres.length === 0) {
      listEl.innerHTML = "<p class=\"agenda-afazeres-empty\">Nenhuma tarefa com prazo neste dia.</p>"
      return
    }
    listEl.innerHTML = afazeres.map((a) => {
      const role = roleByUser[a.responsavel_user_id]
      const roleLabel = roleLabels[role] || role || "—"
      const responsavelLabel = a.responsavel_user_id === currentUserId ? "Você" : roleLabel
      const statusLabel = a.status === "concluido" ? "Concluída" : a.status === "em_andamento" ? "Em andamento" : "Pendente"
      return `
        <div class="calendar-event calendar-event--afazer" data-afazer-id="${a.id}">
          <div class="calendar-event-time calendar-event-time--afazer" aria-hidden="true">📌</div>
          <div class="calendar-event-name">
            ${escapeHtml(a.titulo || "Tarefa")}
            <span class="calendar-event-afazer-meta">Responsável: ${responsavelLabel} · ${statusLabel}</span>
          </div>
        </div>
      `
    }).join("")
  } catch (e) {
    console.warn("[AGENDA] afazeres do dia", e)
    listEl.innerHTML = "<p class=\"agenda-afazeres-empty\">Erro ao carregar tarefas do dia.</p>"
  }
}

/** Liga botões "Enviar lembrete" nos itens do dia: mensagem com link de confirmação e registro de envio. */
function bindLembreteButtons(items, date) {
  const listaAgenda = document.getElementById("listaAgenda")
  if (!listaAgenda || !items?.length) return
  listaAgenda.querySelectorAll(".btn-lembrete").forEach((btn) => {
    const id = btn.dataset.id
    const item = items.find((a) => a.id === id)
    if (!item) return
    btn.onclick = async (e) => {
      e.stopPropagation()
      const profile = await getOrganizationProfile().catch(() => ({}))
      const cliente = item.clientes || item.clients || {}
      const nome = cliente.nome || cliente.name || "Cliente"
      const tel = cliente.telefone || cliente.phone || ""
      const hora = item.hora || ""
      const [y, m, d] = (date || selectedDate).split("-")
      const dataFmt = `${d}/${m}/${y}`
      let linkConfirmar = ""
      try {
        const conf = await createConfirmation(id)
        if (conf?.token) {
          const base = typeof window !== "undefined" && window.location?.origin ? window.location.origin : ""
          linkConfirmar = `${base}/portal.html?confirmToken=${encodeURIComponent(conf.token)}`
        }
      } catch (err) {
        console.warn("[AGENDA] createConfirmation falhou, enviando lembrete sem link", err)
      }
      const vars = { nome_cliente: nome, data: dataFmt, hora, nome_clinica: profile.name || "Clínica", link_confirmar: linkConfirmar }
      const texto = await buildMessage("lembrete_agendamento", vars, { useConfirmar: !!linkConfirmar })
      const segunda = Number(btn.dataset.tentativa) >= 2
      try {
        navigator.clipboard.writeText(texto)
      } catch (_) {}
      if (tel) {
        const num = String(tel).replace(/\D/g, "")
        if (num.length >= 10) sendWhatsapp(num, texto, { origem: origemLembreteWhatsapp(btn.dataset.tentativa), clientId: item.cliente_id || item.client_id || "" })
      }
      toast(segunda
        ? "Segunda tentativa: confira o WhatsApp antes de enviar. Nada sai sozinho."
        : "Lembrete com link de confirmação. Confira o WhatsApp antes de enviar.")
      try {
        await withOrg(supabase.from("agenda").update({ reminder_sent_at: new Date().toISOString() }).eq("id", id))
        renderDayList(date || selectedDate)
      } catch (_) {
        // Coluna reminder_sent_at pode não existir ainda
      }
    }
  })
}

/** Botão E-mail: abre o cliente de e-mail com mensagem personalizada (custo zero). */
function bindEmailLembreteButtons(items, date) {
  const listaAgenda = document.getElementById("listaAgenda")
  if (!listaAgenda || !items?.length) return
  listaAgenda.querySelectorAll(".btn-email-lembrete").forEach((btn) => {
    const id = btn.dataset.id
    const item = items.find((a) => a.id === id)
    if (!item) return
    btn.onclick = async (e) => {
      e.stopPropagation()
      const cliente = item.clientes || item.clients || {}
      const email = (cliente.email || "").trim()
      if (!email) {
        toast("Cliente sem e-mail cadastrado. Cadastre no perfil do cliente.")
        return
      }
      const profile = await getOrganizationProfile().catch(() => ({}))
      const nome = cliente.nome || cliente.name || "Cliente"
      const hora = item.hora || ""
      const [y, m, d] = (date || selectedDate).split("-")
      const dataFmt = `${d}/${m}/${y}`
      let linkConfirmar = ""
      try {
        const conf = await createConfirmation(id)
        if (conf?.token) {
          const base = typeof window !== "undefined" && window.location?.origin ? window.location.origin : ""
          linkConfirmar = `${base}/portal.html?confirmToken=${encodeURIComponent(conf.token)}`
        }
      } catch (_) {}
      const vars = { nome_cliente: nome, data: dataFmt, hora, nome_clinica: profile.name || "Clínica", link_confirmar: linkConfirmar }
      const { subject: assunto, body: corpo } = await buildEmailLembrete(vars, linkConfirmar)
      const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`
      window.location.href = mailto
      try {
        await withOrg(supabase.from("agenda").update({ reminder_sent_at: new Date().toISOString() }).eq("id", id))
        renderDayList(date || selectedDate)
      } catch (_) {}
      toast("E-mail aberto. Envie pelo seu programa de e-mail (custo zero).")
    }
  })
}

/**
 * Se houver agendamentos (hoje + 7 dias) sem profissional, cria notificação.
 * "Se ninguém está responsável, o sistema avisa." — não acusa, não bloqueia.
 */
async function notificarSemResponsavel() {
  const orgId = getActiveOrg()
  if (!orgId) return
  const today = getTodayStr()
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + 7)
  const end = endDate.toISOString().slice(0, 10)
  const { data: items } = await withOrg(
    supabase.from("agenda").select("id").gte("data", today).lte("data", end).is("user_id", null)
  )
  if (!items || items.length === 0) return
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { data: existing } = await withOrg(
    supabase.from("notificacoes").select("id").eq("lida", false).eq("titulo", "Agendamentos sem responsável").limit(1)
  )
  if (existing && existing.length > 0) return
  await supabase.from("notificacoes").insert({
    org_id: orgId,
    user_id: user.id,
    titulo: "Agendamentos sem responsável",
    mensagem: `${items.length} item(ns) ainda sem responsável definido. Vale a pena atribuir na agenda.`
  })
}

/** Monta mensagem de aniversário (usa modelo da org se existir; senão padrão com ou sem brinde). */
async function buildMensagemAniversario(nomeCliente, brindeHabilitado, nomeEmpresa) {
  const vars = { nome_cliente: nomeCliente, nome_clinica: nomeEmpresa || "Clínica", data: "", hora: "", link_confirmar: "" }
  return buildMessage("aniversario", vars, { brindeAniversario: !!brindeHabilitado })
}

/** Carrega e exibe aniversariantes do dia / desta semana; botão Enviar mensagem (copia + WhatsApp). */
async function renderAniversariantes() {
  const wrap = document.getElementById("agendaAniversariantesWrap")
  const listEl = document.getElementById("agendaAniversariantesList")
  if (!wrap || !listEl) return
  try {
    const [aniversariantes, profile] = await Promise.all([
      getAniversariantes("semana"),
      getOrganizationProfile().catch(() => ({}))
    ])
    const brinde = !!profile.brinde_aniversario_habilitado
    const nomeEmpresa = profile.name || "Clínica"
    if (!aniversariantes.length) {
      listEl.innerHTML = "<p class=\"agenda-aniversariantes-empty\">Nenhum aniversariante nesta semana.</p>"
      return
    }
    listEl.innerHTML = aniversariantes
      .map(
        (c) => {
          const nome = (c.name || "").trim() || "Cliente"
          const quando = c._quando || ""
          return `
    <div class="agenda-aniversariante-item">
      <span class="agenda-aniversariante-nome">${escapeHtml(nome)}</span>
      <span class="agenda-aniversariante-quando">${escapeHtml(quando)}</span>
      <button type="button" class="btn-enviar-msg-aniversario" data-client-id="${escapeHtml(String(c.id || "")).replace(/"/g, "&quot;")}" data-nome="${escapeHtml(nome).replace(/"/g, "&quot;")}" data-phone="${escapeHtml(String(c.phone || "")).replace(/"/g, "&quot;")}">Enviar mensagem</button>
    </div>`
        }
      )
      .join("")
    listEl.querySelectorAll(".btn-enviar-msg-aniversario").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation()
        const nome = btn.dataset.nome || "Cliente"
        const msg = await buildMensagemAniversario(nome, brinde, nomeEmpresa)
        const phone = (btn.dataset.phone || "").replace(/\D/g, "")
        try {
          navigator.clipboard.writeText(msg)
          toast("Mensagem copiada. Cole no WhatsApp ou e-mail.")
        } catch (_) {
          toast("Copie a mensagem manualmente.")
        }
        if (phone.length >= 10) sendWhatsapp(phone, msg, { origem: "agenda_aniversario", clientId: btn.dataset.clientId || "" })
      })
    })
  } catch (e) {
    console.error("[AGENDA] aniversariantes", e)
    listEl.innerHTML = "<p class=\"agenda-aniversariantes-empty\">Erro ao carregar aniversariantes.</p>"
  }
}

/* =====================
   MODAIS
===================== */

function bindAgendaEsperaWa(scope) {
  (scope || document).querySelectorAll(".agenda-espera-wa").forEach((btn) => {
    if (btn.dataset.boundWa) return
    btn.dataset.boundWa = "1"
    btn.addEventListener("click", async () => {
      try {
        await sendWhatsapp(btn.dataset.phone, btn.dataset.msg, {
          origem: "agenda_espera",
          clientId: btn.dataset.clientId || "",
          waitlistId: btn.dataset.waitlistId || "",
        })
        toast("WhatsApp aberto. Confira antes de enviar.")
      } catch (e) {
        toast(e?.message || "Não foi possível abrir o WhatsApp.")
      }
    })
  })
}

async function preencherEsperaEncaixeNoModal() {
  const box = document.getElementById("agendaEsperaEncaixe")
  if (!box) return
  const data = document.getElementById("data")?.value || ""
  const proc = (document.getElementById("proc")?.value || "").trim()
  if (!data) {
    box.innerHTML = ""
    return
  }
  let espera = []
  try {
    espera = await listWaitlist("aberta")
  } catch (_) {
    box.innerHTML = ""
    return
  }
  const matches = matchWaitlistToSlot(espera, { data, procedimento: proc })
  if (!matches.length) {
    box.innerHTML = ""
    return
  }
  const profile = await getOrganizationProfile().catch(() => ({}))
  const clinic = profile?.name || "nossa clínica"
  const hora = document.getElementById("hora")?.value || ""
  const extra = `${data} ${hora}`.trim()
  box.innerHTML = `<p class="agenda-baixa-hint">Quem espera um horário neste dia. Encaixar preenche o formulário. WhatsApp só no clique.</p><ul class="agenda-espera-match">${
    matches.slice(0, 5).map((w) => {
      const tel = String(w.phone || "").replace(/\D/g, "")
      const msg = filaWhatsappTemplate({
        name: w.nome,
        sinal: "espera",
        clinic,
        extra,
      })
      const encaixar = `<button type="button" class="btn-sm agenda-espera-encaixar" data-client-id="${escapeAttr(w.client_id || "")}" data-proc="${escapeAttr(w.procedure_name || "")}">Encaixar ${escapeHtml(w.nome || "")}</button>`
      const wa = tel.length >= 10
        ? `<button type="button" class="btn-secondary btn-sm agenda-espera-wa" data-waitlist-id="${escapeAttr(w.id)}" data-client-id="${escapeAttr(w.client_id || "")}" data-phone="${escapeAttr(w.phone || "")}" data-msg="${escapeAttr(msg)}">Avisar</button>`
        : ""
      return `<li>${encaixar} ${wa}</li>`
    }).join("")
  }</ul>`
  bindAgendaEsperaWa(box)
  box.querySelectorAll(".agenda-espera-encaixar").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cliente = document.getElementById("cliente")
      if (btn.dataset.clientId && cliente) {
        cliente.value = btn.dataset.clientId
        cliente.dispatchEvent(new Event("change"))
      } else if (!btn.dataset.clientId) {
        toast("Essa pessoa ainda não está no cadastro. Escolha o cliente no campo acima.")
      }
      const procEl = document.getElementById("proc")
      if (btn.dataset.proc && procEl) procEl.value = btn.dataset.proc
      toast("Encaixe no formulário. Confira e salve. Nada foi enviado no WhatsApp.")
    })
  })
}

async function openCreateModal(opts = {}){
 try {
  if (opts.date) selectedDate = opts.date
  const horaPrefill = opts.hora || "09:00"

 let clientes = []
 try {
  clientes = await listClientesForSelect()
 } catch (_) {
  clientes = []
 }
 const prefillClient = opts.clientId || sessionStorage.getItem("agendaPrefillClientId") || ""
 if (sessionStorage.getItem("agendaPrefillClientId")) sessionStorage.removeItem("agendaPrefillClientId")
 const prefillPlano = opts.planoId || sessionStorage.getItem("agendaPrefillPlanoId") || ""
 if (sessionStorage.getItem("agendaPrefillPlanoId")) sessionStorage.removeItem("agendaPrefillPlanoId")

 const members = await getOrgMembers()
 const uid = await agendaUserId()
 const profOptions = (members || []).map((m, i) => {
  const label = memberLabel(m, i, uid)
  return `<option value="${m.user_id}">${label}</option>`
 }).join("")
 const profHint = (members || []).length < 2
  ? `<p class="form-hint">Se a profissional já aceitou o convite e não aparece, rode no Supabase o arquivo supabase-equipe-agenda-membros-colar.sql.</p>`
  : ""

 // Carregar salas
 let salas = []
 try { salas = await listSalas() } catch (_) {}
 const salaOptions = (salas || []).map(s => `<option value="${s.id}">${(s.nome || "").replace(/</g, "&lt;")}</option>`).join("")

 // Carregar config de respiro
 let config = { sala_obrigatoria: true, profissional_obrigatorio: true, respiro_sala_minutos: 10, respiro_profissional_minutos: 5 }
 try { config = await getAgendaConfig() } catch (_) {}

 let procedures = []
 try { procedures = await listProcedures(true) } catch (_) {}
 const procCatalogOptions = "<option value=\"\">Texto livre</option>" + (procedures || []).map((p) => `<option value="${p.id}" data-name="${(p.name || "").replace(/"/g, "&quot;")}" data-duration="${p.duration_minutes || 60}">${(p.name || "").replace(/</g, "&lt;")}</option>`).join("")

 let planos = []
 try { planos = await listPlanosTerapeuticos() } catch (_) { planos = [] }
 const planoOptions = "<option value=\"\">Nenhum — só este horário</option>" + (planos || []).map((pl) =>
  `<option value="${pl.id}">${(pl.nome || "Plano").replace(/</g, "&lt;")}</option>`
 ).join("")
 const proceduresById = new Map((procedures || []).map((p) => [p.id, p]))

 openModal(
  "Novo agendamento",

  `
   <label for="data">Data</label>
   <input type="date" id="data" value="${selectedDate || getTodayStr()}" required>

   <label for="hora">Hora</label>
   <input type="time" id="hora" value="${horaPrefill}" required>

   <label for="procDuration">Duração (min)</label>
   <input type="number" id="procDuration" min="5" step="5" value="60" title="Preenchido ao escolher procedimento do catálogo">

   <div class="agenda-modal-availability">
    <button type="button" id="btnVerDisponiveis" class="btn-secondary">Ver disponibilidade (profissional + sala)</button>
    <p id="agendaDisponiveis" class="agenda-disponiveis-msg" aria-live="polite"></p>
   </div>

   <label for="sala">Sala/Cabine${config.sala_obrigatoria && (salas || []).length ? " *" : ""}</label>
   <select id="sala">
    <option value="">Selecione a sala…</option>
    ${salaOptions}
   </select>
   <p id="agendaSalaStatus" class="agenda-sala-status" aria-live="polite"></p>

   <label for="profissional">Profissional${config.profissional_obrigatorio && (members || []).length ? " *" : ""}</label>
   <select id="profissional">
    <option value="">Selecione o profissional…</option>
    ${profOptions}
   </select>
   ${profHint}
   <p id="agendaProfStatus" class="agenda-prof-status" aria-live="polite"></p>
   ${htmlQuemVendeuSelect(members, uid, opts.soldByUserId || "")}

   <label for="cliente">Paciente</label>
   <select id="cliente">
    <option value="">Selecione o paciente…</option>
    ${(clientes || []).map(c=>`
     <option value="${c.id}" ${c.id === prefillClient ? "selected" : ""} data-modelo="${c.is_paciente_modelo ? "1" : "0"}" data-discount="${c.model_discount_pct != null ? c.model_discount_pct : ""}">${(c.nome || c.name || "").replace(/</g, "&lt;")}${c.is_paciente_modelo ? " (modelo)" : ""}</option>
    `).join("")}
   </select>
   <button type="button" class="btn-link" id="btnAgendaNovoPaciente">Cadastrar paciente agora</button>
   <div id="agendaNovoPacienteWrap" class="hidden agenda-novo-paciente">
    <label for="agendaNovoNome">Nome</label>
    <input type="text" id="agendaNovoNome" autocomplete="name">
    <label class="field-label" for="agendaNovoPhone">WhatsApp</label>
    <input type="tel" id="agendaNovoPhone" inputmode="tel" placeholder="(00) 00000-0000" maxlength="15">
    <button type="button" class="btn-secondary" id="btnAgendaSalvarPaciente">Salvar paciente</button>
   </div>
   <div id="agendaModeloWrap" class="agenda-modelo-wrap hidden">
    <p class="agenda-modelo-title">Paciente modelo</p>
    <label><input type="checkbox" id="agendaAplicarDescontoModelo" checked> Aplicar desconto modelo neste agendamento</label>
    <label for="agendaDescontoModeloPct">Desconto neste agendamento (%)</label>
    <input type="number" id="agendaDescontoModeloPct" min="0" max="100" step="0.5" placeholder="Ex.: 30">
   </div>

   <label for="procCatalog">Procedimento (catálogo)</label>
   <select id="procCatalog">${procCatalogOptions}</select>

   <label for="proc">Procedimento (nome ou texto livre)</label>
   <input id="proc" placeholder="Ex.: Limpeza de pele">
   <div id="agendaEsperaEncaixe" class="agenda-espera-encaixe" aria-live="polite"></div>

   <details class="agenda-modal-mais">
   <summary>Plano, retorno e outras opções</summary>
   <label for="agendaPlano">Plano terapêutico (opcional)</label>
   <select id="agendaPlano">${planoOptions}</select>
   <p id="agendaPlanoPreview" class="agenda-plano-preview"></p>
   <label class="agenda-plano-sessoes hidden" id="agendaPlanoSessoesWrap">
    <input type="checkbox" id="agendaPlanoSessoes" checked>
    Agendar as demais sessões a cada 7 dias (mesmo horário). Conflito pula a sessão.
   </label>

   <div class="agenda-retorno-option">
    <label><input type="checkbox" id="agendaIsRetorno"> Retorno (não gera receita)</label>
    <p class="agenda-retorno-hint">Marque para consultas de retorno (ex.: pós-botox). O horário ocupa a agenda, mas não entra no faturamento previsto.</p>
   </div>

    <p class="agenda-modal-respiro-hint">
     <strong>Respiro automático:</strong> ${config.respiro_sala_minutos} min para sala, ${config.respiro_profissional_minutos} min para profissional.
     <br><small>Profissional esporádico com Google: a clínica vê só ocupado/livre (sem o conteúdo da agenda pessoal). Ao salvar, o horário entra no Google dele como “Atendimento na clínica”, com folga para chegar e para o próximo compromisso.</small>
     <br><small>Selecione o procedimento primeiro para ver só salas e profissionais compatíveis.</small>
    </p>
   <div class="agenda-external-block">
    <label>
      <input type="checkbox" id="onlyExternalBlock">
      Marcar apenas como indisponível (compromisso externo do profissional, sem cliente)
    </label>
    <p class="agenda-external-block-hint">
      O horário aparecerá como ocupado na disponibilidade do profissional, mas não criará atendimento na agenda da clínica.
    </p>
   </div>
   </details>
  `,

  createAgenda
 )

 const dataEl = document.getElementById("data")
 const horaEl = document.getElementById("hora")
 const profEl = document.getElementById("profissional")
 const salaEl = document.getElementById("sala")
 const procCatalogEl = document.getElementById("procCatalog")
 const procEl = document.getElementById("proc")
 const procDurationEl = document.getElementById("procDuration")
 const clienteSelect = document.getElementById("cliente")
 const modeloWrap = document.getElementById("agendaModeloWrap")
 const descontoModeloPctEl = document.getElementById("agendaDescontoModeloPct")

 function updateModeloWrap() {
  const opt = clienteSelect?.selectedOptions?.[0]
  const isModelo = opt?.dataset?.modelo === "1"
  if (modeloWrap) modeloWrap.classList.toggle("hidden", !isModelo)
  if (isModelo && descontoModeloPctEl && opt?.dataset?.discount !== undefined && opt.dataset.discount !== "") {
   descontoModeloPctEl.value = opt.dataset.discount
  }
 }
 if (clienteSelect) {
  clienteSelect.addEventListener("change", updateModeloWrap)
  updateModeloWrap()
  bindAgendaCadastroRapido(clienteSelect)
 }

 const planoEl = document.getElementById("agendaPlano")
 const planoPreviewEl = document.getElementById("agendaPlanoPreview")
 const planoSessoesWrap = document.getElementById("agendaPlanoSessoesWrap")
 function refreshPlanoPreview() {
  const plano = (planos || []).find((p) => p.id === planoEl?.value)
  if (!plano) {
   if (planoPreviewEl) planoPreviewEl.textContent = ""
   if (planoSessoesWrap) planoSessoesWrap.classList.add("hidden")
   return
  }
  const sessoes = expandPlanoSessoes(plano.procedimentos, proceduresById)
  if (planoPreviewEl) {
   const nomes = sessoes.map((s, i) => `${i + 1}. ${s.procedimento || "procedimento"}`).join(" · ")
   planoPreviewEl.textContent = sessoes.length
    ? `${sessoes.length} sessão(ões): ${nomes}`
    : "Este plano ainda não tem procedimentos."
  }
  if (planoSessoesWrap) planoSessoesWrap.classList.toggle("hidden", sessoes.length < 2)
  const first = sessoes[0]
  if (first?.procedure_id && procCatalogEl) {
   procCatalogEl.value = first.procedure_id
   procCatalogEl.dispatchEvent(new Event("change"))
  }
 }
 if (planoEl) planoEl.addEventListener("change", refreshPlanoPreview)

 if (procCatalogEl) {
  procCatalogEl.onchange = async () => {
   const opt = procCatalogEl.options[procCatalogEl.selectedIndex]
   if (opt && opt.value) {
    if (procEl) procEl.value = (opt.dataset.name || opt.textContent || "").replace(/&quot;/g, '"')
    if (procDurationEl) procDurationEl.value = opt.dataset.duration || 60
   } else {
    if (procEl) procEl.value = ""
    if (procDurationEl) procDurationEl.value = 60
   }
   refreshDisponiveis(dataEl, horaEl, profEl, salaEl, procDurationEl)
   await filterSalasAndProfsByProcedure(procCatalogEl.value, salaEl, profEl, salas, members)
   await preencherEsperaEncaixeNoModal()
  }
 }
 const btnDisp = document.getElementById("btnVerDisponiveis")
 if (btnDisp) btnDisp.onclick = () => refreshDisponiveis(dataEl, horaEl, profEl, salaEl, procDurationEl)
 if (profEl) profEl.onchange = () => refreshProfStatus(profEl, dataEl, horaEl, procDurationEl)
 if (salaEl) salaEl.onchange = () => refreshSalaStatus(salaEl, dataEl, horaEl, procDurationEl)
 if (dataEl) dataEl.addEventListener("change", () => {
  refreshDisponiveis(dataEl, horaEl, profEl, salaEl, procDurationEl)
  preencherEsperaEncaixeNoModal()
 })
 if (horaEl) horaEl.addEventListener("change", () => {
  refreshDisponiveis(dataEl, horaEl, profEl, salaEl, procDurationEl)
  preencherEsperaEncaixeNoModal()
 })
 if (procEl) procEl.addEventListener("change", () => preencherEsperaEncaixeNoModal())

 if (prefillPlano && planoEl) {
  const hasPlano = [...planoEl.options].some((o) => o.value === prefillPlano)
  if (hasPlano) {
   planoEl.value = prefillPlano
   const mais = document.querySelector(".agenda-modal-mais")
   if (mais) mais.open = true
   refreshPlanoPreview()
  }
 }
 if (opts.procedureId && procCatalogEl) {
  procCatalogEl.value = opts.procedureId
  if (typeof procCatalogEl.onchange === "function") await procCatalogEl.onchange()
 } else if (opts.procedimento && procEl) {
  procEl.value = opts.procedimento
 }
 if (opts.professionalId && profEl) {
  const has = [...profEl.options].some((o) => o.value === opts.professionalId)
  if (has) profEl.value = opts.professionalId
 }
 await preencherEsperaEncaixeNoModal()
 } catch (err) {
  console.error("[AGENDA] abrir novo horário", err)
  toast(err?.message || "Não foi possível abrir o agendamento.")
 }
}

function bindAgendaCadastroRapido(clienteSelect) {
  const wrap = document.getElementById("agendaNovoPacienteWrap")
  bindPhoneMask(document.getElementById("agendaNovoPhone"))
  document.getElementById("btnAgendaNovoPaciente")?.addEventListener("click", (e) => {
    e.preventDefault()
    wrap?.classList.toggle("hidden")
  })
  document.getElementById("btnAgendaSalvarPaciente")?.addEventListener("click", async (e) => {
    e.preventDefault()
    const name = document.getElementById("agendaNovoNome")?.value?.trim()
    const phone = document.getElementById("agendaNovoPhone")?.value?.trim()
    if (!name || !phone) {
      toast("Nome e WhatsApp para cadastrar neste horário.")
      return
    }
    try {
      const c = await createClient({ name, phone })
      if (!clienteSelect || !c?.id) return
      const opt = document.createElement("option")
      opt.value = c.id
      opt.textContent = c.name || name
      opt.selected = true
      clienteSelect.appendChild(opt)
      wrap?.classList.add("hidden")
      clienteSelect.dispatchEvent(new Event("change"))
      toast("Paciente cadastrado. Confira o horário e salve.")
    } catch (err) {
      toast(err?.message || "Não foi possível cadastrar.")
    }
  })
}

/** Filtra dropdowns de sala e profissional pelo procedimento selecionado (sala suporta tipo; profissional realiza). */
async function filterSalasAndProfsByProcedure(procedureId, salaEl, profEl, salas, members) {
  if (!salaEl || !profEl) return
  const allSalas = salas || []
  const allMembers = members || []
  const emptyOptionSala = '<option value="">Selecione a sala…</option>'
  const emptyOptionProf = '<option value="">Selecione o profissional…</option>'
  const uid = await agendaUserId()
  if (!procedureId || procedureId.trim() === "") {
    salaEl.innerHTML = emptyOptionSala + allSalas.map(s => `<option value="${s.id}">${(s.nome || "").replace(/</g, "&lt;")}</option>`).join("")
    profEl.innerHTML = emptyOptionProf + allMembers.map((m, i) => {
      return `<option value="${m.user_id}">${memberLabel(m, i, uid)}</option>`
    }).join("")
    return
  }
  let salasFiltradas = allSalas
  try {
    const proc = await getProcedure(procedureId)
    const tipo = proc?.tipo_procedimento || null
    if (tipo) salasFiltradas = await listSalasQueSuportamTipo(tipo)
  } catch (_) {
    salasFiltradas = allSalas
  }
  let profIds = null
  try {
    profIds = await getProfessionalIdsWhoCanDoProcedure(procedureId)
  } catch (_) {
    profIds = null
  }
  const membersFiltrados = profIds && profIds.length > 0 ? allMembers.filter(m => profIds.includes(m.user_id)) : allMembers
  salaEl.innerHTML = emptyOptionSala + salasFiltradas.map(s => `<option value="${s.id}">${(s.nome || "").replace(/</g, "&lt;")}</option>`).join("")
  profEl.innerHTML = emptyOptionProf + membersFiltrados.map((m, i) => {
    return `<option value="${m.user_id}">${memberLabel(m, i, uid)}</option>`
  }).join("")
}

async function refreshDisponiveis(dataEl, horaEl, profEl, salaEl, procDurationEl) {
 const msg = document.getElementById("agendaDisponiveis")
 if (!msg) return
 const date = dataEl?.value
 const time = horaEl?.value
 if (!date || !time) {
  msg.textContent = "Informe data e hora."
  return
 }
 const duration = procDurationEl?.value ? Number(procDurationEl.value) : 60
 const procCatalogEl = document.getElementById("procCatalog")
 const procedureId = procCatalogEl?.value?.trim() || null
 msg.textContent = "Verificando…"
 try {
  const members = await getOrgMembers()
  const uid = await agendaUserId()
  const ids = await getAvailableProfessionals(date, time, duration, procedureId)
  const profNames = ids.map(id => {
   const m = members.find(m => m.user_id === id)
   return m ? memberLabel(m, 0, uid) : (id || "").slice(0, 8) + "…"
  })
  const salasDisponiveis = await getAvailableSalas(date, time, duration, null, procedureId)
  const salaNames = salasDisponiveis.map(s => s.nome)

  let text = ""
  if (profNames.length) text += `Profissionais: ${profNames.join(", ")}`
  else text += "Nenhum profissional disponível"
  text += " | "
  if (salaNames.length) text += `Salas: ${salaNames.join(", ")}`
  else text += "Nenhuma sala disponível"

  msg.textContent = text
  msg.className = "agenda-disponiveis-msg " + ((profNames.length && salaNames.length) ? "agenda-disponiveis-ok" : "agenda-disponiveis-empty")
 } catch (e) {
  msg.textContent = "Erro ao verificar disponibilidade."
  msg.className = "agenda-disponiveis-msg"
 }
 if (profEl) refreshProfStatus(profEl, dataEl, horaEl, procDurationEl)
 if (salaEl) refreshSalaStatus(salaEl, dataEl, horaEl, procDurationEl)
}

/** Monta HTML com botões "Escolher" para cada profissional disponível no horário (para trocar no select). */
async function buildDisponiveisButtons(date, time, duration, procedureId, profSelectEl, dataEl, horaEl, procDurationEl, excludeAgendaId = null) {
 const ids = await getAvailableProfessionals(date, time, duration, procedureId)
 if (!ids.length) return ""
 const members = await getOrgMembers()
 const roleLabel = (r) => ({ master: "Administrador", gestor: "Gestor", staff: "Colaborador", viewer: "Visualização" }[r] || r)
 return ids.map((uid) => {
  const m = members.find((x) => x.user_id === uid)
  const label = roleLabel(m?.role) || (uid || "").slice(0, 8) + "…"
  const safeLabel = escapeHtml(label)
  return `<button type="button" class="agenda-prof-disponivel-btn" data-user-id="${escapeHtml(uid)}" title="Escolher ${safeLabel}">${safeLabel}</button>`
 }).join(" ")
}

async function refreshProfStatus(profEl, dataEl, horaEl, procDurationEl, excludeAgendaId = null) {
 const statusEl = document.getElementById("agendaProfStatus")
 if (!statusEl || !profEl?.value) {
  if (statusEl) statusEl.textContent = ""
  return
 }
 const date = dataEl?.value
 const time = horaEl?.value
 if (!date || !time) {
  statusEl.textContent = "Informe data e hora para ver se está disponível."
  return
 }
 const duration = procDurationEl?.value ? Number(procDurationEl.value) : 60
 const procCatalogEl = document.getElementById("procCatalog")
 const procedureId = procCatalogEl?.value?.trim() || null
 statusEl.textContent = "Verificando…"
 try {
  const result = await checkProfessionalAvailableWithRespiro(profEl.value, date, time, duration, excludeAgendaId)
  if (result.disponivel) {
   statusEl.textContent = "Disponível neste horário (incluindo intervalo de descanso)."
   statusEl.className = "agenda-prof-status agenda-prof-ok"
  } else {
   const c = result.conflito
   const conflitoText = formatConflitoHtml(c)
   const disponiveisBtns = await buildDisponiveisButtons(date, time, duration, procedureId, profEl, dataEl, horaEl, procDurationEl, excludeAgendaId)
   statusEl.innerHTML = `<strong>Indisponível:</strong> ${conflitoText}. ${disponiveisBtns ? `<span class="agenda-prof-disponiveis-label">Disponíveis neste horário:</span> ${disponiveisBtns}` : ""}`
   statusEl.className = "agenda-prof-status agenda-prof-busy"
   statusEl.querySelectorAll(".agenda-prof-disponivel-btn").forEach((btn) => {
    btn.onclick = () => {
     profEl.value = btn.dataset.userId || ""
     refreshProfStatus(profEl, dataEl, horaEl, procDurationEl, excludeAgendaId)
    }
   })
  }
 } catch (e) {
  statusEl.textContent = ""
 }
}

async function refreshSalaStatus(salaEl, dataEl, horaEl, procDurationEl, excludeAgendaId = null) {
 const statusEl = document.getElementById("agendaSalaStatus")
 if (!statusEl || !salaEl?.value) {
  if (statusEl) statusEl.textContent = ""
  return
 }
 const date = dataEl?.value
 const time = horaEl?.value
 if (!date || !time) {
  statusEl.textContent = "Informe data e hora para verificar sala."
  return
 }
 const duration = procDurationEl?.value ? Number(procDurationEl.value) : 60
 statusEl.textContent = "Verificando…"
 try {
  const result = await checkSalaAvailable(salaEl.value, date, time, duration, excludeAgendaId)
  if (result.disponivel) {
   statusEl.textContent = "Sala disponível neste horário (incluindo tempo de organização)."
   statusEl.className = "agenda-sala-status agenda-sala-ok"
  } else {
   const c = result.conflito
   statusEl.innerHTML = `<strong>Sala ocupada:</strong> ${formatConflitoHtml(c, "de organização")}`
   statusEl.className = "agenda-sala-status agenda-sala-busy"
  }
 } catch (e) {
  statusEl.textContent = ""
 }
}


/* =====================
   PAINEL LATERAL (clique no horário ocupado)
===================== */

function closeSlotPanel(){
 if (!agendaPanelEl) return
 agendaPanelEl.classList.add("agenda-panel--hidden")
 agendaPanelEl.innerHTML = ""
 }

async function openSlotPanel(id){

 closeSlotPanel()
 if (!agendaPanelEl) ensureAgendaPanel()
 if (!agendaPanelEl) return

 try{

  const item = await getAgendaItemById(id)
  const isEvent = item.item_type === "event"
  const cliente = item.clientes || item.clients || {}
  const clientId = item.cliente_id || item.client_id

  let baixasJaRegistradas = []
  if (!isEvent && item.id) {
   try { baixasJaRegistradas = await getEntradasByAgendaId(item.id) } catch (_) {}
  }
  let protocolosDestaAgenda = []
  if (!isEvent && item.id) {
   try { protocolosDestaAgenda = await getProtocolosAplicadosByAgendaId(item.id) } catch (_) {}
  }
  const temBaixa = baixasJaRegistradas.length > 0
  const primeiraBaixa = baixasJaRegistradas[0]
  const valorBaixa = primeiraBaixa && (primeiraBaixa.valor_recebido != null && primeiraBaixa.valor_recebido !== "" ? Number(primeiraBaixa.valor_recebido) : Number(primeiraBaixa.valor))
  const dataBaixaFmt = primeiraBaixa && primeiraBaixa.data ? new Date(primeiraBaixa.data + "T12:00:00").toLocaleDateString("pt-BR") : ""
  const acao = proximaAcaoDoHorario(item, { temBaixa })
  const proximaHtml = !isEvent && !temBaixa
    ? `<div class="agenda-panel__proxima">
        <p class="agenda-panel__proxima-kicker">Próxima ação</p>
        <p class="agenda-panel__hint">${escapeHtml(acao.hint)}</p>
        ${acao.primary === "chegou" ? `<button type="button" class="btn-primary" id="agendaPanelBtnChegou">Chegou</button>` : ""}
        ${acao.primary === "atendimento" ? `<button type="button" class="btn-primary" id="agendaPanelBtnAtendimento">Em atendimento</button>` : ""}
        ${acao.primary === "baixa" ? `<button type="button" class="btn-primary agenda-panel__btn-protocolo" id="agendaPanelBtnProtocolo" title="Registrar o que foi aplicado nesta sessão">Registrar o que foi aplicado</button>
        <button type="button" class="btn-primary agenda-panel__btn-baixa" id="agendaPanelBtnBaixa" title="Registrar forma de pagamento e valor">Dar baixa (registrar pagamento)</button>` : ""}
      </div>`
    : ""
  const baixaRegistradaHtml = temBaixa
   ? `<div class="agenda-panel__baixa-ja-registrada">
       <p class="agenda-panel__baixa-ja-msg">Baixa já registrada${dataBaixaFmt ? ` em ${dataBaixaFmt}` : ""}: R$ ${(valorBaixa || 0).toFixed(2).replace(".", ",")}</p>
       ${baixasJaRegistradas.length > 1 ? `<p class="agenda-panel__baixa-ja-dup">Há ${baixasJaRegistradas.length} lançamentos para este agendamento. Exclua os duplicados em <strong>Financeiro</strong>.</p>` : ""}
       <a href="#" data-view="financeiro" class="agenda-panel__link-financeiro">Ver no Financeiro</a>
      </div>`
   : ""

  const membersPainel = await getOrgMembers().catch(() => [])
  const uidPainel = await agendaUserId()
  const nomeAplica = nomeMembroPorId(membersPainel, item.user_id, uidPainel)
  const nomeVendeu = nomeMembroPorId(membersPainel, item.sold_by_user_id, uidPainel)
  const papeisHtml = !isEvent && (nomeAplica || nomeVendeu)
    ? `<p class="agenda-panel__hint">${nomeVendeu && item.sold_by_user_id && item.sold_by_user_id !== item.user_id
      ? `Vendeu: ${escapeHtml(nomeVendeu)} · Aplica: ${escapeHtml(nomeAplica || "—")}`
      : (nomeAplica ? `Profissional: ${escapeHtml(nomeAplica)}` : "")}</p>`
    : ""

  let resumoHtml = ""
  if (!isEvent && clientId) {
   const resumo = await getClientAgendaResumo(clientId, item.id).catch(() => ({ anterior: null, atual: null, proximo: null }))
   const fmt = (r) => r ? `${r.data} ${r.hora} — ${(r.procedimento || "—").replace(/</g, "&lt;")}` : "—"
   resumoHtml = `
     <div class="agenda-panel__resumo" aria-label="Resumo do fluxo do cliente">
      <h4 class="agenda-panel__resumo-title">Resumo do fluxo (para melhor experiência)</h4>
      <p class="agenda-panel__resumo-line"><strong>Anterior:</strong> ${fmt(resumo.anterior)}</p>
      <p class="agenda-panel__resumo-line agenda-panel__resumo-atual"><strong>Hoje / Atual:</strong> ${fmt(resumo.atual)}</p>
      <p class="agenda-panel__resumo-line"><strong>Próximo:</strong> ${fmt(resumo.proximo)}</p>
     </div>`
  }

  agendaPanelEl.innerHTML = `
   <div class="agenda-panel__backdrop" id="agendaPanelBackdrop"></div>
   <div class="agenda-panel__content">
    <div class="agenda-panel__header">
     <h3>${isEvent ? (item.event_title || "Evento") : "Agendamento"}</h3>
     <button type="button" class="agenda-panel__close" id="agendaPanelClose" aria-label="Fechar">×</button>
    </div>
    <div class="agenda-panel__body">
     <p class="agenda-panel__meta">${item.data} às ${item.hora || ""}</p>
     ${isEvent
       ? `<p class="agenda-panel__event-type">${item.event_type || "—"}</p>`
       : `
     <p class="agenda-panel__client-label">Cliente</p>
     <p class="agenda-panel__client">${(cliente.nome || cliente.name || "—").replace(/</g, "&lt;")}</p>
     <p class="agenda-panel__procedure">${(item.procedimento || "—").replace(/</g, "&lt;")}</p>
     ${papeisHtml}
     ${item.plano_id && item.sessao_plano && item.sessoes_plano ? `<p class="agenda-panel__hint">Plano: sessão ${item.sessao_plano} de ${item.sessoes_plano}</p>` : ""}
     ${(cliente.telefone || cliente.phone) ? `<p class="agenda-panel__phone">${String(cliente.telefone || cliente.phone).replace(/</g, "&lt;")}</p>` : ""}
     ${resumoHtml}
    ${proximaHtml}
    ${baixaRegistradaHtml}
    ${protocolosDestaAgenda.length ? `<p class="agenda-panel__hint">Já há ${protocolosDestaAgenda.length} registro(s) de protocolo nesta sessão.</p>` : ""}
    <details class="agenda-panel__mais">
      <summary>Outras ações</summary>
      <p class="agenda-panel__hint">Anamnese e histórico completo: abra o perfil do cliente.</p>
      <button type="button" class="btn-secondary agenda-panel__btn-profile" id="agendaPanelBtnProfile">Abrir perfil do cliente (e Anamnese)</button>
      ${clientId ? `<button type="button" class="btn-secondary" id="agendaPanelBtnOrcamento">Orçamento</button>` : ""}
      ${acao.primary !== "baixa" ? `<button type="button" class="btn-secondary agenda-panel__btn-protocolo" id="agendaPanelBtnProtocolo" title="Registrar o que foi aplicado nesta sessão">Registrar o que foi aplicado</button>` : ""}
      ${!temBaixa && acao.primary !== "baixa" ? `<button type="button" class="btn-secondary agenda-panel__btn-baixa" id="agendaPanelBtnBaixa">Dar baixa (registrar pagamento)</button>` : ""}
      ${!isEvent && !temBaixa && acao.primary !== "chegou" ? `<button type="button" class="btn-secondary" id="agendaPanelBtnChegou">Chegou</button>` : ""}
      ${!isEvent && !temBaixa && acao.primary !== "atendimento" ? `<button type="button" class="btn-secondary" id="agendaPanelBtnAtendimento">Em atendimento</button>` : ""}
      ${!isEvent ? `<button type="button" class="btn-secondary" id="agendaPanelBtnCancelar">Cancelar horário</button>` : ""}
      <button type="button" class="btn-secondary" id="agendaPanelBtnReview">Pedir avaliação no Google</button>
    </details>
     `
     }
     <button type="button" class="btn-secondary agenda-panel__btn-edit" id="agendaPanelBtnEdit">Editar</button>
    </div>
   </div>
  `

  agendaPanelEl.classList.remove("agenda-panel--hidden")

  document.getElementById("agendaPanelBackdrop").onclick = closeSlotPanel
  document.getElementById("agendaPanelClose").onclick = closeSlotPanel

  const btnProfile = document.getElementById("agendaPanelBtnProfile")
  if (btnProfile && clientId) {
   btnProfile.onclick = () => {
    sessionStorage.setItem("clientePerfilId", clientId)
    sessionStorage.setItem("anamnese_agenda_id", item.id)
    sessionStorage.setItem("anamnese_client_id", clientId)
    sessionStorage.setItem("anamnese_procedimento", item.procedimento || "")
    closeSlotPanel()
    navigate("cliente-perfil")
   }
  }
  const btnOrcamento = document.getElementById("agendaPanelBtnOrcamento")
  if (btnOrcamento && clientId) {
   btnOrcamento.onclick = () => {
    sessionStorage.setItem("clientePerfilId", clientId)
    sessionStorage.setItem("clientePerfilOpenTab", "orcamentos")
    closeSlotPanel()
    navigate("cliente-perfil")
   }
  }
  const btnProtocolo = document.getElementById("agendaPanelBtnProtocolo")
  if (btnProtocolo && clientId && !isEvent) {
   btnProtocolo.onclick = async () => {
    closeSlotPanel()
    await openRegistrarProtocoloAgendaModal(item)
   }
  }

  document.getElementById("agendaPanelBtnEdit").onclick = () => {
   closeSlotPanel()
   openEditModal(id)
  }

  const btnBaixa = document.getElementById("agendaPanelBtnBaixa")
  if (btnBaixa && !isEvent) {
   btnBaixa.onclick = async () => {
    closeSlotPanel()
    await openDarBaixaModal(item)
   }
  }
  const btnCancelar = document.getElementById("agendaPanelBtnCancelar")
  if (btnCancelar && !isEvent) {
    btnCancelar.onclick = async () => {
      await cancelarHorarioComEspera(item)
    }
  }
  const bindEspera = (elId, phase) => {
    const b = document.getElementById(elId)
    if (!b || isEvent) return
    b.onclick = async () => {
      try {
        await markAgendaArrival(id, phase)
        toast(phase === "chegou" ? "Marcado como chegou." : "Em atendimento.")
        await openSlotPanel(id)
      } catch (err) {
        const msg = String(err?.message || err)
        if (/arrived_at|started_at|schema cache|column/i.test(msg)) {
          toast("Cole supabase-sala-espera-colar.sql no Supabase.")
          return
        }
        toast(msg || "Não foi possível atualizar a espera.")
      }
    }
  }
  bindEspera("agendaPanelBtnChegou", "chegou")
  bindEspera("agendaPanelBtnAtendimento", "em_atendimento")
  const btnReview = document.getElementById("agendaPanelBtnReview")
  if (btnReview && !isEvent) {
    btnReview.onclick = async () => {
      await pedirAvaliacaoGoogle(item)
    }
  }

  const linkFinanceiro = agendaPanelEl.querySelector(".agenda-panel__link-financeiro")
  if (linkFinanceiro) {
    linkFinanceiro.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeSlotPanel();
      navigate("financeiro");
    });
  }

 }catch(err){

  console.error("[AGENDA] erro painel", err)
  toast("Erro ao carregar detalhe")
 }
}


async function openEditModal(id){

 try{

  const { data, error } =
   await supabase
    .from("agenda")
    .select("*")
    .eq("id",id)
    .single()

  if(error || !data) return

  let clientes = []
  try {
   clientes = await listClientesForSelect()
  } catch (_) {
   clientes = []
  }

  const members = await getOrgMembers()
  const uidEdit = await agendaUserId()
  const profOptionsEdit = (members || []).map((m, i) => {
   const label = memberLabel(m, i, uidEdit)
   const sel = data.user_id === m.user_id ? " selected" : ""
   return `<option value="${m.user_id}"${sel}>${label}</option>`
  }).join("")

  // Carregar salas
  let salas = []
  try { salas = await listSalas() } catch (_) {}
  const salaOptionsEdit = (salas || []).map(s => {
   const sel = data.sala_id === s.id ? " selected" : ""
   return `<option value="${s.id}"${sel}>${(s.nome || "").replace(/</g, "&lt;")}</option>`
  }).join("")

  // Carregar config de respiro
  let config = { sala_obrigatoria: true, profissional_obrigatorio: true, respiro_sala_minutos: 10, respiro_profissional_minutos: 5 }
  try { config = await getAgendaConfig() } catch (_) {}

  let procedures = []
  try { procedures = await listProcedures(true) } catch (_) {}
  const procDuration = data.duration_minutes || 60
  const procCatalogOptionsEdit = "<option value=\"\">Texto livre</option>" + (procedures || []).map((p) => {
   const sel = data.procedure_id === p.id ? " selected" : ""
   return `<option value="${p.id}" data-name="${(p.name || "").replace(/"/g, "&quot;")}" data-duration="${p.duration_minutes || 60}"${sel}>${(p.name || "").replace(/</g, "&lt;")}</option>`
  }).join("")
  const procValue = (data.procedimento || "").replace(/"/g, "&quot;").replace(/</g, "&lt;")

  openModal(
   "Editar agendamento",

   `
    <label for="data">Data</label>
    <input type="date" id="data" value="${data.data}">

    <label for="hora">Hora</label>
    <input type="time" id="hora" value="${data.hora || ""}">

    <label for="procDuration">Duração (min)</label>
    <input type="number" id="procDuration" min="5" step="5" value="${procDuration}">

    <label for="sala">Sala/Cabine${config.sala_obrigatoria ? " *" : ""}</label>
    <select id="sala">
     <option value="">Selecione a sala…</option>
     ${salaOptionsEdit}
    </select>
    <p id="agendaSalaStatus" class="agenda-sala-status" aria-live="polite"></p>

    <label for="profissional">Profissional${config.profissional_obrigatorio ? " *" : ""}</label>
    <select id="profissional">
     <option value="">Selecione o profissional…</option>
     ${profOptionsEdit}
    </select>
    <p id="agendaProfStatus" class="agenda-prof-status" aria-live="polite"></p>
    ${htmlQuemVendeuSelect(members, uidEdit, data.sold_by_user_id || "")}

    <label for="cliente">Cliente</label>
    <select id="cliente">
     ${(clientes || []).map(c=>`
      <option value="${c.id}" data-modelo="${c.is_paciente_modelo ? "1" : "0"}" data-discount="${c.model_discount_pct != null ? c.model_discount_pct : ""}" ${c.id === data.cliente_id ? "selected" : ""}>${(c.nome || c.name || "").replace(/</g, "&lt;")}${c.is_paciente_modelo ? " (modelo)" : ""}</option>
     `).join("")}
    </select>
    <div id="agendaModeloWrapEdit" class="agenda-modelo-wrap hidden">
     <p class="agenda-modelo-title">Paciente modelo</p>
     <label><input type="checkbox" id="agendaAplicarDescontoModeloEdit" ${data.is_modelo_agendamento ? "checked" : ""}> Aplicar desconto modelo neste agendamento</label>
     <label for="agendaDescontoModeloPctEdit">Desconto neste agendamento (%)</label>
     <input type="number" id="agendaDescontoModeloPctEdit" min="0" max="100" step="0.5" value="${data.desconto_modelo_pct != null ? data.desconto_modelo_pct : ""}" placeholder="Ex.: 30">
    </div>

    <label for="procCatalog">Procedimento (catálogo)</label>
    <select id="procCatalog">${procCatalogOptionsEdit}</select>

    <label for="proc">Procedimento (nome ou texto livre)</label>
    <input id="proc" value="${procValue}">

    <div class="agenda-retorno-option">
     <label><input type="checkbox" id="agendaIsRetorno" ${data.is_retorno ? "checked" : ""}> Retorno (não gera receita)</label>
     <p class="agenda-retorno-hint">Marque para consultas de retorno (ex.: pós-botox). Não entra no faturamento previsto.</p>
    </div>

    <p class="agenda-modal-respiro-hint">
     <strong>Respiro automático:</strong> ${config.respiro_sala_minutos} min para sala, ${config.respiro_profissional_minutos} min para profissional.
     <br><small>Agenda pessoal (Google): só aparece ocupado, sem detalhes. O horário da clínica também ocupa o Google dele, com tempo de deslocamento.</small>
    </p>
   `,

   () => updateAgenda(id)
  )

  const clienteSelectEdit = document.getElementById("cliente")
  const modeloWrapEdit = document.getElementById("agendaModeloWrapEdit")
  const descontoModeloPctEditEl = document.getElementById("agendaDescontoModeloPctEdit")
  function updateModeloWrapEdit() {
   const opt = clienteSelectEdit?.selectedOptions?.[0]
   const isModelo = opt?.dataset?.modelo === "1"
   if (modeloWrapEdit) modeloWrapEdit.classList.toggle("hidden", !isModelo)
   if (isModelo && descontoModeloPctEditEl && opt?.dataset?.discount !== undefined && opt.dataset.discount !== "") {
    descontoModeloPctEditEl.value = opt.dataset.discount
   }
  }
  if (clienteSelectEdit) {
   clienteSelectEdit.addEventListener("change", updateModeloWrapEdit)
   updateModeloWrapEdit()
  }

  // Bind events para verificação em tempo real
  const dataEl = document.getElementById("data")
  const horaEl = document.getElementById("hora")
  const profEl = document.getElementById("profissional")
  const salaEl = document.getElementById("sala")
  const procDurationEl = document.getElementById("procDuration")

  if (profEl) profEl.onchange = () => refreshProfStatus(profEl, dataEl, horaEl, procDurationEl, id)
  if (salaEl) salaEl.onchange = () => refreshSalaStatus(salaEl, dataEl, horaEl, procDurationEl, id)
  if (dataEl) dataEl.addEventListener("change", () => {
   refreshProfStatus(profEl, dataEl, horaEl, procDurationEl, id)
   refreshSalaStatus(salaEl, dataEl, horaEl, procDurationEl, id)
  })
  if (horaEl) horaEl.addEventListener("change", () => {
   refreshProfStatus(profEl, dataEl, horaEl, procDurationEl, id)
   refreshSalaStatus(salaEl, dataEl, horaEl, procDurationEl, id)
  })

 }catch(err){

  console.error("[AGENDA] erro edit", err)
 }
}

async function cancelarHorarioComEspera(item) {
  if (!item?.id) return
  if (!confirm("Cancelar este horário? A vaga some da agenda. Se houver lista de espera, você escolhe se avisa no WhatsApp.")) return
  let espera = []
  try {
    espera = await listWaitlist("aberta")
  } catch (_) {
    espera = []
  }
  const matches = matchWaitlistToSlot(espera, {
    data: item.data,
    procedimento: item.procedimento,
  })
  try {
    await releaseAppointment(item.id)
  } catch (err) {
    const msg = String(err?.message || err)
    if (/cancelled_at|schema cache|column/i.test(msg)) {
      toast("O cancelamento precisa da coluna cancelled_at na agenda. Confira o SQL de confirmação.")
      return
    }
    toast(msg || "Não foi possível cancelar.")
    return
  }
  occupyProfessionalCalendar(item.id, "release").catch(() => {})
  await audit({
    action: "agenda.cancel",
    tableName: "agenda",
    recordId: item.id,
    permissionUsed: "agenda:manage",
    metadata: { espera_compativel: matches.length },
  }).catch(() => {})
  closeSlotPanel()
  renderAgenda()
  if (!matches.length) {
    toast("Horário cancelado. Ninguém compatível na lista de espera agora.")
    return
  }
  const profile = await getOrganizationProfile().catch(() => ({}))
  const clinic = profile?.name || "nossa clínica"
  const linhas = matches.slice(0, 5).map((w) => {
    const tel = String(w.phone || "").replace(/\D/g, "")
    const msg = filaWhatsappTemplate({
      name: w.nome,
      sinal: "espera",
      clinic,
      extra: `${item.data || ""} ${item.hora || ""}`.trim(),
    })
    const wa = tel.length >= 10
      ? `<button type="button" class="btn-secondary agenda-espera-wa" data-waitlist-id="${escapeAttr(w.id)}" data-client-id="${escapeAttr(w.client_id || "")}" data-phone="${escapeAttr(w.phone || "")}" data-msg="${escapeAttr(msg)}">Avisar ${escapeHtml(w.nome || "")}</button>`
      : `<span class="view-hint">${escapeHtml(w.nome || "")} sem telefone</span>`
    return `<li>${wa}</li>`
  }).join("")
  openModal(
    "Horário liberado — lista de espera",
    `<p class="agenda-baixa-hint">Há quem espera um horário nesta faixa. O WhatsApp só sai se você clicar. Nada é enviado sozinho.</p><ul class="agenda-espera-match">${linhas}</ul>`,
    () => closeModal(),
    null
  )
  bindAgendaEsperaWa()
}

function escapeAttr(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
}

async function pedirAvaliacaoGoogle(item, { silenciosoSeVazio = false } = {}) {
  const profile = await getOrganizationProfile().catch(() => ({}))
  const url = (profile?.google_review_url || "").trim()
  if (!url) {
    if (!silenciosoSeVazio) toast("Cadastre o link do Google em Empresa.")
    return
  }
  const cliente = item.clientes || item.clients || {}
  const nome = cliente.nome || cliente.name || ""
  const tel = cliente.telefone || cliente.phone || ""
  const msg = `Oi${nome ? `, ${nome}` : ""}! Obrigada pela visita. Se puder, avalia a gente no Google: ${url}`
  if (!String(tel).replace(/\D/g, "").length) {
    if (!silenciosoSeVazio) toast("Cliente sem telefone. Copie o link do Google em Empresa.")
    return
  }
  await sendWhatsapp(tel, msg, { origem: "agenda_avaliacao", clientId: item.cliente_id || item.client_id || "" })
  toast("Pedido de avaliação no WhatsApp.")
}

function receitaBaixaLinhaHtml(linha, nomesEstoque) {
  const skuOpts = ["<option value=\"\">— produto do estoque —</option>"]
    .concat((nomesEstoque || []).map((n) => {
      const sel = !linha.vaga && linha.nome && n === linha.nome ? " selected" : ""
      return `<option value="${escapeHtml(n)}"${sel}>${escapeHtml(n)}</option>`
    }))
    .join("")
  const titulo = linha.vaga
    ? `${escapeHtml(linha.papel || "item")} (escolhe no dia)`
    : escapeHtml(linha.nome || "Produto")
  const usa = linha.usa != null ? linha.usa : ""
  const rende = linha.rende != null ? linha.rende : ""
  const un = escapeHtml(labelUnidadeQtd(linha.unidade, linha.usa))
  return `<li class="protocolo-produto-line baixa-receita-line" data-vaga="${linha.vaga ? "1" : "0"}" data-unidade="${escapeHtml(linha.unidade || "un")}">
    <span class="baixa-receita-papel">${titulo}${un ? ` · ${un}` : ""}</span>
    <select class="baixa-receita-sku" aria-label="Produto">${skuOpts}</select>
    <label class="baixa-receita-mini">Usa<input type="number" class="baixa-receita-usa" min="0" step="any" value="${usa}" placeholder="Nesta ficha"></label>
    <label class="baixa-receita-mini">Cabe<input type="number" class="baixa-receita-rende" min="0" step="any" value="${rende}" placeholder="Embalagem"></label>
    <button type="button" class="btn-sm btn-remove-produto" aria-label="Remover">×</button>
  </li>`
}

function preencherReceitaNaLista(listEl, usage, nomesEstoque) {
  if (!listEl) return
  const linhas = (usage || []).map((u) => linhaBaixaFromUsage(u)).filter((l) => l.vaga || l.nome)
  if (!linhas.length) return
  listEl.insertAdjacentHTML("afterbegin", linhas.map((l) => receitaBaixaLinhaHtml(l, nomesEstoque)).join(""))
  listEl.querySelectorAll(".btn-remove-produto").forEach((btn) => {
    btn.onclick = () => btn.closest("li")?.remove()
  })
}

async function garantirAplicadoNoProntuario(item, { produtos = [], observacao = "", intercorrencia = "" } = {}) {
  const clientId = item.client_id || item.cliente_id || item.clients?.id
  if (!clientId) return false
  const ja = await getProtocolosAplicadosByAgendaId(item.id).catch(() => [])
  if (ja && ja.length) return false
  const inter = String(intercorrencia || "").trim()
  const obs = [String(observacao || "").trim(), inter ? `Intercorrência: ${inter}` : ""].filter(Boolean).join("\n")
  const descricao = String(item.procedimento || "Procedimento").trim()
  await createProtocoloAplicado({
    clientId,
    agendaId: item.id,
    descricao,
    observacao: obs || undefined,
    aplicado_em: item.data ? `${item.data}T12:00:00.000Z` : undefined,
    produtos_usados: produtos,
  })
  return true
}

async function registrarEventoSessaoProntuario(item, { produtos = [], intercorrencia = "" } = {}) {
  const clientId = item.client_id || item.cliente_id || item.clients?.id
  if (!clientId) return
  const payload = payloadSessaoProntuario({
    procedimento: item.procedimento,
    produtos,
    intercorrencia,
    agendaId: item.id,
    procedureId: item.procedure_id,
  })
  if (!payload) return
  await createClientEvent({ client_id: clientId, ...payload })
}

function collectReceitaBaixaLinhas(root) {
  const out = []
  root?.querySelectorAll(".baixa-receita-line").forEach((li) => {
    const sku = (li.querySelector(".baixa-receita-sku")?.value || "").trim()
    if (!sku) return
    const usa = Number(li.querySelector(".baixa-receita-usa")?.value)
    const rende = Number(li.querySelector(".baixa-receita-rende")?.value)
    const q = quantidadeConsumoBaixa({ usa, rende })
    if (q == null) return
    out.push({ produto_nome: sku, quantidade: q })
  })
  return out
}

/** Modal "Dar baixa": valor vem do procedimento (agenda); acréscimo só se produto a mais / outro procedimento. Opção de descontar 1 sessão de pacote. */
async function openRegistrarProtocoloAgendaModal(item) {
  const clientId = item.cliente_id || item.client_id
  if (!clientId) {
    toast("Este agendamento não tem cliente.")
    return
  }
  const cliente = item.clientes || item.clients || {}
  const nomeCliente = escapeHtml(cliente.nome || cliente.name || "Cliente")
  const dataAtend = item.data || getTodayStr()

  let protocolos = []
  let produtosEstoque = []
  let jaAplicados = []
  let usageReceita = []
  try { protocolos = await getProtocolos() } catch (_) {}
  try {
    const resumo = await getResumoPorProduto()
    produtosEstoque = (resumo || []).map((r) => (r.produto_nome || "").trim()).filter(Boolean).sort((a, b) => a.localeCompare(b))
  } catch (_) {}
  try { jaAplicados = await getProtocolosAplicadosByAgendaId(item.id) } catch (_) {}
  if (item.procedure_id) {
    try { usageReceita = await getProcedureStockUsage(item.procedure_id) } catch (_) { usageReceita = [] }
  }

  const hist = jaAplicados.length
    ? `<ul class="protocolo-produtos-list">${jaAplicados.map((a) => {
        const nome = a.protocolos?.nome || a.descricao || "Registro"
        const quando = a.aplicado_em ? new Date(a.aplicado_em).toLocaleString("pt-BR") : ""
        return `<li>${escapeHtml(nome)}${quando ? ` — ${escapeHtml(quando)}` : ""}</li>`
      }).join("")}</ul>`
    : "<p class=\"agenda-baixa-hint\">Nenhum registro nesta sessão ainda.</p>"

  openModal(
    "Registrar o que foi aplicado",
    `
    <p class="agenda-baixa-hint">Sessão de <strong>${nomeCliente}</strong> em ${escapeHtml(dataAtend)}. A receita desta ficha vem preenchida; você confirma ou altera no dia. Vaga sem produto não baixa estoque. O sistema não bloqueia se o estoque estiver baixo.</p>
    <p class="agenda-baixa-hint">Já nesta sessão:</p>
    ${hist}
    <label for="agendaProtocoloDescricao">O que foi feito</label>
    <textarea id="agendaProtocoloDescricao" rows="3" placeholder="Ex.: limpeza, áreas aplicadas, técnica…">${escapeHtml(item.procedimento || "")}</textarea>
    <label>Produtos utilizados (estoque)</label>
    <div class="protocolo-produtos-add">
      <select id="agendaProtocoloProdutoSelect">
        <option value="">— Selecione um produto —</option>
        ${produtosEstoque.map((nome) => `<option value="${escapeHtml(nome)}">${escapeHtml(nome)}</option>`).join("")}
      </select>
      <input type="number" id="agendaProtocoloProdutoQty" min="0.01" step="0.01" value="1" style="width:4rem;">
      <button type="button" class="btn-secondary" id="agendaProtocoloAddProduto">Adicionar</button>
    </div>
    <ul id="agendaProtocoloProdutosList" class="protocolo-produtos-list"></ul>
    <label for="agendaProtocoloSelect">Protocolo cadastrado (opcional)</label>
    <select id="agendaProtocoloSelect">
      <option value="">— Nenhum —</option>
      ${protocolos.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nome)}</option>`).join("")}
    </select>
    <p class="agenda-baixa-hint">Se escolher um protocolo, os descartáveis cadastrados entram no consumo estimado (sem bloquear o atendimento).</p>
    <label for="agendaProtocoloObservacao">Observação (opcional)</label>
    <textarea id="agendaProtocoloObservacao" rows="2" placeholder="Ex.: área, reação…"></textarea>
    <label for="agendaProtocoloIntercorrencia">Intercorrência nesta sessão (opcional)</label>
    <textarea id="agendaProtocoloIntercorrencia" rows="2" placeholder="Reação, efeito adverso, o que ficou registrado na ficha"></textarea>
    <p class="agenda-baixa-hint">Isso vai para o prontuário do paciente (histórico e respaldo). Não some no próximo procedimento.</p>
    <p class="agenda-baixa-hint"><button type="button" class="btn-link" id="agendaProtocoloAbrirFicha">Abrir ficha completa do cliente</button></p>
    `,
    () => submitRegistrarProtocoloAgenda(item)
  )

  preencherReceitaNaLista(document.getElementById("agendaProtocoloProdutosList"), usageReceita, produtosEstoque)

  document.getElementById("agendaProtocoloAddProduto")?.addEventListener("click", (e) => {
    e.preventDefault()
    const sel = document.getElementById("agendaProtocoloProdutoSelect")
    const qtyEl = document.getElementById("agendaProtocoloProdutoQty")
    const listEl = document.getElementById("agendaProtocoloProdutosList")
    const nome = (sel?.value || "").trim()
    if (!nome) {
      toast("Selecione um produto")
      return
    }
    const qty = Math.max(0.01, parseFloat(qtyEl?.value) || 1)
    const li = document.createElement("li")
    li.className = "protocolo-produto-line"
    li.dataset.produto = nome
    li.dataset.quantidade = String(qty)
    li.innerHTML = `<span>${escapeHtml(nome)} × ${qty}</span> <button type="button" class="btn-sm btn-remove-produto" title="Remover">×</button>`
    li.querySelector(".btn-remove-produto")?.addEventListener("click", () => li.remove())
    listEl?.appendChild(li)
    if (sel) sel.value = ""
    if (qtyEl) qtyEl.value = "1"
  })

  document.getElementById("agendaProtocoloAbrirFicha")?.addEventListener("click", (e) => {
    e.preventDefault()
    sessionStorage.setItem("clientePerfilId", clientId)
    sessionStorage.setItem("clientePerfilOpenTab", "protocolo")
    sessionStorage.setItem("clientePerfilAgendaId", item.id)
    closeModal()
    navigate("cliente-perfil")
  })
}

async function submitRegistrarProtocoloAgenda(item) {
  const clientId = item.cliente_id || item.client_id
  const protocoloId = document.getElementById("agendaProtocoloSelect")?.value?.trim() || null
  const descricao = document.getElementById("agendaProtocoloDescricao")?.value?.trim() || ""
  const observacao = document.getElementById("agendaProtocoloObservacao")?.value?.trim() || ""
  const intercorrencia = document.getElementById("agendaProtocoloIntercorrencia")?.value?.trim() || ""
  const produtos_usados = collectReceitaBaixaLinhas(document.getElementById("agendaProtocoloProdutosList"))
  document.getElementById("agendaProtocoloProdutosList")?.querySelectorAll(".protocolo-produto-line:not(.baixa-receita-line)").forEach((li) => {
    const nome = (li.dataset.produto || "").trim()
    if (nome) produtos_usados.push({ produto_nome: nome, quantidade: parseFloat(li.dataset.quantidade) || 1 })
  })
  if (!protocoloId && !descricao && produtos_usados.length === 0) {
    toast("Informe o que foi feito, um produto ou um protocolo.")
    return
  }
  try {
    if (protocoloId) {
      const { alertas } = await getAlertaEstoqueProtocolo(protocoloId).catch(() => ({ alertas: [] }))
      if (alertas.length > 0) {
        const msg = alertas.map((a) => `${a.produto_nome} (precisa ${a.quantidade_necessaria}, saldo ${a.saldo_estimado})`).join("; ")
        toast(`Estoque baixo (não bloqueia): ${msg}`, "warning")
      }
    }
    const aplicado_em = item.data ? `${item.data}T12:00:00.000Z` : undefined
    const obs = [observacao, intercorrencia ? `Intercorrência: ${intercorrencia}` : ""].filter(Boolean).join("\n")
    const salvo = await createProtocoloAplicado({
      clientId,
      protocoloId: protocoloId || undefined,
      agendaId: item.id,
      observacao: obs || undefined,
      descricao: descricao || item.procedimento || "Procedimento",
      aplicado_em,
      produtos_usados,
    })
    try {
      await registrarEventoSessaoProntuario(item, { produtos: produtos_usados, intercorrencia })
    } catch (e) {
      console.warn("[AGENDA] evento prontuario", e)
    }
    closeModal()
    if (salvo?.consumo_erros?.length) {
      toast("Prontuário salvo. O estoque não baixou: " + salvo.consumo_erros.join("; "), "warning")
    } else {
      toast("Registro salvo no prontuário desta sessão.")
    }
    const jaTemBaixa = await getEntradasByAgendaId(item.id).then((r) => r.length > 0).catch(() => false)
    if (!jaTemBaixa && !item.is_retorno) {
      await openDarBaixaModal(item)
    } else if (clientId) {
      sessionStorage.setItem("clientePerfilId", clientId)
      sessionStorage.setItem("clientePerfilOpenTab", "protocolo")
      navigate("cliente-perfil")
    }
  } catch (err) {
    console.error("[AGENDA] protocolo aplicado", err)
    toast(err?.message || "Erro ao registrar")
  }
}

async function openDarBaixaModal(item) {
  const jaTemBaixa = await getEntradasByAgendaId(item.id).then((r) => r.length > 0).catch(() => false)
  let jaConsumiuPacote = false
  try {
    const { data } = await supabase.from("package_consumptions").select("id").eq("agenda_id", item.id).limit(1)
    jaConsumiuPacote = !!(data && data.length)
  } catch (_) {}
  if (jaTemBaixa || jaConsumiuPacote) {
    toast("Este agendamento já teve baixa ou sessão de pacote. Abra o agendamento ou o Financeiro para conferir.")
    return
  }

  const clientId = item.client_id || item.cliente_id || item.clients?.id
  const cliente = item.clientes || item.clients || {}
  const nomeCliente = (cliente.nome || cliente.name || "Cliente").replace(/"/g, "&quot;").replace(/</g, "&lt;")
  const procedimento = (item.procedimento || "Procedimento").replace(/"/g, "&quot;").replace(/</g, "&lt;")
  const dataHoje = new Date().toISOString().split("T")[0]
  const descricaoSugerida = `Agenda: ${nomeCliente} – ${procedimento} (${item.data || ""})`

  let pacotesComSaldo = []
  if (clientId) {
    try { pacotesComSaldo = await listPacotesComSaldoByClient(clientId) } catch (_) {}
  }
  const sugerido = sugerirPacoteNaAgenda(item.procedure_id, pacotesComSaldo)
  const blocoPacote = pacotesComSaldo.length > 0
    ? `
    <div class="agenda-baixa-pacote-wrap">
      <label for="baixaPacoteId">Pacote (desconta 1 sessão; não cobra o preço cheio de novo)</label>
      <select id="baixaPacoteId">
        <option value="">Não usar pacote — cobrar o procedimento</option>
        ${pacotesComSaldo.map((p) => {
          const sel = sugerido && p.id === sugerido ? " selected" : ""
          const pago = p.valor_pago != null ? String(p.valor_pago) : ""
          return `<option value="${p.id}" data-valor-pago="${pago}" data-sessoes="${p.total_sessoes || 1}" data-custo="${p.custo_material_estimado != null ? p.custo_material_estimado : ""}" data-comissao="${p.comissao_profissional_pct != null ? p.comissao_profissional_pct : ""}" data-margem-alvo="${p.margem_minima_desejada != null ? p.margem_minima_desejada : ""}"${sel}>${(p.nome_pacote || "Pacote").replace(/</g, "&lt;")} — ${p.sessoes_restantes} restantes</option>`
        }).join("")}
      </select>
    </div>
    `
    : ""

  let procedure = null
  let custoRealInfo = { custoReal: null, incompleto: false }
  let taxasOrg = null
  let usageReceita = []
  let produtosEstoque = []
  let custosMap = {}
  if (item.procedure_id) {
    try { procedure = await getProcedure(item.procedure_id) } catch (_) {}
    try { custoRealInfo = await getCustoRealProcedimento(item.procedure_id) } catch (_) {}
    try { usageReceita = await getProcedureStockUsage(item.procedure_id) } catch (_) { usageReceita = [] }
  }
  try {
    const resumo = await getResumoPorProduto()
    produtosEstoque = (resumo || []).map((r) => (r.produto_nome || "").trim()).filter(Boolean).sort((a, b) => a.localeCompare(b))
    custosMap = custoMedioPorNomeFromResumo(resumo)
  } catch (_) {}
  try { taxasOrg = await getTaxas() } catch (_) { taxasOrg = null }
  let valorProcedimento = procedure?.valor_cobrado != null && procedure?.valor_cobrado !== "" ? Number(procedure.valor_cobrado) : null
  if (valorProcedimento != null && item.is_modelo_agendamento && item.desconto_modelo_pct != null) {
    valorProcedimento = valorProcedimento * (1 - Number(item.desconto_modelo_pct) / 100)
  }
  const valorProcedimentoFmt = valorProcedimento != null ? valorProcedimento.toFixed(2).replace(".", ",") : ""

  const temValorProcedimento = valorProcedimento != null && valorProcedimento > 0
  const blocoValor = temValorProcedimento
    ? `
    <p class="agenda-baixa-valor-proc">Valor do procedimento: <strong>R$ ${valorProcedimentoFmt}</strong></p>
    <label for="baixaAcrescimo">Acréscimo (opcional)</label>
    <input type="number" id="baixaAcrescimo" step="0.01" min="0" value="" placeholder="Produto a mais, outro procedimento…">
    <p class="agenda-baixa-total-wrap">Valor total: <strong id="baixaValorTotal">R$ ${valorProcedimentoFmt}</strong></p>
    <input type="hidden" id="baixaValorProcedimento" value="${valorProcedimento}">
    `
    : `
    <label for="baixaValorTotalInput">Valor total (R$)</label>
    <input type="number" id="baixaValorTotalInput" step="0.01" min="0" required placeholder="Procedimento sem valor cadastrado">
    <input type="hidden" id="baixaValorProcedimento" value="">
    `

  openModal(
    "Dar baixa — Registrar pagamento",
    `
    <p class="agenda-baixa-hint">Cliente e procedimento vêm da agenda. O que confirmar nos materiais entra no prontuário da ficha. Se usar pacote, o financeiro registra o valor da sessão, não o preço cheio. Vaga sem produto não baixa. Simular desconto não muda o catálogo.</p>
    <div id="baixaReceitaWrap" class="agenda-baixa-receita"${usageReceita.length ? "" : " hidden"}>
      <p class="agenda-baixa-hint"><strong>Materiais desta sessão</strong> (desta ficha; editável — vai para o prontuário)</p>
      <ul id="baixaReceitaList" class="protocolo-produtos-list"></ul>
    </div>
    <label for="baixaIntercorrencia">Intercorrência nesta sessão (opcional)</label>
    <textarea id="baixaIntercorrencia" rows="2" placeholder="Reação ou efeito adverso — fica na ficha para o próximo procedimento"></textarea>
    ${blocoPacote}
    <p id="baixaEconomiaHint" class="agenda-baixa-economia"></p>
    <label for="baixaDesc">Descrição</label>
    <input type="text" id="baixaDesc" value="${descricaoSugerida}" placeholder="Ex.: Agenda: Cliente – Procedimento">
    ${blocoValor}
    <label for="baixaFormaPagamento">Forma de pagamento</label>
    <select id="baixaFormaPagamento">
      <option value="">—</option>
      <option value="pix">PIX</option>
      <option value="cartao_credito">Cartão crédito</option>
      <option value="cartao_debito">Cartão débito</option>
      <option value="dinheiro">Dinheiro</option>
      <option value="transferencia">Transferência</option>
      <option value="boleto">Boleto</option>
      <option value="outro">Outro</option>
    </select>
    <div class="agenda-baixa-simulacao">
      <p class="agenda-baixa-hint">Simulação (só leitura): desconto e crédito parcelado com as taxas da clínica.</p>
      <label for="baixaSimDesconto">Desconto simulado (%)</label>
      <input type="number" id="baixaSimDesconto" min="0" max="100" step="0.5" value="0">
      <label for="baixaSimParcelas">Se fosse crédito em</label>
      <select id="baixaSimParcelas">
        ${[1,2,3,4,5,6,7,8,9,10,11,12].map((n) => `<option value="${n}">${n}x</option>`).join("")}
      </select>
      <p id="baixaSimulacaoHint" class="agenda-baixa-simulacao-txt"></p>
    </div>
    <label for="baixaValorRecebido">Valor recebido (quanto entrou de fato)</label>
    <input type="number" id="baixaValorRecebido" step="0.01" min="0" placeholder="Vazio = mesmo que o valor total">
    <label for="baixaData">Data do recebimento</label>
    <input type="date" id="baixaData" value="${dataHoje}" required>
    <input type="hidden" id="baixaTemValorProcedimento" value="${temValorProcedimento ? "1" : "0"}">
    `,
    () => submitDarBaixa(item)
  )

  preencherReceitaNaLista(document.getElementById("baixaReceitaList"), usageReceita, produtosEstoque)

  const pacoteEl = document.getElementById("baixaPacoteId")
  const economiaEl = document.getElementById("baixaEconomiaHint")
  const simEl = document.getElementById("baixaSimulacaoHint")
  const custoEscolhido = () => {
    const opt = pacoteEl?.selectedOptions?.[0]
    const estimadoPacote = opt?.dataset?.custo === "" ? null : opt?.dataset?.custo
    const estimadoProc = procedure?.custo_material_estimado
    const estimado = estimadoPacote != null && estimadoPacote !== "" ? estimadoPacote : estimadoProc
    const linhas = collectReceitaBaixaLinhas(document.getElementById("baixaReceitaList"))
    if (linhas.length) {
      const dia = custoRealFromBaixaLinhas(linhas, custosMap)
      return escolherCustoMaterial({
        real: dia.custoReal,
        incompleto: dia.incompleto,
        estimado,
        fonteReal: "sessao",
      })
    }
    return escolherCustoMaterial({
      real: custoRealInfo?.custoReal,
      incompleto: custoRealInfo?.incompleto,
      estimado,
    })
  }
  const taxaFormaAtual = () => {
    const forma = document.getElementById("baixaFormaPagamento")?.value || ""
    if (!taxasOrg) return 0
    if (forma === "cartao_debito") return getTaxaForParcelas(taxasOrg, 1, "debito")
    if (forma === "cartao_credito") {
      const n = Number(document.getElementById("baixaSimParcelas")?.value) || 1
      return getTaxaForParcelas(taxasOrg, n, "credito")
    }
    return 0
  }
  const refreshBaixaNumeros = () => {
    const opt = pacoteEl?.selectedOptions?.[0]
    const pacoteId = pacoteEl?.value?.trim() || ""
    const ac = Number(document.getElementById("baixaAcrescimo")?.value) || 0
    const base = Number(document.getElementById("baixaValorProcedimento")?.value) || valorProcedimento || 0
    const manual = Number(document.getElementById("baixaValorTotalInput")?.value) || 0
    const valor = valorFinanceiroNaBaixa({
      pacoteId: pacoteId || null,
      valorProcedimento: temValorProcedimento ? base : manual,
      acrescimo: ac,
      valorPagoPacote: opt?.dataset?.valorPago,
      totalSessoes: opt?.dataset?.sessoes,
    })
    const totalEl = document.getElementById("baixaValorTotal")
    if (totalEl) totalEl.textContent = "R$ " + Number(valor).toFixed(2).replace(".", ",")
    const custo = custoEscolhido()
    const comissaoPct = (opt?.dataset?.comissao != null && opt?.dataset?.comissao !== ""
      ? opt.dataset.comissao
      : procedure?.comissao_profissional_pct) ?? taxasOrg?.comissao_profissional_padrao_pct
    const margemAlvo = (opt?.dataset?.margemAlvo != null && opt?.dataset?.margemAlvo !== ""
      ? opt.dataset.margemAlvo
      : procedure?.margem_minima_desejada) ?? taxasOrg?.margem_alvo_padrao_pct
    const eco = economiaAtendimento({
      receita: valor,
      custoMaterial: custo.valor,
      fonteCusto: custo.fonte,
      comissaoPct,
      taxaPct: taxaFormaAtual(),
      margemAlvoPct: margemAlvo,
    })
    if (economiaEl) {
      economiaEl.textContent = textoEconomiaAtendimento(eco)
      economiaEl.classList.toggle("agenda-baixa-economia--alerta", !!eco.abaixoAlvo)
    }
    const desc = Number(document.getElementById("baixaSimDesconto")?.value) || 0
    const nParc = Number(document.getElementById("baixaSimParcelas")?.value) || 1
    const taxaSim = taxasOrg ? getTaxaForParcelas(taxasOrg, nParc, "credito") : 0
    const sim = simularDescontoParcela({ receita: valor, descontoPct: desc, taxaPct: taxaSim })
    if (simEl) simEl.textContent = textoSimulacaoBaixa(sim)
  }
  document.getElementById("baixaAcrescimo")?.addEventListener("input", refreshBaixaNumeros)
  document.getElementById("baixaAcrescimo")?.addEventListener("change", refreshBaixaNumeros)
  document.getElementById("baixaValorTotalInput")?.addEventListener("input", refreshBaixaNumeros)
  document.getElementById("baixaFormaPagamento")?.addEventListener("change", refreshBaixaNumeros)
  document.getElementById("baixaSimDesconto")?.addEventListener("input", refreshBaixaNumeros)
  document.getElementById("baixaSimParcelas")?.addEventListener("change", refreshBaixaNumeros)
  pacoteEl?.addEventListener("change", refreshBaixaNumeros)
  document.getElementById("baixaReceitaList")?.addEventListener("input", refreshBaixaNumeros)
  document.getElementById("baixaReceitaList")?.addEventListener("change", refreshBaixaNumeros)
  refreshBaixaNumeros()
}

async function submitDarBaixa(item) {
  const descEl = document.getElementById("baixaDesc")
  const formaEl = document.getElementById("baixaFormaPagamento")
  const valorRecebidoEl = document.getElementById("baixaValorRecebido")
  const dataEl = document.getElementById("baixaData")
  const temValorProcedimento = document.getElementById("baixaTemValorProcedimento")?.value === "1"

  const pacoteEl = document.getElementById("baixaPacoteId")
  const pacoteId = pacoteEl?.value?.trim() || ""
  const opt = pacoteEl?.selectedOptions?.[0]
  const ac = temValorProcedimento ? Number(document.getElementById("baixaAcrescimo")?.value) || 0 : 0
  const baseProc = temValorProcedimento
    ? Number(document.getElementById("baixaValorProcedimento")?.value) || 0
    : Number(document.getElementById("baixaValorTotalInput")?.value) || 0
  const valor = valorFinanceiroNaBaixa({
    pacoteId: pacoteId || null,
    valorProcedimento: temValorProcedimento ? Number(document.getElementById("baixaValorProcedimento")?.value) : baseProc,
    acrescimo: ac,
    valorPagoPacote: opt?.dataset?.valorPago,
    totalSessoes: opt?.dataset?.sessoes,
  })

  if (!pacoteId && (valor <= 0 || isNaN(valor))) {
    toast("Valor total deve ser maior que zero.")
    return
  }

  const descricao = (descEl?.value || "").trim() || `Agenda: ${item.clientes?.name || item.clients?.name || "Cliente"} – ${item.procedimento || "Procedimento"}`

  const orgId = getActiveOrg()
  if (!orgId) {
    toast("Selecione uma organização.")
    return
  }

  try {
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      org_id: orgId,
      user_id: user?.id ?? null,
      tipo: "entrada",
      descricao,
      valor,
      data: dataEl?.value || getTodayStr(),
    }
    if (item.procedure_id) payload.procedure_id = item.procedure_id
    if (item.id) payload.agenda_id = item.id
    if (formaEl?.value) payload.forma_pagamento = formaEl.value
    const vr = valorRecebidoEl?.value?.trim()
    if (vr !== "" && vr != null && !isNaN(Number(vr))) payload.valor_recebido = Number(vr)

    if (valor > 0) {
      await createLancamento(payload)
    }

    let extraEstoque = ""
    try {
      const jaAplicados = await getProtocolosAplicadosByAgendaId(item.id).catch(() => [])
      const linhas = collectReceitaBaixaLinhas(document.getElementById("baixaReceitaList"))
      if (linhas.length && !(jaAplicados && jaAplicados.length)) {
        const erros = []
        for (const p of linhas) {
          try {
            await registrarConsumoEstimado({
              produto_nome: p.produto_nome,
              quantidade: p.quantidade,
              agenda_id: item.id,
              procedure_id: item.procedure_id,
              tipo: "estimado",
            })
          } catch (e) {
            erros.push(`${p.produto_nome}: ${e?.message || "não gravou"}`)
          }
        }
        extraEstoque = erros.length
          ? " Estoque: " + erros.join("; ")
          : " Materiais da ficha baixados no estoque (quantidade confirmada)."
      }
    } catch (_) {}

    let extraProntuario = ""
    try {
      const produtosPront = collectReceitaBaixaLinhas(document.getElementById("baixaReceitaList"))
      const intercorrencia = document.getElementById("baixaIntercorrencia")?.value?.trim() || ""
      const criou = await garantirAplicadoNoProntuario(item, { produtos: produtosPront, intercorrencia })
      if (criou || intercorrencia) {
        await registrarEventoSessaoProntuario(item, { produtos: produtosPront, intercorrencia })
      }
      extraProntuario = " Registro na ficha do paciente."
    } catch (e) {
      console.warn("[AGENDA] prontuario sessao", e)
      extraProntuario = " Não gravou no prontuário: " + (e?.message || "abra a ficha do paciente.")
    }

    const aberto = previstoVsRealizado({ valor, valorRecebido: payload.valor_recebido })
    const extraAberto = aberto.emAberto
      ? ` Ficou em aberto R$ ${aberto.aberto.toFixed(2).replace(".", ",")}. Não lança outra entrada sozinha.`
      : ""
    let extraEco = ""
    if (pacoteId) {
      extraEco = " " + textoEconomiaSessao(economiaSessaoPacote({
        valorPagoPacote: opt?.dataset?.valorPago,
        totalSessoes: opt?.dataset?.sessoes,
        acrescimo: ac,
        custoMaterialSessao: opt?.dataset?.custo === "" ? null : opt?.dataset?.custo,
        comissaoPct: opt?.dataset?.comissao,
        margemAlvoPct: opt?.dataset?.margemAlvo,
      }))
    }

    let sessoesRestantes = 0
    if (pacoteId) {
      try {
        const cons = await consumirSessao(pacoteId, item.id)
        sessoesRestantes = cons.sessoes_restantes ?? 0
        toast((cons.already
          ? "Esta sessão do pacote já tinha sido descontada neste horário."
          : (valor > 0 ? "Sessão do pacote descontada e valor da sessão no financeiro." : "Sessão do pacote descontada.")) + extraAberto + extraEco + extraEstoque + extraProntuario)
      } catch (e) {
        console.warn("[AGENDA] consumirSessao", e)
        toast("Erro ao descontar sessão do pacote: " + (e?.message || "tente no perfil do cliente."))
      }
    } else {
      toast("Pagamento registrado. Entrada criada no Financeiro." + extraAberto + extraEstoque + extraProntuario)
    }

    await audit({
      action: "financeiro.create",
      tableName: "financeiro",
      recordId: null,
      permissionUsed: "financeiro:manage",
      metadata: { origem: "agenda_baixa", agenda_id: item.id, valor, pacote_id: pacoteId || null },
    }).catch(() => {})

    closeModal()
    renderAgenda()
    await pedirAvaliacaoGoogle(item, { silenciosoSeVazio: true })
    oferecerCombinadoAposBaixa(item, sessoesRestantes)
  } catch (err) {
    console.error("[AGENDA] submitDarBaixa", err)
    toast(err?.message || "Erro ao registrar pagamento.")
  }
}

function oferecerCombinadoAposBaixa(item, sessoesRestantes) {
  const clientId = item.client_id || item.cliente_id || item.clients?.id
  const depois = () => oferecerProximaSessaoAposBaixa(item, sessoesRestantes)
  if (!clientId) {
    depois()
    return
  }
  openModal(
    "Combinado da consulta (opcional)",
    `
    <p class="agenda-baixa-hint">Só o que ficou combinado, em poucas linhas. Não cole rascunho de IA. WhatsApp não sai daqui.</p>
    <label for="combinadoTexto">O que combinamos</label>
    <textarea id="combinadoTexto" rows="3" maxlength="400" placeholder="Ex.: retorno em 15 dias; manter hidratação"></textarea>
    <label for="combinadoRetorno">Retorno sugerido (opcional)</label>
    <input type="date" id="combinadoRetorno">
    `,
    async () => {
      const payload = payloadCombinadoConsulta({
        proximoPasso: document.getElementById("combinadoTexto")?.value,
        retornoEm: document.getElementById("combinadoRetorno")?.value,
        agendaId: item.id,
      })
      if (payload) {
        try {
          await createClientEvent({ client_id: clientId, ...payload })
          toast("Combinado no prontuário.")
        } catch (e) {
          toast(e?.message || "Não foi possível gravar o combinado.")
        }
      }
      closeModal()
    },
    depois
  )
}

async function oferecerProximaSessaoAposBaixa(item, sessoesRestantes) {
  const clientId = item.client_id || item.cliente_id || item.clients?.id
  if (!clientId) return
  let temAgendaFutura = false
  try {
    const resumo = await getClientAgendaResumo(clientId, item.id)
    temAgendaFutura = !!(resumo?.proximo)
  } catch (_) {}
  const sug = sugerirProximaAcaoNaBaixa({
    sessoesRestantes,
    temAgendaFutura,
    dataAtual: item.data || getTodayStr(),
  })
  if (!sug.oferecer) return
  const quando = sug.dataSugerida || ""
  const msg = `${sug.titulo} Sugerimos ${quando || "a próxima semana"}, mesmo horário. Confirmar abre o agendamento — WhatsApp não sai sozinho.`
  openConfirmModal("Marcar a próxima sessão?", msg, () => {
    openCreateModal({
      date: sug.dataSugerida || getTodayStr(),
      hora: String(item.hora || "").slice(0, 5),
      clientId,
      procedureId: item.procedure_id || "",
      procedimento: item.procedimento || "",
      professionalId: item.user_id || "",
    })
  })
}

async function insertAgendaRow(payload) {
  const { data, error } = await retryUnknownColumns(
    payload,
    (row) => supabase.from("agenda").insert(row).select("id").single(),
    { immutable: ["org_id", "data", "hora", "procedimento"] }
  )
  if (error) throw error
  if (data?.id && payload.user_id) {
    occupyProfessionalCalendar(data.id).then((r) => {
      if (r?.needs_reconnect) toast("Este profissional precisa reconectar o Google. A clínica não vê o título dos compromissos pessoais.")
    }).catch(() => {})
  }
  return data
}

/* =====================
   AÇÕES
===================== */

async function createAgenda(){

 const dataInput = document.getElementById("data")
 const horaInput = document.getElementById("hora")
 const clienteInput = document.getElementById("cliente")
 const procInput = document.getElementById("proc")
 const salaInput = document.getElementById("sala")
 const profissionalInput = document.getElementById("profissional")
 const procCatalogEl = document.getElementById("procCatalog")
 const procDurationEl = document.getElementById("procDuration")
 const onlyExternalBlockEl = document.getElementById("onlyExternalBlock")

 try{

  const { data:{ user }} = await supabase.auth.getUser()

  if(!user){
   toast("Sessão expirada")
   return
  }

  const orgId = getActiveOrg()
  if (!orgId) {
   toast("Selecione uma organização")
   return
  }

  const profissionalId = profissionalInput ? (profissionalInput.value || "").trim() : null
  const salaId = salaInput ? (salaInput.value || "").trim() : null
  const durationMinutes = procDurationEl && procDurationEl.value ? Number(procDurationEl.value) : 60

  const onlyExternal = !!(onlyExternalBlockEl && onlyExternalBlockEl.checked)

  if (onlyExternal) {
   if (!profissionalId) {
    toast("Selecione o profissional para marcar indisponibilidade.")
    return
   }
   if (!dataInput.value || !horaInput.value) {
    toast("Informe data e hora para marcar indisponibilidade.")
    return
   }
   try {
    await createExternalBlock(profissionalId, dataInput.value, horaInput.value, durationMinutes)
    closeModal()
    renderAgenda()
    toast("Horário marcado como indisponível (agenda externa).")
   } catch (e) {
    console.error("[AGENDA] erro ao criar bloqueio externo", e)
    toast("Erro ao marcar indisponibilidade.")
   }
   return
  }

  let cfgAgenda = { sala_obrigatoria: false, profissional_obrigatorio: false }
  try { cfgAgenda = await getAgendaConfig() } catch (_) {}
  const temSalaOpcao = salaInput && [...salaInput.options].some((o) => o.value)
  const temProfOpcao = profissionalInput && [...profissionalInput.options].some((o) => o.value)
  if (cfgAgenda.sala_obrigatoria && temSalaOpcao && !salaId) {
   toast("Selecione a sala.")
   return
  }
  if (cfgAgenda.profissional_obrigatorio && temProfOpcao && !profissionalId) {
   toast("Selecione o profissional.")
   return
  }

  // Validar disponibilidade de sala com respiro
  if (salaId) {
   const salaCheck = await checkSalaAvailable(salaId, dataInput.value, horaInput.value, durationMinutes)
   if (!salaCheck.disponivel) {
    toast(`Sala indisponível: ${salaCheck.conflito.procedimento} às ${salaCheck.conflito.inicio}`)
    return
   }
  }

  // Validar disponibilidade de profissional com respiro
  const procedureIdCreate = procCatalogEl && procCatalogEl.value ? procCatalogEl.value : null
  if (profissionalId) {
   const profCheck = await checkProfessionalAvailableWithRespiro(profissionalId, dataInput.value, horaInput.value, durationMinutes)
   if (!profCheck.disponivel) {
    const statusEl = document.getElementById("agendaProfStatus")
    const c = profCheck.conflito
    const conflitoText = formatConflitoHtml(c)
    const disponiveisBtns = await buildDisponiveisButtons(dataInput.value, horaInput.value, durationMinutes, procedureIdCreate, profissionalInput, dataInput, horaInput, procDurationEl, null)
    if (statusEl && disponiveisBtns) {
     statusEl.innerHTML = `<strong>Indisponível:</strong> ${conflitoText}. <span class="agenda-prof-disponiveis-label">Escolha quem está disponível:</span> ${disponiveisBtns}`
     statusEl.className = "agenda-prof-status agenda-prof-busy"
     statusEl.scrollIntoView({ behavior: "smooth", block: "nearest" })
     statusEl.querySelectorAll(".agenda-prof-disponivel-btn").forEach((btn) => {
      btn.onclick = () => {
       profissionalInput.value = btn.dataset.userId || ""
       refreshProfStatus(profissionalInput, dataInput, horaInput, procDurationEl)
      }
     })
    }
    toast("Profissional indisponível. Escolha um dos disponíveis acima e salve de novo.")
    return
   }
  }

  const procedureId = procedureIdCreate
  const isRetornoEl = document.getElementById("agendaIsRetorno")
  const isRetorno = !!(isRetornoEl && isRetornoEl.checked)
  const aplicarDescontoModelo = document.getElementById("agendaAplicarDescontoModelo")?.checked ?? false
  const descontoModeloPctRaw = document.getElementById("agendaDescontoModeloPct")?.value?.trim()
  const descontoModeloPct = aplicarDescontoModelo && descontoModeloPctRaw !== "" ? (parseFloat(descontoModeloPctRaw) || null) : null

  const planoId = (document.getElementById("agendaPlano")?.value || "").trim()
  const agendarDemais = !!document.getElementById("agendaPlanoSessoes")?.checked
  let slots = [{
    data: dataInput.value,
    hora: horaInput.value,
    procedimento: procInput.value || null,
    duration_minutes: durationMinutes,
    procedure_id: procedureId,
    sessao_plano: planoId ? 1 : null,
    sessoes_plano: planoId ? 1 : null,
    plano_id: planoId || null,
  }]
  if (planoId) {
    try {
      const planos = await listPlanosTerapeuticos()
      const plano = (planos || []).find((p) => p.id === planoId)
      const procedures = await listProcedures(true)
      const proceduresById = new Map((procedures || []).map((p) => [p.id, p]))
      const sessoes = expandPlanoSessoes(plano?.procedimentos, proceduresById).map((s) => ({ ...s, plano_id: planoId }))
      if (sessoes.length) {
        slots = buildPlanoAgendaSlots({
          startDate: dataInput.value,
          startTime: horaInput.value,
          sessoes,
          onlyFirst: !agendarDemais || sessoes.length < 2,
        })
        slots = slots.map((s, i) => (i === 0 ? {
          ...s,
          procedimento: procInput.value || s.procedimento,
          duration_minutes: durationMinutes || s.duration_minutes,
          procedure_id: procedureId || s.procedure_id,
          plano_id: planoId,
        } : { ...s, plano_id: planoId }))
      }
    } catch (e) {
      console.warn("[AGENDA] plano", e)
    }
  }

  const clienteId = (clienteInput.value || "").trim()
  if (!procInput?.value?.trim() && !procedureId) {
    toast("Informe o procedimento (catálogo ou texto).")
    return
  }
  if (!dataInput.value || !horaInput.value) {
    toast("Informe data e hora.")
    return
  }
  let criados = 0
  let pulados = 0
  for (const slot of slots) {
    const dur = slot.duration_minutes || durationMinutes
    if (salaId && criados > 0) {
      const salaCheckSlot = await checkSalaAvailable(salaId, slot.data, slot.hora, dur)
      if (!salaCheckSlot.disponivel) {
        pulados += 1
        continue
      }
    }
    if (profissionalId && criados > 0) {
      const profCheckSlot = await checkProfessionalAvailableWithRespiro(profissionalId, slot.data, slot.hora, dur)
      if (!profCheckSlot.disponivel) {
        pulados += 1
        continue
      }
    }
    const payload = {
      data: slot.data,
      hora: slot.hora,
      procedimento: slot.procedimento || null,
      org_id: orgId,
      duration_minutes: dur,
      user_id: profissionalId || null,
      sala_id: salaId || null,
      is_retorno: isRetorno,
      is_modelo_agendamento: !!aplicarDescontoModelo && descontoModeloPct != null,
      desconto_modelo_pct: descontoModeloPct,
      sold_by_user_id: readSoldByUserId(),
    }
    if (clienteId) payload.cliente_id = clienteId
    if (slot.procedure_id) payload.procedure_id = slot.procedure_id
    if (slot.plano_id) {
      payload.plano_id = slot.plano_id
      payload.sessao_plano = slot.sessao_plano
      payload.sessoes_plano = slot.sessoes_plano
    }
    await insertAgendaRow(payload)
    criados += 1
  }

  if (!criados) {
    toast("Nenhum horário foi criado.")
    return
  }

  await supabase
   .from("notificacoes")
   .insert({
    user_id:user.id,
    titulo:"Novo agendamento",
    mensagem:
     "Agendado para "
     + dataInput.value
     + " às "
     + horaInput.value
   })

  await audit({
    action: "agenda.create",
    tableName: "agenda",
    recordId: null,
    permissionUsed: "agenda:manage",
    metadata: {
      data: dataInput.value,
      hora: horaInput.value
    }
  })

  closeModal()
  renderAgenda()
  toast(pulados
    ? `${criados} sessão(ões) do plano na agenda; ${pulados} pulada(s) por conflito.`
    : criados > 1
      ? `${criados} sessões do plano na agenda.`
      : "Agendamento criado!")

 }catch(err){

  console.error("[AGENDA] erro create", err)
  toast(err?.message || "Erro ao criar o horário.")
 }
}


async function updateAgenda(id){

 const dataInput = document.getElementById("data")
 const horaInput = document.getElementById("hora")
 const clienteInput = document.getElementById("cliente")
 const procInput = document.getElementById("proc")
 const procCatalogEl = document.getElementById("procCatalog")
 const procDurationEl = document.getElementById("procDuration")
 const profissionalInput = document.getElementById("profissional")
 const salaInput = document.getElementById("sala")

 const profissionalId = profissionalInput ? (profissionalInput.value || "").trim() : null
 const salaId = salaInput ? (salaInput.value || "").trim() : null
 const durationMinutes = procDurationEl && procDurationEl.value ? Number(procDurationEl.value) : 60

 try{

  // Validar disponibilidade de sala com respiro (excluindo o próprio agendamento)
  if (salaId) {
   const salaCheck = await checkSalaAvailable(salaId, dataInput.value, horaInput.value, durationMinutes, id)
   if (!salaCheck.disponivel) {
    toast(`Sala indisponível: ${salaCheck.conflito.procedimento} às ${salaCheck.conflito.inicio}`)
    return
   }
  }

  // Validar disponibilidade de profissional com respiro
  const procCatalogElEdit = document.getElementById("procCatalog")
  const procedureIdEdit = procCatalogElEdit && procCatalogElEdit.value ? procCatalogElEdit.value : null
  if (profissionalId) {
   const profCheck = await checkProfessionalAvailableWithRespiro(profissionalId, dataInput.value, horaInput.value, durationMinutes, id)
   if (!profCheck.disponivel) {
    const statusElEdit = document.getElementById("agendaProfStatus")
    const c = profCheck.conflito
    const conflitoText = formatConflitoHtml(c)
    const disponiveisBtns = await buildDisponiveisButtons(dataInput.value, horaInput.value, durationMinutes, procedureIdEdit, profissionalInput, dataInput, horaInput, procDurationEl, id)
    if (statusElEdit && disponiveisBtns) {
     statusElEdit.innerHTML = `<strong>Indisponível:</strong> ${conflitoText}. <span class="agenda-prof-disponiveis-label">Escolha quem está disponível:</span> ${disponiveisBtns}`
     statusElEdit.className = "agenda-prof-status agenda-prof-busy"
     statusElEdit.scrollIntoView({ behavior: "smooth", block: "nearest" })
     statusElEdit.querySelectorAll(".agenda-prof-disponivel-btn").forEach((btn) => {
      btn.onclick = () => {
       profissionalInput.value = btn.dataset.userId || ""
       refreshProfStatus(profissionalInput, dataInput, horaInput, procDurationEl, id)
      }
     })
    }
    toast("Profissional indisponível. Escolha um dos disponíveis acima e salve de novo.")
    return
   }
  }

  const isRetornoEl = document.getElementById("agendaIsRetorno")
  const isRetorno = !!(isRetornoEl && isRetornoEl.checked)
  const aplicarDescontoModeloEdit = document.getElementById("agendaAplicarDescontoModeloEdit")?.checked ?? false
  const descontoModeloPctRawEdit = document.getElementById("agendaDescontoModeloPctEdit")?.value?.trim()
  const descontoModeloPctEdit = aplicarDescontoModeloEdit && descontoModeloPctRawEdit !== "" ? (parseFloat(descontoModeloPctRawEdit) || null) : null

  const payload = {
   data: dataInput.value,
   hora: horaInput.value,
   cliente_id: clienteInput.value,
   procedimento: procInput.value,
   duration_minutes: durationMinutes,
   user_id: profissionalId || null,
   sala_id: salaId || null,
   is_retorno: isRetorno,
   is_modelo_agendamento: !!aplicarDescontoModeloEdit && descontoModeloPctEdit != null,
   desconto_modelo_pct: descontoModeloPctEdit,
   sold_by_user_id: readSoldByUserId(),
  }
  if (procCatalogEl && procCatalogEl.value) payload.procedure_id = procCatalogEl.value

  const { error } = await retryUnknownColumns(
    payload,
    (row) => withOrg(supabase.from("agenda").update(row).eq("id", id)),
    { immutable: ["data", "hora"] }
  )

  if(error) throw error

  await audit({
    action: "agenda.update",
    tableName: "agenda",
    recordId: id,
    permissionUsed: "agenda:manage",
    metadata: { id }
  })

  closeModal()
  renderAgenda()
  toast("Agendamento atualizado!")
  occupyProfessionalCalendar(id).then((r) => {
    if (r?.needs_reconnect) toast("Este profissional precisa reconectar o Google. A clínica não vê o título dos compromissos pessoais.")
  }).catch(() => {})

 }catch(err){

  console.error("[AGENDA] erro update", err)
  toast("Erro ao atualizar")
 }
}


/* =====================
   EVENTS
===================== */

function bindEditEvents(){

 document
  .querySelectorAll(
   ".calendar-event"
  )
  .forEach(card=>{
   card.onclick =
    () => {
      if (!card.dataset.id) return
      openSlotPanel(card.dataset.id)
    }
  })

 document
  .querySelectorAll(
   ".btn-whats"
  )
  .forEach(btn=>{
   btn.onclick = e=>{
    e.stopPropagation()

    const card = btn.closest(".calendar-event")
    const tel = card?.dataset?.tel
    const appointmentId = card?.dataset?.id

    enviarWhats(tel, appointmentId)
   }
  })
}


/* =====================
   WHATSAPP
===================== */

async function enviarWhats(tel, appointmentId) {
  if (!tel) {
    toast("Cliente sem telefone");
    return;
  }

  let mensagem = "Olá! Lembrete do seu atendimento.";
  let item = null;
  if (appointmentId) {
    try {
      const profile = await getOrganizationProfile().catch(() => ({}));
      item = await getAgendaItemById(appointmentId).catch(() => null);
      const cliente = item?.clientes || item?.clients || {};
      const nome = cliente.nome || cliente.name || "Cliente";
      const hora = item?.hora || "";
      const dataStr = item?.data || selectedDate || "";
      const [y, m, d] = dataStr.split("-");
      const dataFmt = y && m && d ? `${d}/${m}/${y}` : "";
      let linkConfirmar = "";
      const conf = await createConfirmation(appointmentId);
      if (conf?.token) {
        const base = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
        linkConfirmar = `${base}/portal.html?confirmToken=${encodeURIComponent(conf.token)}`;
      }
      const vars = { nome_cliente: nome, data: dataFmt, hora, nome_clinica: profile.name || "Clínica", link_confirmar: linkConfirmar };
      mensagem = await buildMessage("lembrete_agendamento", vars, { useConfirmar: !!linkConfirmar });
    } catch (err) {
      console.warn("[AGENDA] enviarWhats buildMessage ou createConfirmation", err);
    }
  }

  const result = await sendWhatsapp(tel, mensagem, {
    origem: "agenda_whats",
    clientId: item?.cliente_id || item?.client_id || "",
  });
  if (appointmentId) {
    try {
      await withOrg(supabase.from("agenda").update({ reminder_sent_at: new Date().toISOString() }).eq("id", appointmentId));
      renderDayList(selectedDate);
    } catch (_) {}
  }
  toast(result?.via === "api"
    ? "Lembrete enviado pelo WhatsApp da clínica."
    : (result?.success ? "WhatsApp aberto. Envie a mensagem para o cliente." : "Verifique o número do cliente."));
}
