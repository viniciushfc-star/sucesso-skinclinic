import { inviteUser, getTeam } from "../services/user.service.js"
import { toast } from "../ui/toast.js"
import { openModal, closeModal, openConfirmModal } from "../ui/modal.js"
import { audit } from "../services/audit.service.js"
import { removeUserFromOrg } from "../core/org.js"
import { getOrgMembers } from "../core/org.js"
import { getRole } from "../services/permissions.service.js"
import { listTeamPaymentModels, upsertTeamPaymentModel } from "../services/team-payment.service.js"
import { listAfazeres, createAfazer, updateAfazer, deleteAfazer, TIPOS_AFAZERES } from "../services/afazeres.service.js"
import { getProcedureIdsByProfessional, setProceduresForProfessional } from "../services/professional-procedures.service.js"
import { listProcedures } from "../services/procedimentos.service.js"
import { getIndiceCuidado } from "../services/produto-avaliacoes.service.js"
import {
  getConnectUrl,
  getCalendarConnectionsStatus,
  syncCalendar,
  disconnectCalendar,
} from "../services/google-calendar.service.js"


/* =====================
   SPA INIT
===================== */

export function init() {
  bindUI()
  checkGoogleCalendarCallback()
  renderTeam()
  renderAfazeres()
  renderTeamPaymentIfMaster()
  renderIndiceCuidado()
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

 listaTeam.innerHTML =
 data.map(u=>{
   const connected = connectedUserIds.has(u.id)
   const lastSync = lastSyncByUser[u.id]
   const lastSyncStr = lastSync ? new Date(lastSync).toLocaleString("pt-BR") : ""
   const connectUrl = getConnectUrl(u.id)
   return `
  <div class="item-card">
   <span class="team-card-email" title="E-mail de login deste usuário na clínica">${u.email}</span><br>
   <small class="team-card-role">${u.role} – ${u.status}</small><br>
   <div class="team-card-actions">
     <button type="button" class="btn-secondary btnProcedimentosProf" data-user="${u.id}" data-email="${u.email}" title="Quais procedimentos este profissional realiza (para agendamento)">Procedimentos que realiza</button>
     ${connected
       ? `<button type="button" class="btn-secondary btnGoogleSync" data-user="${u.id}" title="Atualizar blocos de indisponibilidade a partir do Google Agenda">Sincronizar agora</button>
          <button type="button" class="btn-small btnGoogleDisconnect" data-user="${u.id}" title="Desconectar Google Agenda">Desconectar Google</button>
          ${lastSyncStr ? `<small class="team-google-last-sync">Última sync: ${lastSyncStr}</small>` : ""}`
       : connectUrl
         ? `<a href="${connectUrl}" class="btn-secondary btnGoogleConnect" data-user="${u.id}" title="Conectar agenda Google para considerar compromissos externos na disponibilidade">Conectar Google Agenda</a>`
         : ""}
   </div>
   <button
    data-user="${u.id}"
    data-email="${u.email}"
    data-role="${u.role}"
    class="btnRemoveUser">
    Remover
   </button>
  </div>
 `
 }).join("")

bindRemoveUser()
bindProcedimentosProf()
bindGoogleCalendarButtons()

 }catch(err){

  console.error(
   "[TEAM] erro render",
   err
  )

  toast("Erro ao carregar equipe")
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
   <label>E-mail do convidado</label>
   <input id="inviteEmail" type="email" placeholder="email@exemplo.com">
   <p class="form-hint">O convite será enviado para este e-mail; a pessoa usará esse mesmo e-mail para entrar na clínica.</p>
   <label>Função</label>
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

async function sendInvite(){

 const emailInput =
  document.getElementById(
   "inviteEmailModal"
  )

 const roleInput =
  document.getElementById(
   "inviteRoleModal"
  )

 if(!emailInput.value){
  toast("Informe o email")
  return
 }

 try{

  await inviteUser(
   emailInput.value,
   roleInput.value
  )

  closeModal()
  renderTeam()
  toast("Convite enviado!")

 }catch(err){

  console.error(
   "[TEAM] erro invite",
   err
  )

  toast("Erro ao enviar convite")
  }
}

/* =====================
   MODELO DE PAGAMENTO (só master)
===================== */

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
    const modelByUser = (models || []).reduce((acc, m) => { acc[m.user_id] = m; return acc }, {})
    const labels = { fixo: "Salário fixo", percentual: "Porcentagem por procedimento", diaria: "Diária", combinado: "Combinado" }
    if (!members || members.length === 0) {
      listEl.innerHTML = "<p class=\"team-payment-empty\">Nenhum membro na organização.</p>"
    } else {
      listEl.innerHTML = members.map((m) => {
        const pm = modelByUser[m.user_id]
        const resumo = pm ? (labels[pm.payment_type] || pm.payment_type) + (pm.valor_fixo != null ? ` · R$ ${Number(pm.valor_fixo).toFixed(2)}` : "") + (pm.percentual_procedimento != null ? ` · ${pm.percentual_procedimento}%` : "") : "Não definido"
        return `
          <div class="team-payment-card" data-user-id="${m.user_id}">
            <div>
              <strong>${(m.role || "Membro")}</strong> <span class="team-payment-user-id">${(m.user_id || "").slice(0, 8)}…</span>
              <br><span class="team-payment-resumo">${resumo}</span>
            </div>
            <button type="button" class="btn-secondary btn-edit-payment" data-user-id="${m.user_id}">${pm ? "Editar" : "Definir"}</button>
          </div>
        `
      }).join("")
      listEl.querySelectorAll(".btn-edit-payment").forEach((btn) => {
        btn.onclick = () => openPaymentModal(btn.dataset.userId)
      })
    }
  } catch (e) {
    wrap.classList.add("hidden")
  }
}

