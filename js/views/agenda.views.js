/* =====================
   IMPORTS
===================== */

import { openModal, closeModal }
from "../ui/modal.js"

import { supabase }
from "../core/supabase.js"

import { toast }
from "../ui/toast.js"

import { sendWhatsapp }
from "../services/whatsapp.service.js"

import { getActiveOrg, withOrg } from "../core/org.js"

import {
 listAppointmentsByDate,
 listAppointmentsByMonth,
 getAgendaItemById,
 getClientAgendaResumo,
 getAvailableProfessionals,
 checkProfessionalAvailable,
 checkSalaAvailable,
 checkProfessionalAvailableWithRespiro,
 getAvailableSalas,
 createExternalBlock
} from "../services/appointments.service.js"

import { listSalas, listSalasQueSuportamTipo } from "../services/salas.service.js"
import { getAgendaConfig } from "../services/agenda-config.service.js"
import { getProcedure } from "../services/procedimentos.service.js"
import { getProfessionalIdsWhoCanDoProcedure } from "../services/professional-procedures.service.js"

import { getOrgMembers } from "../core/org.js"

import { audit } from "../services/audit.service.js"

import { listProcedures } from "../services/procedimentos.service.js"

import { navigate } from "../core/spa.js"
import { redirect } from "../core/base-path.js"

import { getEntradasByAgendaId } from "../services/financeiro.service.js"

import { listPacotesComSaldoByClient } from "../services/pacotes.service.js"

import { createConfirmation } from "../services/confirmations.service.js"
import { getAniversariantes } from "../services/clientes.service.js"
import { getOrganizationProfile } from "../services/organization-profile.service.js"
import { buildMessage, buildEmailLembrete } from "../services/message-templates.service.js"
import { listAfazeresByPrazo } from "../services/afazeres.service.js"

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

export function init() {
  ensureAgendaPanel()
  selectedDate = getTodayStr()
  const t = new Date()
  calendarYear = t.getFullYear()
  calendarMonth = t.getMonth() + 1
  bindUI()
  renderCalendarAndDay()
  renderAniversariantes()
}

