import { gerarMarketing, loadMarketingCampaigns } from "../services/marketing.service.js"
import { getOrganizationProfile } from "../services/organization-profile.service.js"
import { listProcedures } from "../services/procedimentos.service.js"
import { supabase } from "../core/supabase.js"
import { getActiveOrg } from "../core/org.js"
import { toast } from "../ui/toast.js"
import { navigate } from "../core/spa.js"
import { MKT_DISCLAIMER, MKT_FRASE } from "../utils/marketing-intelligence.js"

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
}

function renderCampaigns(list) {
  const el = document.getElementById("marketingIntelList")
  if (!el) return
  if (!list.length) {
    el.innerHTML = `<p class="view-hint">Radar do CRM sem sinais agora. Não inventamos campanha nem preço de concorrente.</p>`
    return
  }
  el.innerHTML = list.map((c) => `
    <article class="mkt-intel-card">
      <h4>${escapeHtml(c.objetivo)}</h4>
      <p><strong>Público:</strong> ${escapeHtml(c.publico)} (${c.tamanhoPublico})</p>
      <p><strong>Custo estimado:</strong> ${escapeHtml(c.custoEstimado)}</p>
      <p><strong>Métrica:</strong> ${escapeHtml(c.metrica)}</p>
      <p><strong>Prazo:</strong> ${escapeHtml(c.prazo)}</p>
      <p><strong>Risco:</strong> ${escapeHtml(c.risco)}</p>
      <p><strong>Como medir:</strong> ${escapeHtml(c.comoMedir)}</p>
      <p><strong>Canal:</strong> ${escapeHtml(c.canal)}</p>
      <p class="mkt-intel-disclaimer">${escapeHtml(c.disclaimer || MKT_DISCLAIMER)}</p>
      <button type="button" class="btn-secondary mkt-intel-crm" data-sinal="${escapeHtml(c.sinal)}">Abrir fila do CRM</button>
    </article>
  `).join("")
  el.querySelectorAll(".mkt-intel-crm").forEach((btn) => {
    btn.onclick = () => navigate("crm")
  })
}

export async function init() {
  const btnGerarMarketing = document.getElementById("btnGerarMarketing")
  const btnParaCalendario = document.getElementById("btnMarketingParaCalendario")
  const nicho = document.getElementById("nicho")
  const cidade = document.getElementById("cidade")
  const ticket = document.getElementById("ticket")
  const procedimentos = document.getElementById("procedimentos")
  const resultadoMarketing = document.getElementById("resultadoMarketing")
  const fraseEl = document.getElementById("marketingIntelFrase")
  if (fraseEl) fraseEl.textContent = MKT_FRASE

  try {
    const campanhas = await loadMarketingCampaigns()
    renderCampaigns(campanhas)
  } catch (e) {
    console.warn("[MARKETING] intel", e)
    renderCampaigns([])
  }

  if (!btnGerarMarketing || !resultadoMarketing) return

  try {
    const [profile, procedures] = await Promise.all([
      getOrganizationProfile().catch(() => ({})),
      listProcedures(true).catch(() => [])
    ])
    if (cidade && (profile.cidade || profile.estado)) {
      const regiao = [profile.cidade, profile.estado].filter(Boolean).join(", ")
      if (regiao && !cidade.value?.trim()) cidade.value = regiao
    }
    if (procedimentos && Array.isArray(procedures) && procedures.length > 0) {
      const nomes = procedures.map((p) => (p.name != null ? p.name : p.nome)).filter(Boolean).join(", ")
      if (nomes && !procedimentos.value?.trim()) procedimentos.value = nomes
    }
  } catch (_) {}

  if (btnParaCalendario && resultadoMarketing) {
    btnParaCalendario.onclick = () => {
      const texto = (resultadoMarketing.textContent || "").trim()
      if (!texto || texto.startsWith("Erro") || texto.startsWith("Gerando")) {
        toast("Gere uma sugestão antes de adicionar ao calendário.")
        return
      }
      try {
        sessionStorage.setItem("calendario_paste_content", texto)
        navigate("calendario-conteudo")
      } catch (e) {
        toast("Erro ao ir para o calendário.")
      }
    }
  }

  btnGerarMarketing.onclick = async () => {
    const payload = {
      nicho: nicho?.value?.trim() || "",
      cidade: cidade?.value?.trim() || "",
      ticket: ticket?.value?.trim() || "",
      procedimentos: procedimentos?.value?.trim() || "",
      org_id: getActiveOrg() || undefined
    }

    resultadoMarketing.textContent = "Gerando sugestões…"

    try {
      const res = await gerarMarketing(payload)

      if (res.error) {
        resultadoMarketing.textContent = "Erro: " + (res.error || "Tente novamente.")
        toast("Erro ao gerar sugestões")
        return
      }

      resultadoMarketing.textContent = res.content || "Nenhuma sugestão retornada."

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        try {
          await supabase.from("marketing_ia").insert({
            user_id: user.id,
            org_id: getActiveOrg() || null,
            entrada: payload,
            resultado: res
          })
        } catch (_) {}
      }
    } catch (err) {
      console.error("[MARKETING]", err)
      resultadoMarketing.textContent = "Erro ao consultar o Copilot de Marketing."
      toast("Erro ao gerar sugestões")
    }
  }
}
