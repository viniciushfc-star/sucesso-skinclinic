import {
 getNotificacoes,
 marcarLida,
 countNaoLidas,
 deletar,
 deletarTodas
} from "../services/notificacoes.service.js"

import { perguntarCopiloto } from "../services/copiloto.service.js"
import { supabase } from "../core/supabase.js"
import { getActiveOrg } from "../core/org.js"

import { toast } from "../ui/toast.js"
import { navigate } from "../core/spa.js"

/* =====================
   ELEMENTOS
===================== */

const lista = document.getElementById("listaNotificacoes")
const badge = document.getElementById("badgeNotif")

let _headerNotifInited = false

/* =====================
   ÍCONE + PAINEL NO HEADER (estilo WhatsApp)
===================== */

export function initHeaderNotif() {
  if (_headerNotifInited) return
  const btnBell = document.getElementById("btnNotifBell")
  const panel = document.getElementById("notifPanel")
  const panelList = document.getElementById("notifPanelList")
  const panelClose = document.getElementById("notifPanelClose")
  const verTodas = document.getElementById("notifPanelVerTodas")
  if (!btnBell || !panel || !panelList) return
  _headerNotifInited = true

  function closePanel() {
    panel.classList.add("hidden")
  }

  function openPanel() {
    panel.classList.remove("hidden")
    renderPanelList()
  }

  function togglePanel(e) {
    e.stopPropagation()
    if (panel.classList.contains("hidden")) openPanel()
    else closePanel()
  }

  async function renderPanelList() {
    try {
      const { data, error } = await getNotificacoes()
      if (error) throw error
      const items = (data || []).slice(0, 15)
      if (items.length === 0) {
        panelList.innerHTML = "<p class=\"notif-panel-empty\">Nenhuma notificação. Quando aparecer um número no sino, vale a pena clicar.</p>"
      } else {
        panelList.innerHTML = items.map((n) => {
          const time = n.created_at ? new Date(n.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : ""
          const cls = n.lida ? "notif-panel-item" : "notif-panel-item unread"
          const titulo = escapeHtml(n.titulo || "Notificação")
          const msg = escapeHtml((n.mensagem || "").slice(0, 120)) + ((n.mensagem || "").length > 120 ? "…" : "")
          const dataTitulo = (n.titulo || "").replace(/"/g, "&quot;")
          const dataMsg = (n.mensagem || "").slice(0, 300).replace(/"/g, "&quot;")
          return `
            <div class="${cls}" data-id="${n.id}" data-lida="${!!n.lida}" data-titulo="${dataTitulo}" data-msg="${dataMsg}">
              <button type="button" class="notif-panel-item-main">
                <span class="notif-panel-item-title">${titulo}</span>
                <p class="notif-panel-item-msg">${msg}</p>
                <span class="notif-panel-item-time">${time}</span>
              </button>
              <button type="button" class="notif-panel-copilot-btn" title="Esclarecer dúvidas com o Copilot" aria-label="Falar com o Copilot">🤖 Perguntar ao Copilot</button>
            </div>
          `
        }).join("")
        panelList.querySelectorAll(".notif-panel-item-main").forEach((btn) => {
          btn.onclick = async () => {
            const card = btn.closest(".notif-panel-item")
            const id = card?.dataset?.id
            if (!id) return
            try {
              await marcarLida(id)
              card.classList.remove("unread")
              card.dataset.lida = "true"
              await updateBadge()
            } catch (e) {
              toast("Erro ao marcar como lida")
            }
          }
        })
        panelList.querySelectorAll(".notif-panel-copilot-btn").forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation()
            const card = btn.closest(".notif-panel-item")
            const titulo = card?.dataset?.titulo || ""
            const msg = card?.dataset?.msg || ""
            openCopilotPanel({ titulo, mensagem: msg })
          }
        })
      }
    } catch (e) {
      panelList.innerHTML = "<p class=\"notif-panel-empty\">Erro ao carregar.</p>"
    }
  }

  btnBell.addEventListener("click", togglePanel)
  panelClose?.addEventListener("click", closePanel)
  verTodas?.addEventListener("click", () => {
    closePanel()
    navigate("notificacoes")
  })
  panel?.addEventListener("click", (e) => e.stopPropagation())
  document.addEventListener("click", () => closePanel())
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePanel() })

  initCopilotPanel()
}

