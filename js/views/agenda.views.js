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

import { createConfirmation } from "../services/confirmations.service.js"
import { getAniversariantes } from "../services/clientes.service.js"
import { getOrganizationProfile } from "../services/organization-profile.service.js"


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
  return new Date().toISOString().split("T")[0]
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
      window.location.href = "/index.html"
      return
    }

    const monthData = await listAppointmentsByMonth(calendarYear, calendarMonth)
    const countsByDay = {}
    for (const row of monthData) {
      const d = row.data
      if (d) countsByDay[d] = (countsByDay[d] || 0) + 1
    }

    renderCalendar(countsByDay)
    await renderDayList(selectedDate)
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

async function renderDayList(date) {
  const listaAgenda = document.getElementById("listaAgenda")
  const dayTitleEl = document.getElementById("agendaDayTitle")
  if (!listaAgenda) return

  if (dayTitleEl) {
    const [y, m, d] = date.split("-")
    dayTitleEl.textContent = `Agendamentos do dia ${d}/${m}/${y}`
  }

  try {
    const data = await listAppointmentsByDate(date)
    const cliente = (a) => a.clientes || a.clients || {}
    const hora = (a) => a.hora ?? ""
    const isEvent = (a) => a.item_type === "event"
    const items = data || []

    if (items.length === 0) {
      listaAgenda.innerHTML = `
        <p class="agenda-empty">Nenhum agendamento neste dia. Use o botão acima para agendar.</p>
      `
      return
    }

    listaAgenda.innerHTML = items
      .map(
        (a) => `
    <div class="calendar-event ${isEvent(a) ? "calendar-event--event" : "calendar-event--procedure"}"
         data-id="${a.id}"
         data-tel="${(cliente(a).telefone || cliente(a).phone || "").replace(/"/g, "&quot;")}"
         data-email="${(cliente(a).email || "").replace(/"/g, "&quot;")}">
      <div class="calendar-event-time">${hora(a)}</div>
      <div class="calendar-event-name">
        ${isEvent(a)
          ? (a.event_title || "Evento") + (a.event_type ? ` (${a.event_type})` : "")
          : (cliente(a).nome || cliente(a).name || "—") + " – " + (a.procedimento || "Agendamento")}
      </div>
      <div class="calendar-event-actions">
        ${!isEvent(a) && a.reminder_sent_at ? `<span class="agenda-lembrete-enviado" title="Lembrete enviado">✓ Lembrete</span>` : ""}
        ${!isEvent(a) ? `<button type="button" class="btn-lembrete" data-id="${a.id}" title="Copiar lembrete com link de confirmação">📋 Lembrete</button>` : ""}
        ${!isEvent(a) ? `<button type="button" class="btn-email-lembrete" data-id="${a.id}" title="Abrir e-mail personalizado (custo zero)">✉️ E-mail</button>` : ""}
        ${!isEvent(a) ? `<button class="btn-whats" title="WhatsApp (mensagem com link de confirmação)">📲</button>` : ""}
      </div>
    </div>
  `
      )
      .join("")

    bindEditEvents()
    bindLembreteButtons(items, date)
    bindEmailLembreteButtons(items, date)
    notificarSemResponsavel().catch(() => {})
  } catch (err) {
    console.error("[AGENDA] erro lista dia", err)
    listaAgenda.innerHTML = `<p class="agenda-empty">Erro ao carregar agendamentos.</p>`
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
      let texto = `Olá, ${nome}! Lembrete: você tem agendamento dia ${dataFmt} às ${hora}. — ${profile.name || "Clínica"}`
      try {
        const conf = await createConfirmation(id)
        const token = conf?.token
        if (token) {
          const base = typeof window !== "undefined" && window.location?.origin ? window.location.origin : ""
          const linkConfirmar = `${base}/portal.html?confirmToken=${encodeURIComponent(token)}`
          texto = `Olá, ${nome}! Lembrete: você tem agendamento dia ${dataFmt} às ${hora}. Confirme sua presença em um clique: ${linkConfirmar} — ${profile.name || "Clínica"}`
        }
      } catch (err) {
        console.warn("[AGENDA] createConfirmation falhou, enviando lembrete sem link", err)
      }
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
          linkConfirmar = `\n\nConfirme sua presença em um clique: ${base}/portal.html?confirmToken=${encodeURIComponent(conf.token)}`
        }
      } catch (_) {}
      const assunto = `Lembrete: agendamento ${dataFmt} às ${hora} — ${profile.name || "Clínica"}`
      const corpo = `Olá, ${nome}!\n\nLembrete: você tem agendamento dia ${dataFmt} às ${hora}.${linkConfirmar}\n\n— ${profile.name || "Clínica"}`
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