function bindUI() {
  const btnNovo = document.getElementById("btnNovoAgendamento")
  if (btnNovo) btnNovo.onclick = () => openCreateModal()

  const prev = document.getElementById("agendaPrevMonth")
  if (prev) prev.onclick = () => { changeMonth(-1); renderCalendarAndDay() }
  const next = document.getElementById("agendaNextMonth")
  if (next) next.onclick = () => { changeMonth(1); renderCalendarAndDay() }
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
      const roleLabel = (r) => ({ master: "Administrador", gestor: "Gestor", staff: "Colaborador", viewer: "Visualização" }[r] || r)
      const opts = (members || []).map((m, i) => {
        const label = roleLabel(m.role) || `Profissional ${i + 1}`
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
    await renderDayList(selectedDate, professionalId)
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

/** Converte "09:00" ou "9:00" em minutos desde meia-noite. */
function parseHoraToMinutes(horaStr) {
  if (!horaStr) return 0
  const s = String(horaStr).trim().slice(0, 5)
  const [h, m] = s.split(":").map((n) => parseInt(n, 10) || 0)
  return h * 60 + m
}

/** Timeline: 6h–22h (horário comercial), blocos maiores estilo Google. */
const TIMELINE_START_HOUR = 6
const TIMELINE_END_HOUR = 22
const TIMELINE_PX_PER_HOUR = 64

function renderDayList(date, professionalId = null) {
  const listaAgenda = document.getElementById("listaAgenda")
  const dayTitleEl = document.getElementById("agendaDayTitle")
  if (!listaAgenda) return

  if (dayTitleEl) {
    const [y, m, d] = date.split("-")
    dayTitleEl.textContent = `Agendamentos do dia ${d}/${m}/${y}`
  }

  listAppointmentsByDate(date, professionalId)
    .then((data) => {
      const cliente = (a) => a.clientes || a.clients || {}
      const hora = (a) => a.hora ?? ""
      const isEvent = (a) => a.item_type === "event"
      const items = data || []

      if (items.length === 0) {
        listaAgenda.innerHTML = `
          <p class="agenda-empty">Nenhum agendamento neste dia. Use o botão <strong>Criar</strong> para agendar.</p>
        `
        renderAgendaAfazeres(date)
        return
      }

      const totalHours = TIMELINE_END_HOUR - TIMELINE_START_HOUR
      const totalHeight = totalHours * TIMELINE_PX_PER_HOUR
      const hourLabels = []
      for (let h = TIMELINE_START_HOUR; h < TIMELINE_END_HOUR; h++) {
        hourLabels.push(`<div class="agenda-timeline-hour" style="height:${TIMELINE_PX_PER_HOUR}px">${String(h).padStart(2, "0")}:00</div>`)
      }

      const startMinutesBase = TIMELINE_START_HOUR * 60
      const eventBlocks = items
        .map((a) => {
          const startMin = parseHoraToMinutes(a.hora)
          const durationMin = Math.max(15, Number(a.duration_minutes) || 60)
          const top = ((startMin - startMinutesBase) / 60) * TIMELINE_PX_PER_HOUR
          const height = Math.max(44, (durationMin / 60) * TIMELINE_PX_PER_HOUR - 4)
          const nome = isEvent(a)
            ? (a.event_title || "Evento") + (a.event_type ? ` (${a.event_type})` : "")
            : (cliente(a).nome || cliente(a).name || "—") + " – " + (a.procedimento || "Agendamento")
          const titulo = nome.replace(/"/g, "&quot;").replace(/</g, "&lt;")
          return `
    <div class="calendar-event calendar-event--block ${isEvent(a) ? "calendar-event--event" : "calendar-event--procedure"} ${a.is_retorno ? "calendar-event--retorno" : ""}"
         style="top:${Math.max(0, top)}px;height:${height}px;min-height:${height}px"
         data-id="${a.id}"
         data-tel="${(cliente(a).telefone || cliente(a).phone || "").replace(/"/g, "&quot;")}"
         data-email="${(cliente(a).email || "").replace(/"/g, "&quot;")}">
      <div class="calendar-event-block-time">${hora(a)}${durationMin !== 60 ? ` · ${durationMin} min` : ""}</div>
      <div class="calendar-event-block-name" title="${titulo}">${titulo}</div>
      <div class="calendar-event-block-actions">
        ${!isEvent(a) && a.reminder_sent_at ? `<span class="agenda-lembrete-enviado" title="Lembrete enviado">✓</span>` : ""}
        ${!isEvent(a) ? `<button type="button" class="btn-lembrete btn-icon-sm" data-id="${a.id}" title="Lembrete">📋</button>` : ""}
        ${!isEvent(a) ? `<button type="button" class="btn-email-lembrete btn-icon-sm" data-id="${a.id}" title="E-mail">✉️</button>` : ""}
        ${!isEvent(a) ? `<button class="btn-whats btn-icon-sm" title="WhatsApp">📲</button>` : ""}
      </div>
    </div>`
        })
        .join("")

      listaAgenda.innerHTML = `
        <div class="agenda-day-timeline">
          <div class="agenda-timeline-hours">${hourLabels.join("")}</div>
          <div class="agenda-timeline-events" style="min-height:${totalHeight}px">
            ${eventBlocks}
          </div>
        </div>`

      bindEditEvents()
      bindLembreteButtons(items, date)
      bindEmailLembreteButtons(items, date)
      notificarSemResponsavel().catch(() => {})

      const firstBlock = listaAgenda.querySelector(".calendar-event--block")
      if (firstBlock) {
        firstBlock.scrollIntoView({ behavior: "smooth", block: "nearest" })
      }

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
            ${(a.titulo || "Tarefa").replace(/</g, "&lt;")}
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
      try {
        navigator.clipboard.writeText(texto)
        toast("Lembrete (com link de confirmação) copiado. Cole no WhatsApp ou envie por e-mail.")
      } catch (_) {
        toast("Copie a mensagem manualmente.")
      }
      if (tel) {
        const num = String(tel).replace(/\D/g, "")
        if (num.length >= 10) sendWhatsapp(num, texto)
      }
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
      <button type="button" class="btn-enviar-msg-aniversario" data-nome="${escapeHtml(nome).replace(/"/g, "&quot;")}" data-phone="${escapeHtml(String(c.phone || "")).replace(/"/g, "&quot;")}">Enviar mensagem</button>
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
        if (phone.length >= 10) sendWhatsapp(phone, msg)
      })
    })
  } catch (e) {
    console.error("[AGENDA] aniversariantes", e)
    listEl.innerHTML = "<p class=\"agenda-aniversariantes-empty\">Erro ao carregar aniversariantes.</p>"
  }
}

function escapeHtml(s) {
  if (s == null) return ""
  const div = document.createElement("div")
  div.textContent = s
  return div.innerHTML
}

/* =====================
   MODAIS
===================== */

async function openCreateModal(){

 let { data: clientes } = await withOrg(
  supabase.from("clients").select("id, name, is_paciente_modelo, model_discount_pct")
 )
 if (!clientes?.length && getActiveOrg()) {
  const alt = await withOrg(supabase.from("clientes").select("id, nome, is_paciente_modelo, model_discount_pct"))
  clientes = alt?.data ? alt.data.map(c => ({ id: c.id, name: c.nome, nome: c.nome, is_paciente_modelo: c.is_paciente_modelo, model_discount_pct: c.model_discount_pct })) : []
 } else if (clientes?.length) {
  clientes = clientes.map(c => ({ ...c, nome: c.name || c.nome }))
 }

 const members = await getOrgMembers()
 const profOptions = (members || []).map((m, i) => {
  const label = m.role ? `${m.role} (${(m.user_id || "").slice(0, 8)}…)` : `Profissional ${i + 1}`
  return `<option value="${m.user_id}">${label}</option>`
 }).join("")

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

 openModal(
  "Novo agendamento",

  `
   <label for="data">Data</label>
   <input type="date" id="data" value="${selectedDate || getTodayStr()}" required>

   <label for="hora">Hora</label>
   <input type="time" id="hora" required>

   <label for="procDuration">Duração (min)</label>
   <input type="number" id="procDuration" min="5" step="5" value="60" title="Preenchido ao escolher procedimento do catálogo">

   <div class="agenda-modal-availability">
    <button type="button" id="btnVerDisponiveis" class="btn-secondary">Ver disponibilidade (profissional + sala)</button>
    <p id="agendaDisponiveis" class="agenda-disponiveis-msg" aria-live="polite"></p>
   </div>

   <label for="sala">Sala/Cabine${config.sala_obrigatoria ? " *" : ""}</label>
   <select id="sala" ${config.sala_obrigatoria ? "required" : ""}>
    <option value="">Selecione a sala…</option>
    ${salaOptions}
   </select>
   <p id="agendaSalaStatus" class="agenda-sala-status" aria-live="polite"></p>

   <label for="profissional">Profissional${config.profissional_obrigatorio ? " *" : ""}</label>
   <select id="profissional" ${config.profissional_obrigatorio ? "required" : ""}>
    <option value="">Selecione o profissional…</option>
    ${profOptions}
   </select>
   <p id="agendaProfStatus" class="agenda-prof-status" aria-live="polite"></p>

   <label for="cliente">Cliente</label>
   <select id="cliente">
    ${(clientes || []).map(c=>`
     <option value="${c.id}" data-modelo="${c.is_paciente_modelo ? "1" : "0"}" data-discount="${c.model_discount_pct != null ? c.model_discount_pct : ""}">${(c.nome || c.name || "").replace(/</g, "&lt;")}${c.is_paciente_modelo ? " (modelo)" : ""}</option>
    `).join("")}
   </select>
   <div id="agendaModeloWrap" class="agenda-modelo-wrap hidden">
    <p class="agenda-modelo-title">Paciente modelo</p>
    <label><input type="checkbox" id="agendaAplicarDescontoModelo" checked> Aplicar desconto modelo neste agendamento</label>
    <label for="agendaDescontoModeloPct">Desconto neste agendamento (%)</label>
    <input type="number" id="agendaDescontoModeloPct" min="0" max="100" step="0.5" placeholder="Ex.: 30">
   </div>

   <label for="procCatalog">Procedimento (catálogo)</label>
   <select id="procCatalog">${procCatalogOptions}</select>

   <label for="proc">Procedimento (nome ou texto livre)</label>
   <input id="proc" required placeholder="Preenchido ao escolher do catálogo">

   <div class="agenda-retorno-option">
    <label><input type="checkbox" id="agendaIsRetorno"> Retorno (não gera receita)</label>
    <p class="agenda-retorno-hint">Marque para consultas de retorno (ex.: pós-botox). O horário ocupa a agenda, mas não entra no faturamento previsto.</p>
   </div>

   <p class="agenda-modal-respiro-hint">
    <strong>Respiro automático:</strong> ${config.respiro_sala_minutos} min para sala, ${config.respiro_profissional_minutos} min para profissional.
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
 }

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
  }
 }
 document.getElementById("btnVerDisponiveis").onclick = () => refreshDisponiveis(dataEl, horaEl, profEl, salaEl, procDurationEl)
 if (profEl) profEl.onchange = () => refreshProfStatus(profEl, dataEl, horaEl, procDurationEl)
 if (salaEl) salaEl.onchange = () => refreshSalaStatus(salaEl, dataEl, horaEl, procDurationEl)
 if (dataEl) dataEl.addEventListener("change", () => refreshDisponiveis(dataEl, horaEl, profEl, salaEl, procDurationEl))
 if (horaEl) horaEl.addEventListener("change", () => refreshDisponiveis(dataEl, horaEl, profEl, salaEl, procDurationEl))
}

/** Filtra dropdowns de sala e profissional pelo procedimento selecionado (sala suporta tipo; profissional realiza). */
async function filterSalasAndProfsByProcedure(procedureId, salaEl, profEl, salas, members) {
  if (!salaEl || !profEl) return
  const allSalas = salas || []
  const allMembers = members || []
  const emptyOptionSala = '<option value="">Selecione a sala…</option>'
  const emptyOptionProf = '<option value="">Selecione o profissional…</option>'
  if (!procedureId || procedureId.trim() === "") {
    salaEl.innerHTML = emptyOptionSala + allSalas.map(s => `<option value="${s.id}">${(s.nome || "").replace(/</g, "&lt;")}</option>`).join("")
    profEl.innerHTML = emptyOptionProf + allMembers.map((m, i) => {
      const label = m.role ? `${m.role} (${(m.user_id || "").slice(0, 8)}…)` : `Profissional ${i + 1}`
      return `<option value="${m.user_id}">${label}</option>`
    }).join("")
    return
  }
  const proc = await getProcedure(procedureId)
  const tipo = proc?.tipo_procedimento || null
  const salasFiltradas = tipo ? await listSalasQueSuportamTipo(tipo) : allSalas
  const profIds = await getProfessionalIdsWhoCanDoProcedure(procedureId)
  const membersFiltrados = profIds && profIds.length > 0 ? allMembers.filter(m => profIds.includes(m.user_id)) : allMembers
  salaEl.innerHTML = emptyOptionSala + salasFiltradas.map(s => `<option value="${s.id}">${(s.nome || "").replace(/</g, "&lt;")}</option>`).join("")
  profEl.innerHTML = emptyOptionProf + membersFiltrados.map((m, i) => {
    const label = m.role ? `${m.role} (${(m.user_id || "").slice(0, 8)}…)` : `Profissional ${i + 1}`
    return `<option value="${m.user_id}">${label}</option>`
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
  const ids = await getAvailableProfessionals(date, time, duration, procedureId)
  const profNames = ids.map(id => {
   const m = members.find(m => m.user_id === id)
   return m?.role || (id || "").slice(0, 8) + "…"
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
  const safeLabel = String(label).replace(/</g, "&lt;").replace(/"/g, "&quot;")
  return `<button type="button" class="agenda-prof-disponivel-btn" data-user-id="${uid}" title="Escolher ${safeLabel}">${safeLabel}</button>`
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
   const conflitoText = `${(c.procedimento || "").replace(/</g, "&lt;")} às ${c.inicio || ""}–${c.fim || ""}` + (c.respiroNecessario ? ` (+${c.respiroNecessario} min de descanso)` : "")
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
   statusEl.innerHTML = `<strong>Sala ocupada:</strong> ${c.procedimento} às ${c.inicio}–${c.fim}` +
     (c.respiroNecessario ? ` (+${c.respiroNecessario} min de organização)` : "")
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
  const temBaixa = baixasJaRegistradas.length > 0
  const primeiraBaixa = baixasJaRegistradas[0]
  const valorBaixa = primeiraBaixa && (primeiraBaixa.valor_recebido != null && primeiraBaixa.valor_recebido !== "" ? Number(primeiraBaixa.valor_recebido) : Number(primeiraBaixa.valor))
  const dataBaixaFmt = primeiraBaixa && primeiraBaixa.data ? new Date(primeiraBaixa.data + "T12:00:00").toLocaleDateString("pt-BR") : ""
  const baixaRegistradaHtml = temBaixa
   ? `<div class="agenda-panel__baixa-ja-registrada">
       <p class="agenda-panel__baixa-ja-msg">Baixa já registrada${dataBaixaFmt ? ` em ${dataBaixaFmt}` : ""}: R$ ${(valorBaixa || 0).toFixed(2).replace(".", ",")}</p>
       ${baixasJaRegistradas.length > 1 ? `<p class="agenda-panel__baixa-ja-dup">Há ${baixasJaRegistradas.length} lançamentos para este agendamento. Exclua os duplicados em <strong>Financeiro</strong>.</p>` : ""}
       <a href="#" data-view="financeiro" class="agenda-panel__link-financeiro">Ver no Financeiro</a>
      </div>`
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
     ${(cliente.telefone || cliente.phone) ? `<p class="agenda-panel__phone">${String(cliente.telefone || cliente.phone).replace(/</g, "&lt;")}</p>` : ""}
     ${resumoHtml}
    <p class="agenda-panel__hint">Anamnese e histórico completo: abra o perfil do cliente.</p>
    ${baixaRegistradaHtml}
    <button type="button" class="btn-primary agenda-panel__btn-profile" id="agendaPanelBtnProfile">Abrir perfil do cliente (e Anamnese)</button>
    <button type="button" class="btn-secondary agenda-panel__btn-protocolo" id="agendaPanelBtnProtocolo" title="Registrar o que foi aplicado (protocolo)">Registrar protocolo</button>
    ${!temBaixa ? `<button type="button" class="btn-primary agenda-panel__btn-baixa" id="agendaPanelBtnBaixa" title="Procedimento realizado: registrar forma de pagamento e valor">Dar baixa (registrar pagamento)</button>` : ""}
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
  const btnProtocolo = document.getElementById("agendaPanelBtnProtocolo")
  if (btnProtocolo && clientId && !isEvent) {
   btnProtocolo.onclick = () => {
    sessionStorage.setItem("clientePerfilId", clientId)
    sessionStorage.setItem("clientePerfilOpenTab", "protocolo")
    sessionStorage.setItem("clientePerfilAgendaId", item.id)
    closeSlotPanel()
    navigate("cliente-perfil")
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

  let { data: clientes } = await withOrg(
   supabase.from("clients").select("id, name, is_paciente_modelo, model_discount_pct")
  )
  if (clientes && clientes.length) {
   clientes = clientes.map(c => ({ id: c.id, nome: c.name || c.nome, is_paciente_modelo: c.is_paciente_modelo, model_discount_pct: c.model_discount_pct }))
  } else if (getActiveOrg()) {
   const alt = await withOrg(supabase.from("clientes").select("id, nome, is_paciente_modelo, model_discount_pct"))
   clientes = alt?.data ? alt.data.map(c => ({ id: c.id, nome: c.nome || c.name, is_paciente_modelo: c.is_paciente_modelo, model_discount_pct: c.model_discount_pct })) : []
  } else {
   clientes = []
  }

  const members = await getOrgMembers()
  const profOptionsEdit = (members || []).map((m, i) => {
   const label = m.role ? `${m.role} (${(m.user_id || "").slice(0, 8)}…)` : `Profissional ${i + 1}`
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
    <select id="sala" ${config.sala_obrigatoria ? "required" : ""}>
     <option value="">Selecione a sala…</option>
     ${salaOptionsEdit}
    </select>
    <p id="agendaSalaStatus" class="agenda-sala-status" aria-live="polite"></p>

    <label for="profissional">Profissional${config.profissional_obrigatorio ? " *" : ""}</label>
    <select id="profissional" ${config.profissional_obrigatorio ? "required" : ""}>
     <option value="">Selecione o profissional…</option>
     ${profOptionsEdit}
    </select>
    <p id="agendaProfStatus" class="agenda-prof-status" aria-live="polite"></p>

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

/** Modal "Dar baixa": valor vem do procedimento (agenda); acréscimo só se produto a mais / outro procedimento. Opção de descontar 1 sessão de pacote. */
async function openDarBaixaModal(item) {
  const jaTemBaixa = await getEntradasByAgendaId(item.id).then((r) => r.length > 0).catch(() => false)
  if (jaTemBaixa) {
    toast("Este agendamento já teve baixa registrada. Para alterar ou ver, abra o agendamento e use \"Ver no Financeiro\" ou acesse Financeiro no menu.")
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
  const blocoPacote = pacotesComSaldo.length > 0
    ? `
    <div class="agenda-baixa-pacote-wrap">
      <label for="baixaPacoteId">Descontar 1 sessão de pacote (opcional)</label>
      <select id="baixaPacoteId">
        <option value="">Não descontar</option>
        ${pacotesComSaldo.map((p) => `<option value="${p.id}">${(p.nome_pacote || "Pacote").replace(/</g, "&lt;")} — ${p.sessoes_restantes} restantes</option>`).join("")}
      </select>
    </div>
    `
    : ""

  let procedure = null
  if (item.procedure_id) {
    try { procedure = await getProcedure(item.procedure_id) } catch (_) {}
  }
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
    <p class="agenda-baixa-hint">Cliente e procedimento vêm da agenda. Valor do procedimento já preenchido; altere só se houver acréscimo (produto a mais, outro procedimento).</p>
    ${blocoPacote}
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
    <label for="baixaValorRecebido">Valor recebido (quanto entrou de fato)</label>
    <input type="number" id="baixaValorRecebido" step="0.01" min="0" placeholder="Vazio = mesmo que o valor total">
    <label for="baixaData">Data do recebimento</label>
    <input type="date" id="baixaData" value="${dataHoje}" required>
    <input type="hidden" id="baixaTemValorProcedimento" value="${temValorProcedimento ? "1" : "0"}">
    `,
    () => submitDarBaixa(item)
  )

  if (temValorProcedimento) {
    const acrescimoEl = document.getElementById("baixaAcrescimo")
    const totalEl = document.getElementById("baixaValorTotal")
    const updateTotal = () => {
      const base = valorProcedimento
      const ac = Number(acrescimoEl?.value) || 0
      const total = base + ac
      if (totalEl) totalEl.textContent = "R$ " + total.toFixed(2).replace(".", ",")
    }
    acrescimoEl?.addEventListener("input", updateTotal)
    acrescimoEl?.addEventListener("change", updateTotal)
  }
}

async function submitDarBaixa(item) {
  const descEl = document.getElementById("baixaDesc")
  const formaEl = document.getElementById("baixaFormaPagamento")
  const valorRecebidoEl = document.getElementById("baixaValorRecebido")
  const dataEl = document.getElementById("baixaData")
  const temValorProcedimento = document.getElementById("baixaTemValorProcedimento")?.value === "1"

  let valor
  if (temValorProcedimento) {
    const base = Number(document.getElementById("baixaValorProcedimento")?.value) || 0
    const ac = Number(document.getElementById("baixaAcrescimo")?.value) || 0
    valor = base + ac
  } else {
    valor = Number(document.getElementById("baixaValorTotalInput")?.value)
  }

  if (valor <= 0 || isNaN(valor)) {
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

    const { error } = await supabase
      .from("financeiro")
      .insert(payload)
      .select("id")
    if (error) throw error

    const pacoteId = document.getElementById("baixaPacoteId")?.value?.trim()
    if (pacoteId) {
      try {
        const { consumirSessao } = await import("../services/pacotes.service.js")
        await consumirSessao(pacoteId, item.id)
        toast("Pagamento registrado e 1 sessão descontada do pacote.")
      } catch (e) {
        console.warn("[AGENDA] consumirSessao", e)
        toast("Pagamento registrado. Erro ao descontar sessão do pacote: " + (e?.message || "tente no perfil do cliente."))
      }
    } else {
      toast("Pagamento registrado. Entrada criada no Financeiro.")
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
  } catch (err) {
    console.error("[AGENDA] submitDarBaixa", err)
    toast(err?.message || "Erro ao registrar pagamento.")
  }
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
    const conflitoText = `${c?.procedimento || "—"} às ${c?.inicio || ""}–${c?.fim || ""}`
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

  const payload = {
   data: dataInput.value,
   hora: horaInput.value,
   procedimento: procInput.value || null,
   org_id: orgId,
   duration_minutes: durationMinutes,
   user_id: profissionalId || null,
   sala_id: salaId || null,
   is_retorno: isRetorno,
   is_modelo_agendamento: !!aplicarDescontoModelo && descontoModeloPct != null,
   desconto_modelo_pct: descontoModeloPct,
  }
  const clienteId = (clienteInput.value || "").trim()
  if (clienteId) payload.cliente_id = clienteId
  if (procedureId) payload.procedure_id = procedureId

  const { error } = await supabase.from("agenda").insert(payload)

  if(error) throw error

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
  toast("Agendamento criado!")

 }catch(err){

  console.error("[AGENDA] erro create", err)
  toast("Erro ao criar")
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
    const conflitoText = `${c?.procedimento || "—"} às ${c?.inicio || ""}–${c?.fim || ""}`
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
  }
  if (procCatalogEl && procCatalogEl.value) payload.procedure_id = procCatalogEl.value

  const { error } = await withOrg(
   supabase.from("agenda").update(payload).eq("id", id)
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
    () =>
     openSlotPanel(
      card.dataset.id
    )
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
  if (appointmentId) {
    try {
      const profile = await getOrganizationProfile().catch(() => ({}));
      const item = await getAgendaItemById(appointmentId).catch(() => null);
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

  const result = await sendWhatsapp(tel, mensagem);
  if (appointmentId) {
    try {
      await withOrg(supabase.from("agenda").update({ reminder_sent_at: new Date().toISOString() }).eq("id", appointmentId));
      renderDayList(selectedDate);
    } catch (_) {}
  }
  toast(result?.success ? "WhatsApp aberto. Envie a mensagem para o cliente." : "Verifique o número do cliente.");
}
