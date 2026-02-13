import { getRole } from "../services/permissions.service.js"
import { supabase } from "../core/supabase.js"
import { withOrg } from "../core/org.js"
import { navigate } from "../core/spa.js"
import { PAGAMENTO_APP_ENABLED } from "../core/feature-flags.js"
import { init as initMasterDashboard } from "./master.dashboard.views.js"

export async function init() {
  const role = await getRole()
  if (role !== "master") {
    alert("Acesso negado")
    location.hash = "dashboard"
    return
  }

  const cardPagamento = document.getElementById("masterCardPagamento")
  if (cardPagamento) cardPagamento.style.display = PAGAMENTO_APP_ENABLED ? "" : "none"

  bindCardLinks()
  await renderResumo()
  await renderConvites()
  initMasterDashboard()
}

function bindCardLinks() {
  const container = document.getElementById("view-master")
  if (!container) return
  container.querySelectorAll(".master-settings-card[data-view] .master-card-btn").forEach((btn) => {
    const card = btn.closest(".master-settings-card")
    const view = card?.dataset?.view
    if (view) btn.addEventListener("click", () => navigate(view))
  })
  container.querySelectorAll("a[data-view]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault()
      navigate(link.dataset.view)
    })
  })
}

async function renderResumo() {
  const el = document.getElementById("masterTotalUsers")
  if (!el) return
  try {
    const { data: users } = await withOrg(supabase.from("organization_users").select("id"))
    el.textContent = (users || []).length
  } catch (_) {
    el.textContent = "—"
  }
}

async function renderConvites() {
  const box = document.getElementById("masterListaConvites")
  if (!box) return
  try {
    const { data } = await withOrg(
      supabase.from("convites").select("*").eq("status", "pending")
    )
    box.innerHTML = ""
    ;(data || []).forEach((c) => {
      const li = document.createElement("li")
      li.innerHTML = `${escapeHtml(c.email)} <button type="button" class="btn-small btn-approve-invite" data-id="${c.id}">Aprovar</button>`
      li.querySelector(".btn-approve-invite").onclick = () => aprovar(c.id)
      box.appendChild(li)
    })
    if ((data || []).length === 0) {
      box.innerHTML = "<li class=\"master-convites-empty\">Nenhum convite pendente.</li>"
    }
  } catch (_) {
    box.innerHTML = "<li class=\"master-convites-empty\">Erro ao carregar.</li>"
  }
}

function escapeHtml(s) {
  if (s == null) return ""
  const div = document.createElement("div")
  div.textContent = s
  return div.innerHTML
}

/* =====================
   APROVAR
===================== */

async function aprovar(id) {
  const { error } = await supabase.rpc("approve_invite", { p_invite_id: id })
  if (error) {
    alert("Erro ao aprovar")
    return
  }
  alert("Aprovado")
  await renderConvites()
}
