import { getTeam } from "../services/user.service.js"
import { createInvite } from "../services/invite.service.js"
import { getOrganizationProfile } from "../services/organization-profile.service.js"
import { getApiBase } from "../core/api-base.js"
import { toast } from "../ui/toast.js"
import { openModal, closeModal, openConfirmModal } from "../ui/modal.js"
import { audit } from "../services/audit.service.js"
import { removeUserFromOrg, getActiveOrg } from "../core/org.js"
import { getOrgMembers } from "../core/org.js"
import { supabase } from "../core/supabase.js"
import { getRole } from "../services/permissions.service.js"
import { listTeamPaymentModels, upsertTeamPaymentModel } from "../services/team-payment.service.js"
import { listAfazeres, createAfazer, updateAfazer, deleteAfazer, TIPOS_AFAZERES, getAfazeresResumoPorUsuario } from "../services/afazeres.service.js"
import { getProcedureIdsByProfessional, setProceduresForProfessional } from "../services/professional-procedures.service.js"
import { listProcedures } from "../services/procedimentos.service.js"
import { getIndiceCuidado } from "../services/produto-avaliacoes.service.js"
import { getFaturamentoPorUsuario } from "../services/financeiro.service.js"
import {
  getConnectUrl,
  getCalendarConnectionsStatus,
  syncCalendar,
  disconnectCalendar,
} from "../services/google-calendar.service.js"
import { navigate } from "../core/spa.js"

function openProfissionalPerfil(userId) {
  if (!userId) return
  sessionStorage.setItem("profissionalPerfilId", userId)
  navigate("profissional-perfil")
}

/** Rótulos de função (papel) para exibição na Equipe */
const ROLE_LABEL = {
  staff: "Funcionário",
  gestor: "Gestor",
  master: "Administrador",
  viewer: "Visualização",
}


/* =====================
   SPA INIT
===================== */

/** Modo "gerenciar" (Convidar, Remover, Procedimentos) só para master/gestor e quando vem de Configurações */
let showManageMode = false

export async function init() {
  const fromMaster = !!sessionStorage.getItem("teamShowManage")
  if (fromMaster) sessionStorage.removeItem("teamShowManage")
  try {
    const role = await getRole()
    showManageMode = fromMaster && (role === "master" || role === "gestor")
  } catch (_) {
    showManageMode = false
  }

  bindUI()
  toggleTeamManageUI()
  checkGoogleCalendarCallback()
  await renderTeam()
  renderAfazeres()
  renderTeamPaymentIfMaster()
  renderIndiceCuidado()
}

function toggleTeamManageUI() {
  const btnInviteEl = document.getElementById("btnInvite")
  const linkGerenciarWrap = document.getElementById("teamLinkGerenciarWrap")
  const teamPaymentWrap = document.getElementById("teamPaymentWrap")
  const teamAfazeresWrap = document.getElementById("teamAfazeresWrap")
  const teamIndiceCuidadoWrap = document.getElementById("teamIndiceCuidadoWrap")
  if (showManageMode) {
    if (btnInviteEl) btnInviteEl.style.display = ""
    if (linkGerenciarWrap) linkGerenciarWrap.classList.add("hidden")
    if (teamPaymentWrap) teamPaymentWrap.classList.remove("hidden")
    if (teamAfazeresWrap) teamAfazeresWrap.classList.remove("hidden")
    if (teamIndiceCuidadoWrap) teamIndiceCuidadoWrap.classList.remove("hidden")
  } else {
    if (btnInviteEl) btnInviteEl.style.display = "none"
    if (linkGerenciarWrap) linkGerenciarWrap.classList.remove("hidden")
    if (teamPaymentWrap) teamPaymentWrap.classList.add("hidden")
    if (teamAfazeresWrap) teamAfazeresWrap.classList.add("hidden")
    if (teamIndiceCuidadoWrap) teamIndiceCuidadoWrap.classList.add("hidden")
  }
}

function checkGoogleCalendarCallback() {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "")
  const status = params.get("google_calendar")
  if (status === "connected") {
    toast("Google Agenda conectada. Use \"Sincronizar agora\" para atualizar os blocos de indisponibilidade.")
    if (window.history.replaceState) {
      const url = new URL(window.location.href)
      url.searchParams.delete("google_calendar")
      window.history.replaceState({}, "", url.pathname + url.hash + (url.search || ""))
    }
  } else if (status === "error") {
    toast("Não foi possível conectar o Google Agenda. Verifique as configurações da API.", "warn")
    if (window.history.replaceState) {
      const url = new URL(window.location.href)
      url.searchParams.delete("google_calendar")
      url.searchParams.delete("message")
      window.history.replaceState({}, "", url.pathname + url.hash + (url.search || ""))
    }
  }
}