/* =====================
   PAINEL CONTEXTUAL COPILOT (agente virtual abaixo de notificações)
===================== */

let _copilotPanelInited = false

/** Inicializa o painel do Copilot (FAB + handlers). Pode ser chamado por spa.js ou initHeaderNotif. */
export function initCopilotPanel() {
  if (_copilotPanelInited) return
  const panel = document.getElementById("copilotPanel")
  const closeBtn = document.getElementById("copilotPanelClose")
  const sendBtn = document.getElementById("copilotPanelSend")
  const inputEl = document.getElementById("copilotPanelInput")
  const fab = document.getElementById("copilotFab")
  if (!panel || !closeBtn || !sendBtn || !inputEl) return
  _copilotPanelInited = true

  if (fab) fab.addEventListener("click", (e) => { e.stopPropagation(); openCopilotPanel() })
  closeBtn.onclick = () => closeCopilotPanel()
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCopilotPanel() })
  sendBtn.onclick = () => sendCopilotMessage()
  inputEl.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendCopilotMessage() } })
}

let _copilotContext = { titulo: "", mensagem: "" }

export function openCopilotPanel(contexto = {}) {
  const panel = document.getElementById("copilotPanel")
  const contextEl = document.getElementById("copilotPanelContext")
  const chatEl = document.getElementById("copilotPanelChat")
  const inputEl = document.getElementById("copilotPanelInput")
  if (!panel || !contextEl || !chatEl || !inputEl) return

  _copilotContext = { titulo: contexto.titulo || "", mensagem: contexto.mensagem || "" }

  if (_copilotContext.titulo || _copilotContext.mensagem) {
    contextEl.innerHTML = `
      <p class="copilot-context-label">Contexto desta notificação:</p>
      <p class="copilot-context-titulo">${escapeHtml(_copilotContext.titulo)}</p>
      ${_copilotContext.mensagem ? `<p class="copilot-context-msg">${escapeHtml(_copilotContext.mensagem)}</p>` : ""}
      <p class="copilot-context-hint">Pergunte algo sobre isso ou sobre os dados da clínica.</p>
    `
  } else {
    contextEl.innerHTML = `<p class="copilot-context-hint">Pergunte algo sobre os dados da clínica. O Copilot explica e esclarece — não decide por você.</p>`
  }

  chatEl.innerHTML = ""
  inputEl.value = ""
  panel.classList.remove("hidden")
  const fab = document.getElementById("copilotFab")
  if (fab) fab.classList.add("copilot-fab--hidden")
  inputEl.focus()
}

function closeCopilotPanel() {
  const panel = document.getElementById("copilotPanel")
  if (panel) panel.classList.add("hidden")
  const fab = document.getElementById("copilotFab")
  if (fab) fab.classList.remove("copilot-fab--hidden")
}

async function sendCopilotMessage() {
  const inputEl = document.getElementById("copilotPanelInput")
  const chatEl = document.getElementById("copilotPanelChat")
  if (!inputEl || !chatEl) return

  const pergunta = (inputEl.value || "").trim()
  if (!pergunta) return

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    toast("Sessão expirada")
    return
  }

  appendChat("user", pergunta)
  inputEl.value = ""

  const thinkingEl = appendChat("assistant", "Pensando…")

    try {
    const orgId = getActiveOrg()
    const res = await perguntarCopiloto({
      pergunta,
      user_id: user.id,
      org_id: orgId || undefined,
      contextoNotificacao: _copilotContext.titulo || _copilotContext.mensagem ? { titulo: _copilotContext.titulo, mensagem: _copilotContext.mensagem } : null
    })

    const resposta = res?.resposta || "Não foi possível obter uma resposta."
    thinkingEl.textContent = resposta
    thinkingEl.classList.remove("copilot-chat-thinking")
  } catch (e) {
    console.error("[COPILOT] erro", e)
    thinkingEl.textContent = "Erro ao consultar o Copilot. Tente novamente."
    thinkingEl.classList.add("copilot-chat-error")
  }
}