function openPaymentModal(userId) {
  listTeamPaymentModels().then((models) => {
    const m = (models || []).find((x) => x.user_id === userId)
    const tipos = [
      { value: "fixo", label: "Salário fixo" },
      { value: "percentual", label: "Porcentagem por procedimento" },
      { value: "diaria", label: "Diária" },
      { value: "combinado", label: "Combinado" },
    ]
    const opts = tipos.map((t) => `<option value="${t.value}" ${m && m.payment_type === t.value ? "selected" : ""}>${t.label}</option>`).join("")
    openModal(
      "Modelo de pagamento (só registro; não executa pagamento)",
      `
      <label>Tipo</label>
      <select id="paymentType">${opts}</select>
      <div class="team-payment-field" data-types="fixo,combinado">
        <label>Valor fixo (R$)</label>
        <input type="number" id="paymentValorFixo" step="0.01" value="${m && m.valor_fixo != null ? m.valor_fixo : ""}" placeholder="Ex.: 3000,00">
      </div>
      <div class="team-payment-field" data-types="percentual,combinado">
        <label>Percentual por procedimento (%)</label>
        <input type="number" id="paymentPercentual" step="0.01" value="${m && m.percentual_procedimento != null ? m.percentual_procedimento : ""}" placeholder="Ex.: 30">
      </div>
      <div class="team-payment-field" data-types="diaria,combinado">
        <label>Valor diária (R$)</label>
        <input type="number" id="paymentDiaria" step="0.01" value="${m && m.valor_diaria != null ? m.valor_diaria : ""}" placeholder="Ex.: 500,00">
      </div>
      <div class="team-payment-field" data-types="fixo,percentual,diaria,combinado">
        <label>Observação</label>
        <input type="text" id="paymentObs" value="${m && m.observacao ? m.observacao.replace(/"/g, "&quot;") : ""}" placeholder="Ex.: mínimo de procedimentos, metas, combinações.">
      </div>
      <input type="hidden" id="paymentUserId" value="${userId}">
      `,
      () => submitPaymentModel(userId)
    )
    // Ajusta campos visíveis conforme o tipo escolhido (UX mais guiada)
    const select = document.getElementById("paymentType")
    const fields = Array.from(document.querySelectorAll(".team-payment-field"))
    const updateVisibility = () => {
      const tipo = select?.value || ""
      fields.forEach((f) => {
        const allowed = (f.dataset.types || "").split(",").map((s) => s.trim())
        f.style.display = allowed.includes(tipo) ? "" : "none"
      })
    }
    if (select) {
      select.addEventListener("change", updateVisibility)
      updateVisibility()
    }
  }).catch(() => toast("Erro ao carregar"))
}

async function submitPaymentModel(userId) {
  const tipo = document.getElementById("paymentType")?.value
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
      <label>Tipo de tarefa</label>
      <select id="afazerTipo">${tipoOpts}</select>
      <p class="form-hint">Tarefas como "Atendimento remoto" e "Conferência de estoque" não ocupam sala na agenda.</p>
      <label>Título</label>
      <input type="text" id="afazerTitulo" placeholder="Ex: Análise de skincare remoto" required>
      <label>Descrição (opcional)</label>
      <textarea id="afazerDesc" rows="2" placeholder="Detalhes"></textarea>
      <label>Responsável</label>
      <select id="afazerResponsavel">${memOpts}</select>
      <label>Prazo (opcional)</label>
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
