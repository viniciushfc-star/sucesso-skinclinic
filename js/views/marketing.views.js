import { gerarMarketing } from "../services/marketing.service.js"
import { getOrganizationProfile } from "../services/organization-profile.service.js"
import { listProcedures } from "../services/procedimentos.service.js"
import { supabase } from "../core/supabase.js"
import { getActiveOrg } from "../core/org.js"
import { toast } from "../ui/toast.js"
import { navigate } from "../core/spa.js"

export async function init() {
  const btnGerarMarketing = document.getElementById("btnGerarMarketing")
  const btnParaCalendario = document.getElementById("btnMarketingParaCalendario")
  const nicho = document.getElementById("nicho")
  const cidade = document.getElementById("cidade")
  const ticket = document.getElementById("ticket")
  const procedimentos = document.getElementById("procedimentos")
  const resultadoMarketing = document.getElementById("resultadoMarketing")

  if (!btnGerarMarketing || !resultadoMarketing) return

  // Cruzar dados: preencher cidade/região e procedimentos a partir da empresa e do catálogo
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
  } catch (_) {
    // mantém campos vazios se falhar
  }

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
        } catch (_) {
          // Tabela marketing_ia pode não existir
        }
      }
    } catch (err) {
      console.error("[MARKETING]", err)
      resultadoMarketing.textContent = "Erro ao consultar o Copilot de Marketing."
      toast("Erro ao gerar sugestões")
    }
  }
}