function appendChat(role, content) {
  const chatEl = document.getElementById("copilotPanelChat")
  if (!chatEl) return null
  const div = document.createElement("div")
  div.className = `copilot-chat-msg copilot-chat-${role}`
  div.textContent = content
  if (role === "assistant") div.classList.add("copilot-chat-thinking")
  chatEl.appendChild(div)
  chatEl.scrollTop = chatEl.scrollHeight
  return div
}

function escapeHtml(str) {
  if (str == null) return ""
  const div = document.createElement("div")
  div.textContent = str
  return div.innerHTML
}


/* =====================
   RENDER
===================== */

export async function renderNotificacoes(){

 try{

  const { data, error } =
   await getNotificacoes()

  if(error){
   toast(error.message)
   return
  }

  lista.innerHTML =
   data.length===0
    ? "<p>Nenhuma notificação</p>"
    : `
      <button
       id="btnLimpar"
       class="btn-secondary">
       Limpar todas
      </button>

      ${data.map(n=>`
       <div
        class="item-card notif-card ${
         n.lida ? "" : "unread"
        }"
        data-id="${n.id}"
        data-titulo="${(n.titulo || "").replace(/"/g, "&quot;")}"
        data-msg="${(n.mensagem || "").slice(0, 300).replace(/"/g, "&quot;")}">

        <div class="notif-card-main">
          <b>${escapeHtml(n.titulo || "")}</b><br>
          ${escapeHtml(n.mensagem || "")}
          <button
           class="btn-del"
           data-del="${n.id}"
           title="Excluir">
           🗑
          </button>
        </div>
        <button type="button" class="notif-copilot-btn" title="Esclarecer dúvidas com o Copilot">
          🤖 Perguntar ao Copilot
        </button>
       </div>
      `).join("")}
     `

  bindActions()
  await updateBadge()

 }catch(err){

  console.error(
   "[NOTIF] erro render",
   err
  )

  toast("Erro ao carregar")
 }
}


/* =====================
   AÇÕES
===================== */

function bindActions(){

 document
  .querySelectorAll(".notif-card .notif-card-main")
  .forEach(el=>{
   el.onclick = ()=>{
    const card = el.closest(".notif-card")
    if (card) marcar(card.dataset.id)
   }
  })

 document
  .querySelectorAll(".notif-copilot-btn")
  .forEach(btn=>{
   btn.onclick = e=>{
    e.stopPropagation()
    const card = btn.closest(".notif-card")
    if (card) openCopilotPanel({ titulo: card.dataset.titulo || "", mensagem: card.dataset.msg || "" })
   }
  })

 document
  .querySelectorAll(".btn-del")
  .forEach(btn=>{
   btn.onclick = e=>{
    e.stopPropagation()
    excluir(btn.dataset.del)
   }
  })

 const btnLimpar =
  document.getElementById("btnLimpar")

 if(btnLimpar){
  btnLimpar.onclick =
   limparTudo
 }
}


async function marcar(id){

 try{

  await marcarLida(id)
  renderNotificacoes()

 }catch(err){

  console.error(
   "[NOTIF] erro marcar",
   err
  )
 }
}


async function excluir(id){

 try{

  await deletar(id)
  renderNotificacoes()

 }catch(err){

  console.error(
   "[NOTIF] erro deletar",
   err
  )
 }
}


async function limparTudo(){

 try{

  await deletarTodas()
  renderNotificacoes()
  toast("Notificações limpas!")

 }catch(err){

  console.error(
   "[NOTIF] erro limpar",
   err
  )
 }
}


/* =====================
   BADGE
===================== */

export async function updateBadge() {
  const badgeEl = document.getElementById("badgeNotif")
  if (!badgeEl) return
  try {
    const res = await countNaoLidas()
    const count = res?.count ?? 0
    const error = res?.error
    if (error) throw error
    if (count > 0) {
      badgeEl.textContent = count > 99 ? "99+" : String(count)
      badgeEl.classList.remove("hidden")
    } else {
      badgeEl.classList.add("hidden")
    }
  } catch (err) {
    console.error("[NOTIF] erro badge", err)
  }
}
