/**
 * Perfil do profissional — mesmo padrão do perfil do cliente.
 * Cabeçalho (foto/iniciais, nome, cargo) e abas: Cadastro, Faturamento, Tarefas, Metas, Ranking, Análise, Bonificação.
 */

import { getTeam } from "../services/user.service.js"
import { getFaturamentoPorUsuario } from "../services/financeiro.service.js"
import { listAfazeres, getAfazeresResumoPorUsuario } from "../services/afazeres.service.js"
import { getIndiceCuidado } from "../services/produto-avaliacoes.service.js"
import { getConnectUrl, getCalendarConnectionsStatus } from "../services/google-calendar.service.js"
import { getProcedureIdsByProfessional } from "../services/professional-procedures.service.js"
import { listProcedures } from "../services/procedimentos.service.js"
import { navigate } from "../core/spa.js"
import { getRole } from "../services/permissions.service.js"
import { toast } from "../ui/toast.js"

const ROLE_LABEL = { staff: "Funcionário", gestor: "Gestor", master: "Administrador", viewer: "Visualização" }

function escapeHtml(s) {
  if (s == null) return ""
  const div = document.createElement("div")
  div.textContent = s
  return div.innerHTML
}

function formatCurrency(v) {
  if (v == null || Number.isNaN(v)) return "—"
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export async function init() {
  const userId = sessionStorage.getItem("profissionalPerfilId")
  if (!userId) {
    toast("Selecione um profissional na lista da equipe.")
    navigate("team")
    return
  }

  const container = document.getElementById("profissionalPerfilContent")
  if (!container) return

  try {
    const { data: teamData, error } = await getTeam()
    if (error || !teamData?.length) {
      toast("Não foi possível carregar a equipe. Tente novamente.")
      navigate("team")
      return
    }
    const member = teamData.find((u) => u.id === userId || u.user_id === userId)
    if (!member) {
      toast("Perfil do profissional não encontrado.")
      sessionStorage.removeItem("profissionalPerfilId")
      navigate("team")
      return
    }

    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    const startStr = start.toISOString().slice(0, 10)
    const endStr = end.toISOString().slice(0, 10)

    const [faturamentoList, afazeresResumo, indiceCuidado, googleStatus, procedures, procedureIds] = await Promise.all([
      getFaturamentoPorUsuario(startStr, endStr).catch(() => []),
      getAfazeresResumoPorUsuario().catch(() => []),
      getIndiceCuidado().catch(() => []),
      getCalendarConnectionsStatus().catch(() => ({ connections: [] })),
      listProcedures(true).catch(() => []),
      getProcedureIdsByProfessional(userId).catch(() => []),
    ])

    const faturamentoUser = (faturamentoList || []).find((f) => f.user_id === userId)
    const afazerUser = (afazeresResumo || []).find((a) => a.user_id === userId)
    const indiceUser = (indiceCuidado || []).find((i) => i.user_id === userId)
    const connected = (googleStatus.connections || []).some((c) => c.user_id === userId)
    const connectUrl = getConnectUrl(userId)

    const nome = (member.display_name || member.name || (member.email || "").split("@")[0] || "Profissional").trim()
    const iniciais = nome.split(/\s+/).slice(0, 2).map((w) => (w[0] || "").toUpperCase()).join("") || "?"
    const cargo = ROLE_LABEL[member.role] || member.role || "—"
    const fatTotal = faturamentoUser?.total ?? 0
    const afTotal = afazerUser?.total ?? 0
    const afConcluidos = afazerUser?.concluidos ?? 0
    const mediaNota = indiceUser?.media_nota ?? "—"
    const totalAvaliacoes = indiceUser?.total_avaliacoes ?? 0

    const procedimentosNomes = (procedures || [])
      .filter((p) => procedureIds.length === 0 || procedureIds.includes(p.id))
      .map((p) => p.name)
      .filter(Boolean)
      .slice(0, 10)

    const isMaster = (await getRole()) === "master"

    container.innerHTML = `
      <div class="profissional-perfil">
        <div class="profissional-perfil-header">
          <div class="profissional-perfil-header-left">
            <span class="profissional-perfil-avatar-wrap">
              <span class="profissional-perfil-avatar-initials">${escapeHtml(iniciais)}</span>
            </span>
            <div class="profissional-perfil-titles">
              <button type="button" class="btn-back" id="btnVoltarEquipe" title="Voltar à Equipe">← Voltar</button>
              <h2>${escapeHtml(nome)}</h2>
              <p class="profissional-perfil-meta">
                <span class="profissional-perfil-cargo">${escapeHtml(cargo)}</span>
                ${member.email ? ` · ${escapeHtml(member.email)}` : ""}
              </p>
            </div>
          </div>
        </div>

        <div class="profissional-perfil-tabs">
          <button type="button" class="tab-btn active" data-tab="cadastro">Cadastro</button>
          <button type="button" class="tab-btn" data-tab="faturamento">Faturamento</button>
          <button type="button" class="tab-btn" data-tab="tarefas">Tarefas</button>
          <button type="button" class="tab-btn" data-tab="ranking">Ranking e análise</button>
          ${isMaster ? '<button type="button" class="tab-btn" data-tab="bonificacao">Bonificação</button>' : ""}
        </div>

        <div id="profTabCadastro" class="tab-pane active">
          <div class="view-card">
            <h3 class="view-card-title">Dados do profissional</h3>
            <p><strong>E-mail:</strong> ${escapeHtml(member.email || "—")}</p>
            <p><strong>Função na empresa:</strong> ${escapeHtml(cargo)}</p>
            <p><strong>Status:</strong> ${escapeHtml(member.status || "—")}</p>
            <p><strong>Google Agenda:</strong> ${connected ? "Conectada" : "Não conectada"} ${connectUrl && !connected ? ` · <a href="${connectUrl}" class="btn-link">Conectar</a>` : ""}</p>
            ${procedimentosNomes.length ? `<p><strong>Procedimentos que realiza:</strong> ${procedimentosNomes.map((n) => escapeHtml(n)).join(", ")}</p>` : "<p><strong>Procedimentos:</strong> Não definidos. Ajuste em Configurações → Equipe.</p>"}
          </div>
        </div>

        <div id="profTabFaturamento" class="tab-pane hidden">
          <div class="view-card">
            <h3 class="view-card-title">Faturamento (últimos 30 dias)</h3>
            <p class="profissional-perfil-faturamento-valor">${formatCurrency(fatTotal)}</p>
            <p class="view-hint">Valor das entradas no Financeiro vinculadas a agendamentos realizados por este profissional.</p>
          </div>
        </div>

        <div id="profTabTarefas" class="tab-pane hidden">
          <div class="view-card">
            <h3 class="view-card-title">Tarefas cumpridas</h3>
            <p><strong>${afConcluidos}</strong> de <strong>${afTotal}</strong> tarefas concluídas no período.</p>
            ${afTotal === 0 ? "<p class=\"view-hint\">Nenhum afazer atribuído ainda.</p>" : ""}
          </div>
        </div>

        <div id="profTabRanking" class="tab-pane hidden">
          <div class="view-card">
            <h3 class="view-card-title">Análise e avaliação</h3>
            <p><strong>Média de avaliações (índice de cuidado):</strong> ${escapeHtml(String(mediaNota))} ${totalAvaliacoes > 0 ? `(${totalAvaliacoes} avaliação(ões) de produtos)` : ""}</p>
            <p class="view-hint">Referência para desempenho e bonificação. Quanto mais o profissional avalia produtos, mais engajado está.</p>
          </div>
        </div>

        ${isMaster ? `
        <div id="profTabBonificacao" class="tab-pane hidden">
          <div class="view-card">
            <h3 class="view-card-title">Bonificação</h3>
            <p class="view-hint">Campo para anotar bônus ou reconhecimento a este profissional. Não processa pagamento.</p>
            <textarea id="profBonificacaoNotas" class="profissional-perfil-bonificacao-textarea" placeholder="Ex.: Bônus de desempenho em jan/2026, meta batida..." rows="4"></textarea>
          </div>
        </div>
        ` : ""}
      </div>
    `

    const btnVoltar = document.getElementById("btnVoltarEquipe")
    if (btnVoltar) btnVoltar.onclick = () => { sessionStorage.removeItem("profissionalPerfilId"); navigate("team") }

    container.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab
        if (!tab) return
        container.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab))
        container.querySelectorAll(".tab-pane").forEach((p) => {
          const id = p.id
          const isCadastro = id === "profTabCadastro" && tab === "cadastro"
          const isFaturamento = id === "profTabFaturamento" && tab === "faturamento"
          const isTarefas = id === "profTabTarefas" && tab === "tarefas"
          const isRanking = id === "profTabRanking" && tab === "ranking"
          const isBonificacao = id === "profTabBonificacao" && tab === "bonificacao"
          const isVisible = isCadastro || isFaturamento || isTarefas || isRanking || isBonificacao
          p.classList.toggle("active", isVisible)
          p.classList.toggle("hidden", !isVisible)
        })
      })
    })
  } catch (err) {
    console.error("[ProfissionalPerfil]", err)
    toast("Erro ao carregar o perfil. Tente novamente.")
    sessionStorage.removeItem("profissionalPerfilId")
    navigate("team")
  }
}
