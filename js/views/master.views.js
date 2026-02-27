import { getRole } from "../services/permissions.service.js"
import { supabase } from "../core/supabase.js"
import { withOrg, getActiveOrg } from "../core/org.js"
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
  bindEquipeGerenciar()
  await renderResumo()
  await renderConvites()
  initMasterDashboard()
}

function bindEquipeGerenciar() {
  const btn = document.getElementById("btnMasterEquipe")
  if (btn) {
    btn.addEventListener("click", () => {
      sessionStorage.setItem("teamShowManage", "1")
      navigate("team")
    })
  }
}

function bindCardLinks() {
  /* Navegação dos cards (data-view) e links (a[data-view]) é feita pelo SPA (bindMenu com delegação). */
  /* Apenas o botão "Gerenciar equipe" é tratado em bindEquipeGerenciar (sem data-view no card). */
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
    const orgId = getActiveOrg();
    if (!orgId) {
      box.innerHTML = "<li class=\"master-convites-empty\">Selecione uma organização.</li>";
      return;
    }
    const { data } = await supabase
      .from("organization_invites")
      .select("*")
      .eq("org_id", orgId)
      .eq("status", "pending")
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
  const { error } = await supabase
    .from("organization_invites")
    .update({ status: "accepted" })
    .eq("id", id);
  if (error) {
    alert("Erro ao aprovar: " + (error.message || ""));
    return;
  }
  alert("Aprovado");
  await renderConvites();
}