/* =====================
   ELEMENTOS
===================== */

const btnInvite =
 document.getElementById("btnInvite")

const listaTeam =
 document.getElementById("listaTeam")


/* =====================
   BIND UI
===================== */

function bindUI(){

 const btnInvite =
  document.getElementById(
   "btnInvite"
  )

  if (btnInvite) btnInvite.onclick = () => openInvite()
  const btnAfazer = document.getElementById("btnNovoAfazer")
  if (btnAfazer) btnAfazer.onclick = () => openNovoAfazerModal()
  const teamLinkGerenciar = document.getElementById("teamLinkGerenciar")
  if (teamLinkGerenciar) {
    teamLinkGerenciar.addEventListener("click", (e) => {
      e.preventDefault()
      navigate("master")
    })
  }
}

/* =====================
   RENDER
===================== */

export async function renderTeam(){

 try{

  const { data, error } =
   await getTeam()

  if(error){
   toast(error.message)
   return
  }

  let googleStatus = { connections: [] }
  try {
    googleStatus = await getCalendarConnectionsStatus()
  } catch (_) {}
  const connectedUserIds = new Set((googleStatus.connections || []).map((c) => c.user_id))
  const lastSyncByUser = {}
  for (const c of googleStatus.connections || []) {
    lastSyncByUser[c.user_id] = c.last_sync_at
  }

 const showManage = showManageMode
 const nameFromEmail = (email) => {
   if (!email) return "Profissional"
   const part = (email.split("@")[0] || "").replace(/[._]/g, " ")
   return part.charAt(0).toUpperCase() + part.slice(1) || email
 }
 const initialsFromEmail = (email) => {
   if (!email) return "?"
   const part = (email.split("@")[0] || "").replace(/[^a-z0-9]/gi, "")
   return (part.slice(0, 2) || "?").toUpperCase()
 }
 listaTeam.innerHTML =
 data.map(u=>{
   const connected = connectedUserIds.has(u.id)
   const lastSync = lastSyncByUser[u.id]
   const lastSyncStr = lastSync ? new Date(lastSync).toLocaleString("pt-BR") : ""
   const connectUrl = getConnectUrl(u.id)
   const rl = ROLE_LABEL[u.role] || u.role
   const nome = (u.display_name || u.nome || nameFromEmail(u.email)).replace(/</g, "&lt;")
   const iniciais = (u.avatar_url ? "" : initialsFromEmail(u.email)).replace(/</g, "&lt;")
   const emailSafe = (u.email || "").replace(/</g, "&lt;")
   return `
  <div class="item-card team-member-card">
   <div class="team-member-card-row">
     <div class="team-member-card-main" role="button" tabindex="0" data-user-id="${u.user_id || u.id}" title="Abrir perfil do profissional">
       <span class="team-member-avatar-wrap">
         ${u.avatar_url ? `<img class="team-member-avatar" src="${(u.avatar_url || "").replace(/"/g, "&quot;")}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling?.classList.remove('hidden')">` : ""}
         <span class="team-member-avatar-initials ${u.avatar_url ? "hidden" : ""}">${iniciais}</span>
       </span>
       <div class="team-member-info">
         <span class="team-member-nome">${nome}</span>
         <span class="team-member-cargo">${rl}</span>
         <span class="team-member-email" title="E-mail de login">${emailSafe}</span>
       </div>
       <span class="team-member-chevron" aria-hidden="true">›</span>
     </div>
     ${showManage ? `<div class="team-member-card-menu-wrap">
       <button type="button" class="team-member-card-menu-btn" aria-label="Abrir menu do profissional" title="Editar ou remover">⋮</button>
       <div class="team-member-card-dropdown hidden">
         <button type="button" class="team-member-card-dropdown-item btnProcedimentosProf" data-user="${u.id}" data-email="${emailSafe}">Procedimentos</button>
         <button type="button" class="team-member-card-dropdown-item team-member-card-dropdown-item--danger btnRemoveUser" data-user="${u.id}" data-email="${emailSafe}" data-role="${u.role}">Remover</button>
       </div>
     </div>` : ""}
   </div>
   <div class="team-card-actions">
     ${connected
       ? `<button type="button" class="btn-secondary btnGoogleSync" data-user="${u.id}" title="Sincronizar Google Agenda">Sincronizar</button>
          <button type="button" class="btn-small btnGoogleDisconnect" data-user="${u.id}" title="Desconectar Google Agenda">Desconectar</button>
          ${lastSyncStr ? `<small class="team-google-last-sync">Sync: ${lastSyncStr}</small>` : ""}`
       : connectUrl
         ? `<a href="${connectUrl}" class="btn-secondary btnGoogleConnect" data-user="${u.id}" title="Conectar Google Agenda">Conectar Google Agenda</a>`
         : `<span class="team-card-actions-hint" title="Clique no card acima para abrir o perfil">Clique no card para abrir o perfil do profissional</span>`}
   </div>
  </div>
 `
 }).join("")

 bindTeamCardClicks()
  bindTeamCardMenus()
  bindRemoveUser()
  bindProcedimentosProf()
  bindGoogleCalendarButtons()

  await renderTeamDesempenho()

 }catch(err){

  console.error(
   "[TEAM] erro render",
   err
  )

  toast("Erro ao carregar equipe")
 }
}

/** Bloco "Desempenho por profissional": faturamento (últimos 30 dias) e tarefas concluídas */
async function renderTeamDesempenho() {
  const wrap = document.getElementById("teamDesempenhoWrap")
  const listEl = document.getElementById("listaTeamDesempenho")
  if (!wrap || !listEl) return
  try {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    const startStr = start.toISOString().slice(0, 10)
    const endStr = end.toISOString().slice(0, 10)

    const [faturamentoPorUser, afazeresResumo, teamData] = await Promise.all([
      getFaturamentoPorUsuario(startStr, endStr),
      getAfazeresResumoPorUsuario(),
      getTeam().then((r) => (r.error ? [] : r.data || [])),
    ])
    const faturamentoMap = Object.fromEntries((faturamentoPorUser || []).map((x) => [x.user_id, x.total]))
    const afazeresMap = Object.fromEntries((afazeresResumo || []).map((x) => [x.user_id, { total: x.total, concluidos: x.concluidos }]))

    const rows = (teamData || []).map((u) => {
      const fat = faturamentoMap[u.id] ?? 0
      const af = afazeresMap[u.id] || { total: 0, concluidos: 0 }
      const fatStr = typeof fat === "number" ? fat.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"
      const afStr = af.total > 0 ? `${af.concluidos} de ${af.total} tarefas` : "—"
      return `<tr><td class="team-desempenho-email">${(u.email || "").replace(/</g, "&lt;")}</td><td>${fatStr}</td><td>${afStr}</td></tr>`
    })
    listEl.innerHTML =
      rows.length === 0
        ? "<p class=\"view-hint\">Nenhum membro na equipe.</p>"
        : `<table class="table-team-desempenho"><thead><tr><th>Profissional</th><th>Faturamento (30 dias)</th><th>Tarefas concluídas</th></tr></thead><tbody>${rows.join("")}</tbody></table>`
  } catch (e) {
    console.error("[TEAM] desempenho", e)
    listEl.innerHTML = "<p class=\"view-hint\">Erro ao carregar desempenho.</p>"
  }
}

function bindGoogleCalendarButtons() {
  document.querySelectorAll(".btnGoogleSync").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const userId = btn.dataset.user
      if (!userId) return
      try {
        btn.disabled = true
        const res = await syncCalendar(userId)
        toast(res.blocksCreated != null ? `Sincronizado. ${res.blocksCreated} bloco(s) de indisponibilidade.` : "Sincronizado.")
        await renderTeam()
      } catch (e) {
        toast(e.message || "Erro ao sincronizar")
      } finally {
        btn.disabled = false
      }
    })
  })
  document.querySelectorAll(".btnGoogleDisconnect").forEach((btn) => {
    btn.addEventListener("click", () => {
      const userId = btn.dataset.user
      if (!userId) return
      openConfirmModal(
        "Desconectar Google Agenda?",
        "Os blocos de indisponibilidade vindos do Google deixarão de ser atualizados. Blocos manuais continuam.",
        async () => {
          try {
            await disconnectCalendar(userId)
            toast("Google Agenda desconectada.")
            await renderTeam()
          } catch (e) {
            toast(e.message || "Erro ao desconectar")
          }
        }
      )
    })
  })
  document.querySelectorAll(".btnGoogleConnect").forEach((a) => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href")
      if (href && href.startsWith("http")) {
        e.preventDefault()
        window.location.href = href
      }
    })
  })
}


function bindTeamCardClicks() {
  document.querySelectorAll(".team-member-card-main").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target.closest("button") || e.target.closest("a")) return
      const userId = el.dataset.userId
      if (userId) {
        toast("Abrindo perfil…")
        openProfissionalPerfil(userId)
      }
    })
    el.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return
      e.preventDefault()
      const userId = el.dataset.userId
      if (userId) {
        toast("Abrindo perfil…")
        openProfissionalPerfil(userId)
      }
    })
  })
  document.querySelectorAll(".team-card-actions-hint").forEach((hint) => {
    hint.addEventListener("click", (e) => {
      e.preventDefault()
      const card = hint.closest(".team-member-card")
      const main = card?.querySelector(".team-member-card-main")
      const userId = main?.dataset?.userId
      if (userId) {
        toast("Abrindo perfil…")
        openProfissionalPerfil(userId)
      }
    })
  })
}

/** Menu ⋮ no canto do card: abre/fecha dropdown; fecha ao clicar fora */
function bindTeamCardMenus() {
  const lista = document.getElementById("listaTeam")
  if (!lista) return
  lista.querySelectorAll(".team-member-card").forEach((card) => {
    const menuBtn = card.querySelector(".team-member-card-menu-btn")
    const dropdown = card.querySelector(".team-member-card-dropdown")
    if (!menuBtn || !dropdown) return
    menuBtn.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      const isOpen = !dropdown.classList.contains("hidden")
      lista.querySelectorAll(".team-member-card-dropdown").forEach((d) => d.classList.add("hidden"))
      if (!isOpen) dropdown.classList.remove("hidden")
    })
    dropdown.addEventListener("click", (e) => e.stopPropagation())
    dropdown.querySelectorAll(".team-member-card-dropdown-item").forEach((btn) => {
      btn.addEventListener("click", () => dropdown.classList.add("hidden"))
    })
  })
  document.addEventListener("click", () => {
    lista.querySelectorAll(".team-member-card-dropdown").forEach((d) => d.classList.add("hidden"))
  })
}

function bindRemoveUser(){

 const buttons =
  document.querySelectorAll(
   ".btnRemoveUser"
  )

 buttons.forEach(btn=>{
  btn.onclick = () =>
   removeUser(
    btn.dataset.user,
    btn.dataset.email,
    btn.dataset.role
   )
 })
}

function bindProcedimentosProf() {
  document.querySelectorAll(".btnProcedimentosProf").forEach((btn) => {
    btn.onclick = async () => {
      const userId = btn.dataset.user
      const email = btn.dataset.email
      if (!userId) return
      const procedures = await listProcedures(true).catch(() => [])
      const selectedIds = await getProcedureIdsByProfessional(userId).catch(() => [])
      const checkboxesHtml = procedures.length === 0
        ? "<p>Nenhum procedimento cadastrado. Cadastre em Procedimentos primeiro.</p>"
        : procedures.map((p) => `<label><input type="checkbox" name="procProf" value="${p.id}" ${selectedIds.length === 0 || selectedIds.includes(p.id) ? "checked" : ""}> ${(p.name || "").replace(/</g, "&lt;")}</label>`).join("<br>")
      openModal(
        `Procedimentos que ${(email || "").slice(0, 25)} realiza`,
        `<p class="team-proc-hint">Marque os procedimentos que este profissional realiza. No agendamento, só aparecem profissionais compatíveis com o procedimento escolhido.</p><div class="team-proc-list">${checkboxesHtml}</div>`,
        async () => {
          const ids = Array.from(document.querySelectorAll("input[name=procProf]:checked")).map((c) => c.value).filter(Boolean)
          await setProceduresForProfessional(userId, ids)
          closeModal()
          toast("Procedimentos atualizados.")
        }
      )
    }
  })
}
function removeUser(
 userId,
 email,
 role
){
 openConfirmModal("Remover da clínica?", `Remover ${email} da clínica?`, async () => {
  try{

  await removeUserFromOrg(userId)

  await audit({
   action: "team.remove_user",
   tableName: "organization_users",
   recordId: userId,
   permissionUsed: "team:remove",
   metadata: {
    removed_user_email: email,
    removed_user_role: role
   }
  })

  toast("Usuário removido")
  renderTeam()

 }catch(err){

  console.error(
   "[TEAM] erro remove",
   err
  )

  toast("Erro ao remover usuário")
 }
 })
}


/* =====================
   MODAL
===================== */

function openInvite(){

 openModal(
  "Convidar usuário",
  `
   <label for="inviteEmail">E-mail do convidado</label>
   <input id="inviteEmail" type="email" placeholder="email@exemplo.com">
   <p class="form-hint">O convite será enviado para este e-mail; a pessoa usará esse mesmo e-mail para entrar na clínica.</p>
   <label for="inviteRole">Função</label>
   <select id="inviteRole">
    <option value="staff">Funcionário</option>
    <option value="viewer">Visualização</option>
   </select>
  `,
  sendInvite
 )
}


/* =====================
   ACTION
===================== */

async function sendInvite() {
  const emailInput = document.getElementById("inviteEmail");
  const roleInput = document.getElementById("inviteRole");
  if (!emailInput?.value?.trim()) {
    toast("Informe o e-mail");
    return;
  }
  const email = emailInput.value.trim();
  const role = roleInput?.value || "staff";
  const orgId = getActiveOrg();
  if (!orgId) {
    toast("Organização não selecionada");
    return;
  }
  try {
    await createInvite({ orgId, email, role });
    const profile = await getOrganizationProfile().catch(() => ({}));
    const orgName = profile?.name || "";
    const base = getApiBase();
    const res = await fetch(base + "/api/send-invite-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role, orgName }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn("[TEAM] E-mail não enviado:", json?.error || res.status);
      toast("Convite registrado. E-mail de confirmação não foi enviado (verifique RESEND_API_KEY no servidor).");
    } else if (json.sent) {
      toast("Convite enviado! O funcionário receberá um e-mail com o link para aceitar.");
    } else {
      toast("Convite registrado. Configure RESEND_API_KEY no servidor para enviar o e-mail ao funcionário.");
    }
    closeModal();
    renderTeam();
  } catch (err) {
    console.error("[TEAM] erro invite", err);
    toast(err?.message || "Erro ao enviar convite");
  }
}

/* =====================
   MODELO DE PAGAMENTO (só master)
===================== */

/** Busca nomes em profiles para os user_ids (para exibir na forma de pagamento). */
async function getDisplayNamesByUserIds(userIds) {
  if (!userIds || userIds.length === 0) return {}
  const { data } = await supabase.from("profiles").select("id, nome").in("id", userIds)
  const map = {}
  for (const row of data || []) {
    if (row.id && (row.nome || "").trim()) map[row.id] = (row.nome || "").trim()
  }
  return map
}

async function renderTeamPaymentIfMaster() {
  const wrap = document.getElementById("teamPaymentWrap")
  const listEl = document.getElementById("listaTeamPayment")
  if (!wrap || !listEl) return
  try {
    const role = await getRole()
    if (role !== "master") {
      wrap.classList.add("hidden")
      return
    }
    wrap.classList.remove("hidden")
    const [members, models] = await Promise.all([
      getOrgMembers(),
      listTeamPaymentModels().catch(() => []),
    ])
    const userIds = (members || []).map((m) => m.user_id).filter(Boolean)
    const nomesByUser = await getDisplayNamesByUserIds(userIds)
    const modelByUser = (models || []).reduce((acc, m) => { acc[m.user_id] = m; return acc }, {})
    const labels = { fixo: "Salário fixo", percentual: "Comissão por procedimento", diaria: "Diária", combinado: "Fixo + comissão" }
    const roleLabels = { master: "Administrador", gestor: "Gestor", staff: "Colaborador", viewer: "Visualização" }
    if (!members || members.length === 0) {
      listEl.innerHTML = "<p class=\"team-payment-empty\">Nenhum membro na organização.</p>"
    } else {
      listEl.innerHTML = members.map((m) => {
        const pm = modelByUser[m.user_id]
        const resumo = pm ? (labels[pm.payment_type] || pm.payment_type) + (pm.valor_fixo != null ? ` · R$ ${Number(pm.valor_fixo).toFixed(2)}` : "") + (pm.percentual_procedimento != null ? ` · ${pm.percentual_procedimento}%` : "") + (pm.valor_diaria != null ? ` · R$ ${Number(pm.valor_diaria).toFixed(2)}/dia` : "") : "Não definido"
        const roleLabel = roleLabels[m.role] || "Colaborador"
        const displayName = nomesByUser[m.user_id] || roleLabel
        return `
          <div class="team-payment-card" data-user-id="${m.user_id}" data-display-name="${(displayName || "").replace(/"/g, "&quot;")}">
            <div>
              <strong class="team-payment-card-name">${(displayName || "").replace(/</g, "&lt;")}</strong>
              <span class="team-payment-card-role">${nomesByUser[m.user_id] ? ` · ${roleLabel}` : ""}</span>
              <br><span class="team-payment-resumo">${resumo}</span>
            </div>
            <button type="button" class="btn-secondary btn-edit-payment" data-user-id="${m.user_id}" data-display-name="${(displayName || "").replace(/"/g, "&quot;")}">${pm ? "Editar" : "Definir"}</button>
          </div>
        `
      }).join("")
      listEl.querySelectorAll(".btn-edit-payment").forEach((btn) => {
        btn.onclick = () => openPaymentModal(btn.dataset.userId, btn.dataset.displayName || "Membro")
      })
    }
  } catch (e) {
    wrap.classList.add("hidden")
  }
}

function openPaymentModal(userId, displayName) {
  const titleName = (displayName || "este profissional").replace(/</g, "&lt;")
  listTeamPaymentModels().then((models) => {
    const m = (models || []).find((x) => x.user_id === userId)
    const currentType = m?.payment_type || "fixo"
    const tipos = [
      { value: "fixo", label: "Salário fixo", hint: "Valor mensal fixo combinado." },
      { value: "percentual", label: "Comissão por procedimento", hint: "Percentual sobre o valor de cada procedimento realizado." },
      { value: "diaria", label: "Diária", hint: "Valor pago por dia de trabalho." },
      { value: "combinado", label: "Fixo + comissão", hint: "Salário base + percentual sobre procedimentos." },
    ]
    const typeRadios = tipos.map((t) => `
      <label class="team-payment-type-option ${currentType === t.value ? "is-selected" : ""}" data-type="${t.value}">
        <input type="radio" name="paymentType" value="${t.value}" ${currentType === t.value ? "checked" : ""}>
        <span class="team-payment-type-label">${t.label}</span>
        <span class="team-payment-type-hint">${t.hint}</span>
      </label>
    `).join("")
    openModal(
      "Como " + titleName + " é pago?",
      `
      <p class="team-payment-modal-intro">Escolha o tipo e preencha os valores. Esses dados são só para sua análise; o sistema não processa pagamentos.</p>
      <div class="team-payment-type-group" id="paymentTypeGroup">
        ${typeRadios}
      </div>
      <div class="team-payment-fields-wrap" id="paymentFieldsWrap">
        <div class="team-payment-field" data-types="fixo,combinado">
          <label for="paymentValorFixo">Valor fixo (R$/mês)</label>
          <input type="number" id="paymentValorFixo" step="0.01" min="0" value="${m && m.valor_fixo != null ? m.valor_fixo : ""}" placeholder="Ex.: 3500">
          <span class="team-payment-field-hint">Valor bruto mensal combinado.</span>
        </div>
        <div class="team-payment-field" data-types="percentual,combinado">
          <label for="paymentPercentual">Percentual por procedimento (%)</label>
          <input type="number" id="paymentPercentual" step="0.01" min="0" max="100" value="${m && m.percentual_procedimento != null ? m.percentual_procedimento : ""}" placeholder="Ex.: 30">
          <span class="team-payment-field-hint">Sobre o valor cobrado do cliente no procedimento.</span>
        </div>
        <div class="team-payment-field" data-types="diaria,combinado">
          <label for="paymentDiaria">Valor da diária (R$)</label>
          <input type="number" id="paymentDiaria" step="0.01" min="0" value="${m && m.valor_diaria != null ? m.valor_diaria : ""}" placeholder="Ex.: 400">
          <span class="team-payment-field-hint">Valor pago por dia trabalhado.</span>
        </div>
        <div class="team-payment-field team-payment-field-obs" data-types="fixo,percentual,diaria,combinado">
          <label for="paymentObs">Observação (opcional)</label>
          <input type="text" id="paymentObs" value="${m && m.observacao ? m.observacao.replace(/"/g, "&quot;") : ""}" placeholder="Ex.: mínimo 10 procedimentos/mês, meta de faturamento">
        </div>
      </div>
      <input type="hidden" id="paymentUserId" value="${userId}">
      `,
      () => submitPaymentModel(userId)
    )
    const typeGroup = document.getElementById("paymentTypeGroup")
    const fieldsWrap = document.getElementById("paymentFieldsWrap")
    const fields = Array.from(document.querySelectorAll(".team-payment-field"))
    const updateVisibility = () => {
      const tipo = document.querySelector("input[name=paymentType]:checked")?.value || "fixo"
      fields.forEach((f) => {
        const allowed = (f.dataset.types || "").split(",").map((s) => s.trim())
        f.style.display = allowed.includes(tipo) ? "" : "none"
      })
      typeGroup.querySelectorAll(".team-payment-type-option").forEach((el) => {
        el.classList.toggle("is-selected", el.dataset.type === tipo)
      })
    }
    typeGroup?.querySelectorAll(".team-payment-type-option").forEach((label) => {
      label.addEventListener("click", () => {
        const radio = label.querySelector('input[type="radio"]')
        if (radio) radio.checked = true
        updateVisibility()
      })
    })
    document.querySelectorAll('input[name=paymentType]').forEach((r) => r.addEventListener("change", updateVisibility))
    updateVisibility()
  }).catch(() => toast("Erro ao carregar"))
}

async function submitPaymentModel(userId) {
  const tipo = document.querySelector('input[name=paymentType]:checked')?.value || document.getElementById("paymentType")?.value || "fixo"
  const valorFixo = document.getElementById("paymentValorFixo")?.value
  const percentual = document.getElementById("paymentPercentual")?.value
  const diaria = document.getElementById("paymentDiaria")?.value
  const obs = document.getElementById("paymentObs")?.value
  try {
    await upsertTeamPaymentModel({
      userId,
      paymentType: tipo,
      valorFixo: valorFixo || null,
      percentualProcedimento: percentual || null,
      valorDiaria: diaria || null,
      observacao: obs || null,
    })
    closeModal()
    renderTeamPaymentIfMaster()
    toast("Modelo de pagamento registrado.")
  } catch (e) {
    toast(e.message || "Erro ao salvar")
  }
}

/* =====================
   AFAZERES
===================== */

async function renderAfazeres() {
  const listEl = document.getElementById("listaAfazeres")
  if (!listEl) return
  try {
    const afazeres = await listAfazeres()
    const members = await getOrgMembers()
    const memberIds = new Set((members || []).map((m) => m.user_id))
    const label = (uid) => {
      if (!uid) return "—"
      const m = (members || []).find((x) => x.user_id === uid)
      return m ? (m.role || "Membro") + " (" + (uid || "").slice(0, 8) + "…)" : (uid || "").slice(0, 8) + "…"
    }
    const tipoLabel = (tipo) => TIPOS_AFAZERES[tipo] || tipo || "Geral"
    if (!afazeres || afazeres.length === 0) {
      listEl.innerHTML = "<p class=\"team-afazeres-empty\">Nenhum afazer. Clique em \"+ Novo afazer\".</p>"
    } else {
      listEl.innerHTML = afazeres.map((a) => {
        const prazoStr = a.prazo ? new Date(a.prazo).toLocaleDateString("pt-BR") : "—"
        const tipoClass = `afazer-tipo--${a.tipo || "geral"}`
        return `
          <div class="afazer-card afazer-card--${a.status} ${tipoClass}" data-id="${a.id}">
            <div>
              <span class="afazer-tipo-badge">${tipoLabel(a.tipo)}</span>
              <strong>${(a.titulo || "").replace(/</g, "&lt;")}</strong>
              <br><span class="afazer-meta">Responsável: ${label(a.responsavel_user_id)} · Prazo: ${prazoStr} · ${a.status}</span>
              ${a.descricao ? `<p class="afazer-desc">${(a.descricao || "").slice(0, 80).replace(/</g, "&lt;")}${a.descricao.length > 80 ? "…" : ""}</p>` : ""}
            </div>
            <div>
              <button type="button" class="btn-secondary btn-afazer-concluir" data-id="${a.id}" data-status="${a.status}">${a.status === "concluido" ? "Concluído" : "Concluir"}</button>
              <button type="button" class="btn-secondary btn-afazer-del" data-id="${a.id}">Excluir</button>
            </div>
          </div>
        `
      }).join("")
      listEl.querySelectorAll(".btn-afazer-concluir").forEach((btn) => {
        btn.onclick = () => toggleAfazerConcluido(btn.dataset.id, btn.dataset.status)
      })
      listEl.querySelectorAll(".btn-afazer-del").forEach((btn) => {
        btn.onclick = () => confirmDeleteAfazer(btn.dataset.id)
      })
    }
  } catch (e) {
    listEl.innerHTML = "<p class=\"team-afazeres-empty\">Erro ao carregar afazeres.</p>"
  }
}

function openNovoAfazerModal() {
  getOrgMembers().then((members) => {
    const memOpts = "<option value=\"\">Nenhum</option>" + (members || []).map((m) => `<option value="${m.user_id}">${m.role || "Membro"} (${(m.user_id || "").slice(0, 8)}…)</option>`).join("")
    const tipoOpts = Object.entries(TIPOS_AFAZERES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")
    openModal(
      "Novo afazer",
      `
      <label for="afazerTipo">Tipo de tarefa</label>
      <select id="afazerTipo">${tipoOpts}</select>
      <p class="form-hint">Tarefas como "Atendimento remoto" e "Conferência de estoque" não ocupam sala na agenda.</p>
      <label for="afazerTitulo">Título</label>
      <input type="text" id="afazerTitulo" placeholder="Ex: Análise de skincare remoto" required>
      <label for="afazerDesc">Descrição (opcional)</label>
      <textarea id="afazerDesc" rows="2" placeholder="Detalhes"></textarea>
      <label for="afazerResponsavel">Responsável</label>
      <select id="afazerResponsavel">${memOpts}</select>
      <label for="afazerPrazo">Prazo (opcional)</label>
      <input type="date" id="afazerPrazo">
      `,
      submitNovoAfazer
    )
  }).catch(() => toast("Erro ao carregar equipe"))
}

async function submitNovoAfazer() {
  const tipo = document.getElementById("afazerTipo")?.value || "geral"
  const titulo = document.getElementById("afazerTitulo")?.value?.trim()
  const descricao = document.getElementById("afazerDesc")?.value?.trim()
  const responsavel = document.getElementById("afazerResponsavel")?.value?.trim() || null
  const prazo = document.getElementById("afazerPrazo")?.value || null
  if (!titulo) { toast("Informe o título"); return }
  try {
    await createAfazer({ responsavelUserId: responsavel, titulo, descricao, prazo, tipo })
    closeModal()
    renderAfazeres()
    toast("Afazer criado.")
  } catch (e) {
    toast(e.message || "Erro ao criar")
  }
}

async function toggleAfazerConcluido(id, currentStatus) {
  const novo = currentStatus === "concluido" ? "pendente" : "concluido"
  try {
    await updateAfazer(id, { status: novo })
    renderAfazeres()
    toast(novo === "concluido" ? "Marcado como concluído." : "Reaberto.")
  } catch (e) {
    toast(e.message || "Erro")
  }
}

function confirmDeleteAfazer(id) {
  openConfirmModal("Excluir afazer?", "Excluir este afazer?", async () => {
    try {
      await deleteAfazer(id)
      renderAfazeres()
      toast("Afazer excluído.")
    } catch (e) {
      toast(e.message || "Erro ao excluir")
    }
  })
}

async function renderIndiceCuidado() {
  const wrap = document.getElementById("teamIndiceCuidadoWrap")
  const listEl = document.getElementById("listaIndiceCuidado")
  if (!wrap || !listEl) return
  try {
    const items = await getIndiceCuidado()
    if (!items || items.length === 0) {
      listEl.innerHTML = "<p class=\"team-indice-empty\">Nenhuma avaliação de produto ainda. As avaliações feitas em <strong>Estoque</strong> aparecem aqui.</p>"
      return
    }
    listEl.innerHTML = `
      <table class="team-indice-table" aria-label="Índice de cuidado por profissional">
        <thead><tr><th>Profissional</th><th>Avaliações</th><th>Média (1–5)</th></tr></thead>
        <tbody>
          ${items.map((i) => `
            <tr>
              <td>${escapeHtml(i.user_email || "—")}</td>
              <td>${i.total_avaliacoes}</td>
              <td>${i.media_nota}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `
  } catch (err) {
    console.warn("[TEAM] Índice de cuidado", err)
    listEl.innerHTML = "<p class=\"team-indice-empty\">Não foi possível carregar. Confira se a tabela <code>produto_avaliacoes</code> existe (script supabase-produto-avaliacoes.sql).</p>"
  }
}

function escapeHtml(s) {
  if (s == null) return ""
  const div = document.createElement("div")
  div.textContent = String(s)
  return div.innerHTML
}