/** Monta mensagem de aniversário (com ou sem oferta de brinde). */
function buildMensagemAniversario(nomeCliente, brindeHabilitado, nomeEmpresa) {
  let msg = `Olá, ${nomeCliente}! Feliz aniversário! 🎂 Desejamos muita saúde e sucesso.`
  if (brindeHabilitado) msg += " Visite-nos e retire seu brinde de aniversário!"
  msg += ` — ${nomeEmpresa || "Clínica"}`
  return msg
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
      btn.addEventListener("click", (e) => {
        e.stopPropagation()
        const nome = btn.dataset.nome || "Cliente"
        const msg = buildMensagemAniversario(nome, brinde, nomeEmpresa)
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
  supabase.from("clientes").select("id,nome")
 )
 if ((!clientes || clientes.length === 0) && getActiveOrg()) {
  const alt = await withOrg(supabase.from("clients").select("id,name"))
  clientes = alt.data ? alt.data.map(c => ({ id: c.id, nome: c.name || c.nome })) : []
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
   <label>Data</label>
   <input type="date" id="data" value="${selectedDate || getTodayStr()}" required>

   <label>Hora</label>
   <input type="time" id="hora" required>

   <label>Duração (min)</label>
   <input type="number" id="procDuration" min="5" step="5" value="60" title="Preenchido ao escolher procedimento do catálogo">

   <div class="agenda-modal-availability">
    <button type="button" id="btnVerDisponiveis" class="btn-secondary">Ver disponibilidade (profissional + sala)</button>
    <p id="agendaDisponiveis" class="agenda-disponiveis-msg" aria-live="polite"></p>
   </div>

   <label>Sala/Cabine${config.sala_obrigatoria ? " *" : ""}</label>
   <select id="sala" ${config.sala_obrigatoria ? "required" : ""}>
    <option value="">Selecione a sala…</option>
    ${salaOptions}
   </select>
   <p id="agendaSalaStatus" class="agenda-sala-status" aria-live="polite"></p>

   <label>Profissional${config.profissional_obrigatorio ? " *" : ""}</label>
   <select id="profissional" ${config.profissional_obrigatorio ? "required" : ""}>
    <option value="">Selecione o profissional…</option>
    ${profOptions}
   </select>
   <p id="agendaProfStatus" class="agenda-prof-status" aria-live="polite"></p>

   <label>Cliente</label>
   <select id="cliente">
    ${(clientes || []).map(c=>`
     <option value="${c.id}">${c.nome || c.name || ""}</option>
    `).join("")}
   </select>

   <label>Procedimento (catálogo)</label>
   <select id="procCatalog">${procCatalogOptions}</select>

   <label>Procedimento (nome ou texto livre)</label>
   <input id="proc" required placeholder="Preenchido ao escolher do catálogo">

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
 statusEl.textContent = "Verificando…"
 try {
  const result = await checkProfessionalAvailableWithRespiro(profEl.value, date, time, duration, excludeAgendaId)
  if (result.disponivel) {
   statusEl.textContent = "Disponível neste horário (incluindo intervalo de descanso)."
   statusEl.className = "agenda-prof-status agenda-prof-ok"
  } else {
   const c = result.conflito
   statusEl.innerHTML = `<strong>Indisponível:</strong> ${c.procedimento} às ${c.inicio}–${c.fim}` +
     (c.respiroNecessario ? ` (+${c.respiroNecessario} min de descanso)` : "")
   statusEl.className = "agenda-prof-status agenda-prof-busy"
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
    <button type="button" class="btn-primary agenda-panel__btn-profile" id="agendaPanelBtnProfile">Abrir perfil do cliente (e Anamnese)</button>
    <button type="button" class="btn-secondary agenda-panel__btn-protocolo" id="agendaPanelBtnProtocolo" title="Registrar o que foi aplicado (protocolo)">Registrar protocolo</button>
    <button type="button" class="btn-primary agenda-panel__btn-baixa" id="agendaPanelBtnBaixa" title="Procedimento realizado: registrar forma de pagamento e valor">Dar baixa (registrar pagamento)</button>
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
   supabase.from("clients").select("id,name")
  )
  if (clientes && clientes.length) {
   clientes = clientes.map(c => ({ id: c.id, nome: c.name || c.nome }))
  } else if (getActiveOrg()) {
   const alt = await withOrg(supabase.from("clientes").select("id,nome"))
   clientes = alt.data ? alt.data.map(c => ({ id: c.id, nome: c.nome || c.name })) : []
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
    <label>Data</label>
    <input type="date" id="data" value="${data.data}">

    <label>Hora</label>
    <input type="time" id="hora" value="${data.hora || ""}">

    <label>Duração (min)</label>
    <input type="number" id="procDuration" min="5" step="5" value="${procDuration}">

    <label>Sala/Cabine${config.sala_obrigatoria ? " *" : ""}</label>
    <select id="sala" ${config.sala_obrigatoria ? "required" : ""}>
     <option value="">Selecione a sala…</option>
     ${salaOptionsEdit}
    </select>
    <p id="agendaSalaStatus" class="agenda-sala-status" aria-live="polite"></p>

    <label>Profissional${config.profissional_obrigatorio ? " *" : ""}</label>
    <select id="profissional" ${config.profissional_obrigatorio ? "required" : ""}>
     <option value="">Selecione o profissional…</option>
     ${profOptionsEdit}
    </select>
    <p id="agendaProfStatus" class="agenda-prof-status" aria-live="polite"></p>

    <label>Cliente</label>
    <select id="cliente">
     ${(clientes || []).map(c=>`
      <option
       value="${c.id}"
       ${c.id === data.cliente_id ? "selected" : ""}>
       ${(c.nome || c.name || "").replace(/</g, "&lt;")}
      </option>
     `).join("")}
    </select>

    <label>Procedimento (catálogo)</label>
    <select id="procCatalog">${procCatalogOptionsEdit}</select>

    <label>Procedimento (nome ou texto livre)</label>
    <input id="proc" value="${procValue}">

    <p class="agenda-modal-respiro-hint">
     <strong>Respiro automático:</strong> ${config.respiro_sala_minutos} min para sala, ${config.respiro_profissional_minutos} min para profissional.
    </p>
   `,

   () => updateAgenda(id)
  )

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

/** Modal "Dar baixa": valor vem do procedimento (agenda); acréscimo só se produto a mais / outro procedimento. */
async function openDarBaixaModal(item) {
  const cliente = item.clientes || item.clients || {}
  const nomeCliente = (cliente.nome || cliente.name || "Cliente").replace(/"/g, "&quot;").replace(/</g, "&lt;")
  const procedimento = (item.procedimento || "Procedimento").replace(/"/g, "&quot;").replace(/</g, "&lt;")
  const dataHoje = new Date().toISOString().split("T")[0]
  const descricaoSugerida = `Agenda: ${nomeCliente} – ${procedimento} (${item.data || ""})`

  let procedure = null
  if (item.procedure_id) {
    try { procedure = await getProcedure(item.procedure_id) } catch (_) {}
  }
  const valorProcedimento = procedure?.valor_cobrado != null && procedure?.valor_cobrado !== "" ? Number(procedure.valor_cobrado) : null
  const valorProcedimentoFmt = valorProcedimento != null ? valorProcedimento.toFixed(2).replace(".", ",") : ""

  const temValorProcedimento = valorProcedimento != null && valorProcedimento > 0
  const blocoValor = temValorProcedimento
    ? `
    <p class="agenda-baixa-valor-proc">Valor do procedimento: <strong>R$ ${valorProcedimentoFmt}</strong></p>
    <label>Acréscimo (opcional)</label>
    <input type="number" id="baixaAcrescimo" step="0.01" min="0" value="" placeholder="Produto a mais, outro procedimento…">
    <p class="agenda-baixa-total-wrap">Valor total: <strong id="baixaValorTotal">R$ ${valorProcedimentoFmt}</strong></p>
    <input type="hidden" id="baixaValorProcedimento" value="${valorProcedimento}">
    `
    : `
    <label>Valor total (R$)</label>
    <input type="number" id="baixaValorTotalInput" step="0.01" min="0" required placeholder="Procedimento sem valor cadastrado">
    <input type="hidden" id="baixaValorProcedimento" value="">
    `

  openModal(
    "Dar baixa — Registrar pagamento",
    `
    <p class="agenda-baixa-hint">Cliente e procedimento vêm da agenda. Valor do procedimento já preenchido; altere só se houver acréscimo (produto a mais, outro procedimento).</p>
    <label>Descrição</label>
    <input type="text" id="baixaDesc" value="${descricaoSugerida}" placeholder="Ex.: Agenda: Cliente – Procedimento">
    ${blocoValor}
    <label>Forma de pagamento</label>
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
    <label>Valor recebido (quanto entrou de fato)</label>
    <input type="number" id="baixaValorRecebido" step="0.01" min="0" placeholder="Vazio = mesmo que o valor total">
    <label>Data do recebimento</label>
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
      data: dataEl?.value || new Date().toISOString().split("T")[0],
    }
    if (item.procedure_id) payload.procedure_id = item.procedure_id
    if (formaEl?.value) payload.forma_pagamento = formaEl.value
    const vr = valorRecebidoEl?.value?.trim()
    if (vr !== "" && vr != null && !isNaN(Number(vr))) payload.valor_recebido = Number(vr)

    const { error } = await withOrg(
      supabase.from("financeiro").insert(payload).select("id")
    )
    if (error) throw error

    await audit({
      action: "financeiro.create",
      tableName: "financeiro",
      recordId: null,
      permissionUsed: "financeiro:manage",
      metadata: { origem: "agenda_baixa", agenda_id: item.id, valor },
    }).catch(() => {})

    closeModal()
    renderAgenda()
    toast("Pagamento registrado. Entrada criada no Financeiro.")
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
  if (profissionalId) {
   const profCheck = await checkProfessionalAvailableWithRespiro(profissionalId, dataInput.value, horaInput.value, durationMinutes)
   if (!profCheck.disponivel) {
    toast(`Profissional indisponível: ${profCheck.conflito.procedimento} às ${profCheck.conflito.inicio}`)
    return
   }
  }

  const procedureId = procCatalogEl && procCatalogEl.value ? procCatalogEl.value : null

  const payload = {
   data: dataInput.value,
   hora: horaInput.value,
   procedimento: procInput.value || null,
   org_id: orgId,
   duration_minutes: durationMinutes,
   user_id: profissionalId || null,
   sala_id: salaId || null
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
  if (profissionalId) {
   const profCheck = await checkProfessionalAvailableWithRespiro(profissionalId, dataInput.value, horaInput.value, durationMinutes, id)
   if (!profCheck.disponivel) {
    toast(`Profissional indisponível: ${profCheck.conflito.procedimento} às ${profCheck.conflito.inicio}`)
    return
   }
  }

  const payload = {
   data: dataInput.value,
   hora: horaInput.value,
   cliente_id: clienteInput.value,
   procedimento: procInput.value,
   duration_minutes: durationMinutes,
   user_id: profissionalId || null,
   sala_id: salaId || null
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
      const conf = await createConfirmation(appointmentId);
      const token = conf?.token;
      if (token) {
        const base = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
        const linkConfirmar = `${base}/portal.html?confirmToken=${encodeURIComponent(token)}`;
        mensagem = `Olá! Lembrete do seu atendimento. Confirme sua presença em um clique: ${linkConfirmar}`;
      }
    } catch (err) {
      console.warn("[AGENDA] createConfirmation falhou, enviando só lembrete", err);
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
