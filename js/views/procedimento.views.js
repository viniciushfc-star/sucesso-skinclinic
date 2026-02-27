/* =====================
   PROCEDIMENTOS – Tipos de serviço da clínica
===================== */

import { openModal, closeModal, openConfirmModal } from "../ui/modal.js";
import { toast } from "../ui/toast.js";
import {
  listProcedures,
  listProcedureCategories,
  createProcedure,
  createProcedureCategory,
  updateProcedure,
  deleteProcedure,
} from "../services/procedimentos.service.js";
import {
  listPlanosTerapeuticos,
  createPlanoTerapeutico,
  updatePlanoTerapeutico,
  deletePlanoTerapeutico,
} from "../services/planos-terapeuticos.service.js";
import { pedirOpiniaoCaso } from "../services/discussao-caso.service.js";
import { gerarPreco } from "../services/preco.service.js";
import { TIPOS_PROCEDIMENTO } from "../constants/tipos-procedimento.js";
import { importarLote, getTemplateHeaders } from "../services/importacao-lote.service.js";
import { getMargemEmRisco } from "../services/audit.service.js";
import { getCustoRealProcedimento } from "../services/estoque-entradas.service.js";
import { navigate } from "../core/spa.js";
import { getOrgMembers } from "../core/org.js";
import { getProcedimentosRealizadosPorPeriodo } from "../services/metrics.service.js";
import {
  getTaxasOrganizacao,
  getTaxaParaParcelas,
  calcularLiquido,
  valorBrutoMinimoParaMargem,
  margemReal,
} from "../services/precificacao-taxas.service.js";

/* =====================
   INIT
===================== */

export function init() {
  bindUI();
  renderProcedimentos();
  renderPlanosTerapeuticos();
  esconderAvisoTaxasPlanosSeConfigurado();
  initRelatorioProcedimentosRealizados();
  const editId = sessionStorage.getItem("procedimentoEditId");
  if (editId) {
    sessionStorage.removeItem("procedimentoEditId");
    setTimeout(() => openEditModal(editId), 200);
  }
}

/** Se as taxas já estiverem configuradas, esconde o aviso da seção de planos. */
async function esconderAvisoTaxasPlanosSeConfigurado() {
  const el = document.getElementById("procPlanosHintTaxas");
  if (!el) return;
  try {
    const taxas = await getTaxasOrganizacao();
    const temParceladoN = Array.from({ length: 11 }, (_, i) => taxas[`taxa_parcelado_${i + 2}_pct`] != null).some(Boolean);
    const configurado = taxas.taxa_avista_pct != null || taxas.taxa_avista_debito_pct != null || taxas.taxa_avista_credito_pct != null || taxas.taxa_parcelado_2_6_pct != null || taxas.taxa_parcelado_7_12_pct != null || temParceladoN;
    el.hidden = !!configurado;
  } catch (_) {
    el.hidden = false;
  }
}

function bindUI() {
  const btn = document.getElementById("btnNovoProcedimento");
  if (btn) btn.onclick = () => openCreateModal();
  const btnCat = document.getElementById("btnNovaCategoria");
  if (btnCat) btnCat.onclick = () => openNovaCategoriaModal();
  const toggle = document.getElementById("procFiltersToggle");
  const panel = document.getElementById("procFiltersPanel");
  if (toggle && panel) {
    toggle.onclick = () => {
      const isOpen = !panel.hidden;
      panel.hidden = isOpen;
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    };
  }
  const catEl = document.getElementById("procFilterCategory");
  const statusEl = document.getElementById("procFilterStatus");
  const valorEl = document.getElementById("procFilterValor");
  const sortEl = document.getElementById("procFilterSort");
  [catEl, statusEl, valorEl, sortEl].forEach((el) => {
    if (el) el.onchange = () => renderProcedimentos();
  });
  const planosToggle = document.getElementById("procPlanosToggle");
  const planosPanel = document.getElementById("procPlanosPanel");
  if (planosToggle && planosPanel) {
    planosToggle.onclick = () => {
      const isOpen = !planosPanel.hidden;
      planosPanel.hidden = isOpen;
      planosToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      if (isOpen) renderPlanosTerapeuticos();
    };
  }
  const btnCriarPlano = document.getElementById("btnCriarPlanoTerapeutico");
  if (btnCriarPlano) btnCriarPlano.onclick = () => openCreatePlanoModal();
  const discussaoToggle = document.getElementById("procDiscussaoToggle");
  const discussaoPanel = document.getElementById("procDiscussaoPanel");
  if (discussaoToggle && discussaoPanel) {
    discussaoToggle.onclick = () => {
      const isOpen = !discussaoPanel.hidden;
      discussaoPanel.hidden = isOpen;
      discussaoToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    };
  }
  const btnOpiniao = document.getElementById("btnPedirOpiniao");
  if (btnOpiniao) btnOpiniao.onclick = () => pedirOpiniao();

  const btnImport = document.getElementById("btnImportarProcedimentos");
  const inputImport = document.getElementById("importProcedimentosFile");
  if (btnImport && inputImport) {
    btnImport.onclick = () => inputImport.click();
    inputImport.onchange = async () => {
      const file = inputImport.files?.[0];
      if (!file) return;
      inputImport.value = "";
      const pularDuplicados = document.getElementById("procedimentosPularDuplicados")?.checked !== false;
      try {
        const r = await importarLote("procedimentos", file, { pularDuplicados });
        let msg = r.inseridos ? r.inseridos + " procedimento(s) importado(s)." : "Nenhum importado.";
        if (r.ignorados_duplicados > 0) msg += " " + r.ignorados_duplicados + " duplicado(s) ignorado(s).";
        toast(msg);
        if (r.erros?.length) toast("Erros: " + r.erros.length + " linha(s).", "warn");
        renderProcedimentos();
      } catch (e) {
        toast(e.message || "Erro ao importar.");
      }
    };
  }

  const btnModelo = document.getElementById("btnModeloProcedimentos");
  if (btnModelo) {
    btnModelo.onclick = (e) => {
      e.preventDefault();
      const headers = getTemplateHeaders("procedimentos");
      const line = headers.join(";");
      const blob = new Blob([line + "\n"], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "modelo_procedimentos.csv";
      a.click();
      toast("Modelo baixado!");
    };
  }
}

let relatorioProcedimentosRealizadosCache = [];

function initRelatorioProcedimentosRealizados() {
  const toggle = document.getElementById("procRelatorioToggle");
  const panel = document.getElementById("procRelatorioPanel");
  if (toggle && panel) {
    toggle.onclick = () => {
      const isOpen = !panel.hidden;
      panel.hidden = isOpen;
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      if (isOpen) {
        setDefaultRelatorioDates();
        populateRelatorioProfessionalSelect();
        runRelatorioProcedimentosRealizados();
      }
    };
  }
  document.getElementById("btnAtualizarRelatorioProc")?.addEventListener("click", () => runRelatorioProcedimentosRealizados());
  document.getElementById("btnExportarRelatorioProc")?.addEventListener("click", () => exportRelatorioProcedimentosCSV());
}

function setDefaultRelatorioDates() {
  const start = document.getElementById("relatorioProcStartProc");
  const end = document.getElementById("relatorioProcEndProc");
  if (!start || !end) return;
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  if (!start.value) start.value = firstDay.toISOString().slice(0, 10);
  if (!end.value) end.value = now.toISOString().slice(0, 10);
}

async function populateRelatorioProfessionalSelect() {
  const sel = document.getElementById("relatorioProcProfessionalProc");
  if (!sel) return;
  const members = await getOrgMembers().catch(() => []);
  sel.innerHTML = "<option value=\"\">Todos</option>" + (members || []).map((m) => `<option value="${m.user_id}">${escapeHtml(m.role || "Membro")}</option>`).join("");
}

async function runRelatorioProcedimentosRealizados() {
  const tableEl = document.getElementById("relatorioProcedimentosRealizadosTable");
  if (!tableEl) return;
  const start = document.getElementById("relatorioProcStartProc")?.value;
  const end = document.getElementById("relatorioProcEndProc")?.value;
  const professionalId = document.getElementById("relatorioProcProfessionalProc")?.value?.trim() || null;
  if (!start || !end) {
    tableEl.innerHTML = "<p class=\"procedimento-relatorio-empty\">Defina as datas De e Até e clique em Atualizar.</p>";
    return;
  }
  tableEl.innerHTML = "<p class=\"procedimento-relatorio-loading\">Carregando…</p>";
  try {
    const rows = await getProcedimentosRealizadosPorPeriodo(start, end, { professionalId });
    relatorioProcedimentosRealizadosCache = rows;
    if (!rows || rows.length === 0) {
      tableEl.innerHTML = "<p class=\"procedimento-relatorio-empty\">Nenhum procedimento realizado no período (agenda com procedure_id preenchido).</p>";
      return;
    }
    tableEl.innerHTML = `
      <table class="procedimento-relatorio-table">
        <thead><tr><th>Procedimento</th><th>Quantidade</th></tr></thead>
        <tbody>
          ${rows.map((r) => `<tr><td>${escapeHtml(r.procedure_name)}</td><td>${r.total}</td></tr>`).join("")}
        </tbody>
      </table>
    `;
  } catch (err) {
    console.error("[RELATÓRIO PROC]", err);
    tableEl.innerHTML = "<p class=\"procedimento-relatorio-error\">Erro ao carregar. Verifique se a tabela agenda tem procedure_id.</p>";
  }
}

function exportRelatorioProcedimentosCSV() {
  const rows = relatorioProcedimentosRealizadosCache;
  if (!rows || rows.length === 0) {
    toast("Atualize o relatório antes de exportar.");
    return;
  }
  const header = "Procedimento;Quantidade";
  const lines = [header, ...rows.map((r) => `${(r.procedure_name || "").replace(/;/g, ",")};${r.total}`)];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `procedimentos_realizados_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  toast("CSV exportado.");
}

/* =====================
   RENDER
===================== */

async function renderCardMargemRisco(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  try {
    const list = await getMargemEmRisco(30);
    if (!list.length) {
      el.classList.add("hidden");
      el.innerHTML = "";
      return;
    }
    el.classList.remove("hidden");
    const uniqueProducts = [...new Set(list.map((x) => x.produto_nome))];
    el.innerHTML = `
      <div class="card-margem-risco__inner">
        <span class="card-margem-risco__icon" aria-hidden="true">⚠️</span>
        <div class="card-margem-risco__text">
          <strong>Margem em risco:</strong> ${uniqueProducts.length} produto(s) com aumento de custo recente (≥15%).
          Revise precificação ou fornecedor.
        </div>
        <a href="#auditoria" class="btn-secondary btn-sm card-margem-risco__link">Ver na Auditoria</a>
      </div>
    `;
  } catch (_) {
    el.classList.add("hidden");
    el.innerHTML = "";
  }
}

export async function renderProcedimentos() {
  const listEl = document.getElementById("listaProcedimentos");
  const filterCatEl = document.getElementById("procFilterCategory");
  if (!listEl) return;

  renderCardMargemRisco("procedimentoCardMargemRisco");

  try {
    let categories = [];
    try {
      categories = await listProcedureCategories();
    } catch (_) {}
    if (filterCatEl) {
      const current = (filterCatEl.value || "").trim();
      filterCatEl.innerHTML = "<option value=\"\">Todos</option>" + (categories || []).map((c) => `<option value="${c.id}"${c.id === current ? " selected" : ""}>${escapeHtml(c.name)}</option>`).join("");
    }

    let data = await listProcedures(false);
    const catById = (categories || []).reduce((acc, c) => { acc[c.id] = c.name; return acc; }, {});

    const catFilter = (filterCatEl && filterCatEl.value) ? filterCatEl.value : "";
    const statusFilter = (document.getElementById("procFilterStatus") && document.getElementById("procFilterStatus").value) || "";
    const valorFilter = (document.getElementById("procFilterValor") && document.getElementById("procFilterValor").value) || "";
    const sortBy = (document.getElementById("procFilterSort") && document.getElementById("procFilterSort").value) || "name";

    if (catFilter) data = data.filter((p) => p.category_id === catFilter);
    if (statusFilter === "active") data = data.filter((p) => p.active);
    if (statusFilter === "inactive") data = data.filter((p) => !p.active);
    if (valorFilter === "with") data = data.filter((p) => p.valor_cobrado != null && p.valor_cobrado > 0);
    if (valorFilter === "without") data = data.filter((p) => p.valor_cobrado == null || p.valor_cobrado === 0);

    if (sortBy === "valor") data = [...data].sort((a, b) => (Number(a.valor_cobrado) || 0) - (Number(b.valor_cobrado) || 0));
    else if (sortBy === "duration") data = [...data].sort((a, b) => (a.duration_minutes || 0) - (b.duration_minutes || 0));
    else data = [...data].sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    if (!data || data.length === 0) {
      listEl.innerHTML = `
        <p class="procedimento-empty">Nenhum procedimento encontrado. Ajuste os filtros ou clique em "+ Novo procedimento".</p>
      `;
      return;
    }

    listEl.innerHTML = data
      .map((p) => {
        const catName = p.category_id ? (catById[p.category_id] || "") : "";
        const custoStr = p.custo_material_estimado != null ? `Custo material est.: R$ ${Number(p.custo_material_estimado).toFixed(2).replace(".", ",")}` : "";
        const margemStr = p.margem_minima_desejada != null ? `Margem: ${Number(p.margem_minima_desejada)}%` : "";
        const extra = [custoStr, margemStr].filter(Boolean).join(" · ");
        return `
      <div class="procedimento-card ${p.active ? "" : "procedimento-card--inactive"}" data-id="${p.id}">
        <div class="procedimento-card__body">
          <h3 class="procedimento-card__name">${p.codigo ? `<span class="procedimento-card__codigo">${escapeHtml(p.codigo)}</span> ` : ""}${escapeHtml(p.name)}</h3>
          ${catName ? `<p class="procedimento-card__category">${escapeHtml(catName)}</p>` : ""}
          ${p.description ? `<p class="procedimento-card__desc">${escapeHtml(p.description.slice(0, 80))}${p.description.length > 80 ? "…" : ""}</p>` : ""}
          <p class="procedimento-card__meta">${p.duration_minutes} min${p.valor_cobrado != null ? ` · R$ ${Number(p.valor_cobrado).toFixed(2).replace(".", ",")}` : ""}${extra ? ` · ${extra}` : ""}</p>
          <span class="procedimento-card__badge">${p.active ? "Ativo" : "Inativo"}</span>
        </div>
        <div class="procedimento-card__actions">
          <div class="procedimento-card__menu-wrap">
            <button type="button" class="procedimento-card__menu-btn" data-id="${p.id}" aria-label="Ações" title="Ações">⋮</button>
            <div class="procedimento-card__menu-dropdown" role="menu" aria-hidden="true">
              <button type="button" class="procedimento-card__menu-item btn-edit-procedimento" data-id="${p.id}" role="menuitem">Editar</button>
              <button type="button" class="procedimento-card__menu-item btn-toggle-procedimento" data-id="${p.id}" data-active="${p.active}" role="menuitem">${p.active ? "Desativar" : "Ativar"}</button>
              <button type="button" class="procedimento-card__menu-item btn-delete-procedimento" data-id="${p.id}" role="menuitem">Excluir</button>
            </div>
          </div>
        </div>
      </div>
    `;
      })
      .join("");

    bindCardActions();
  } catch (err) {
    console.error("[PROCEDIMENTO] erro render", err);
    listEl.innerHTML = `<p class="procedimento-error">Erro ao carregar procedimentos. Verifique se a tabela "procedures" existe (rode supabase-agenda-modelo.sql).</p>`;
    toast("Erro ao carregar procedimentos");
  }
}

function bindCardActions() {
  document.querySelectorAll(".procedimento-card__menu-btn").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const wrap = btn.closest(".procedimento-card__menu-wrap");
      const open = wrap && wrap.classList.contains("is-open");
      document.querySelectorAll(".procedimento-card__menu-wrap.is-open").forEach((w) => w.classList.remove("is-open"));
      if (!open && wrap) wrap.classList.add("is-open");
    };
  });
  const closeMenus = () => document.querySelectorAll(".procedimento-card__menu-wrap.is-open").forEach((w) => w.classList.remove("is-open"));
  document.addEventListener("click", closeMenus);
  document.querySelectorAll(".procedimento-card__menu-wrap").forEach((wrap) => {
    wrap.addEventListener("click", (e) => e.stopPropagation());
  });
  document.querySelectorAll(".btn-edit-procedimento").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      btn.closest(".procedimento-card__menu-wrap")?.classList.remove("is-open");
      openEditModal(btn.dataset.id);
    };
  });
  document.querySelectorAll(".btn-toggle-procedimento").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      btn.closest(".procedimento-card__menu-wrap")?.classList.remove("is-open");
      toggleActive(btn.dataset.id, btn.dataset.active === "true");
    };
  });
  document.querySelectorAll(".btn-delete-procedimento").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      btn.closest(".procedimento-card__menu-wrap")?.classList.remove("is-open");
      confirmDelete(btn.dataset.id);
    };
  });
}

/* =====================
   MODAIS
===================== */

function openNovaCategoriaModal() {
  openModal(
    "Nova categoria de procedimento",
    `
    <label>Nome da categoria</label>
    <input type="text" id="catName" placeholder="Ex: Limpeza, Preenchimento, Laser" required>
    `,
    submitNovaCategoria
  );
}

async function submitNovaCategoria() {
  const nameEl = document.getElementById("catName");
  if (!nameEl) return;
  const name = (nameEl.value || "").trim();
  if (!name) {
    toast("Informe o nome da categoria");
    return;
  }
  try {
    await createProcedureCategory(name);
    closeModal();
    renderProcedimentos();
    toast("Categoria criada!");
  } catch (err) {
    console.error("[PROCEDIMENTO] erro criar categoria", err);
    toast(err.message || "Erro ao criar categoria");
  }
}

async function openCreateModal() {
  let categories = [];
  try {
    categories = await listProcedureCategories();
  } catch (_) {}
  const catOptions = (categories || []).map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  openModal(
    "Novo procedimento",
    `
    <label>Código / sigla</label>
    <input type="text" id="procCodigo" placeholder="Ex: LP-01">
    <label>Nome do serviço</label>
    <input type="text" id="procName" placeholder="Ex: Limpeza de pele" required>
    <label>Categoria</label>
    <select id="procCategory"><option value="">Nenhuma</option>${catOptions}</select>
    <label>Descrição</label>
    <textarea id="procDesc" placeholder="Descrição do procedimento (opcional)" rows="2"></textarea>
    <label>Duração (minutos)</label>
    <input type="number" id="procDuration" min="5" step="5" value="60">
    <label>Tipo de procedimento (para agendamento: qual sala suporta)</label>
    <select id="procTipo"><option value="">Qualquer sala</option>${TIPOS_PROCEDIMENTO.map((t) => `<option value="${t.value}">${t.label}</option>`).join("")}</select>
    <label>Valor cobrado (R$)</label>
    <input type="number" id="procValor" step="0.01" min="0" placeholder="Valor usado em métricas e finanças">
    <label>Custo material estimado (R$)</label>
    <input type="number" id="procCusto" step="0.01" min="0" placeholder="Para precificação e comparativo">
    <label>Margem mínima desejada (%)</label>
    <input type="number" id="procMargem" min="0" max="100" step="0.5" placeholder="Base para sugestão de preço">
    <label>Comissão do profissional (%)</label>
    <input type="number" id="procComissao" min="0" max="100" step="0.5" placeholder="Vazio = usa o padrão da empresa">
    <label>Cláusula de consentimento (opcional)</label>
    <textarea id="procTermoEspecifico" rows="3" placeholder="Texto jurídico específico deste procedimento (riscos, cuidados). Será exibido no termo de consentimento quando aplicável. Consulte o advogado."></textarea>
    <p class="procedimento-modal-hint">Use para o termo se adaptar ao procedimento: o advogado pode redigir uma cláusula por tipo de serviço.</p>
      <div class="procedimento-pricing-block">
      <h4>🤖 Apoio à precificação (IA)</h4>
      <p class="procedimento-modal-hint" style="margin:0 0 8px;">A IA sugere um valor com base em custo, margem e duração. Você decide se aplica.</p>
      <button type="button" id="btnSugerirPreco" class="btn-secondary">Sugerir valor com IA</button>
      <div id="procPricingResult" class="procedimento-pricing-suggestion hidden" aria-live="polite"></div>
    </div>
    <div class="procedimento-pricing-taxas-block" id="procPrecificacaoComTaxasWrap">
      <h4>📐 Precificação com taxas (margem real)</h4>
      <p class="procedimento-modal-hint procedimento-aviso-taxas" style="margin:0 0 6px;">Com as <strong>taxas reais da maquininha</strong> em Configurações → Taxas da maquininha, a precificação fica mais assertiva: você vê a margem real deste procedimento por forma de pagamento e, ao montar o plano, já define como cobrar (parcelas, desconto à vista).</p>
      <div id="procPrecificacaoComTaxas" class="proc-precificacao-taxas-content" aria-live="polite"></div>
    </div>
    <p class="procedimento-modal-hint">O valor aqui entra em finanças (lucro, custo, pagamento) e depois em metas reais.</p>
    `,
    submitCreate
  );
  bindPricingSuggestion();
  bindPrecificacaoComTaxas();
}

async function openEditModal(id) {
  try {
    const [list, categories] = await Promise.all([listProcedures(false), listProcedureCategories().catch(() => [])]);
    const p = list.find((x) => x.id === id);
    if (!p) {
      toast("Procedimento não encontrado");
      return;
    }
    const catOptions = (categories || []).map((c) => `<option value="${c.id}"${p.category_id === c.id ? " selected" : ""}>${escapeHtml(c.name)}</option>`).join("");
    openModal(
      "Editar procedimento",
      `
      <label>Código / sigla</label>
      <input type="text" id="procCodigo" value="${escapeHtml(p.codigo || "")}" placeholder="Ex: LP-01">
      <label>Nome do serviço</label>
      <input type="text" id="procName" value="${escapeHtml(p.name)}" required>
      <label>Categoria</label>
      <select id="procCategory"><option value="">Nenhuma</option>${catOptions}</select>
      <label>Descrição</label>
      <textarea id="procDesc" placeholder="Descrição do procedimento (opcional)" rows="2">${escapeHtml(p.description || "")}</textarea>
      <label>Duração (minutos)</label>
      <input type="number" id="procDuration" min="5" step="5" value="${p.duration_minutes}">
      <label>Tipo de procedimento (para agendamento: qual sala suporta)</label>
      <select id="procTipo"><option value="">Qualquer sala</option>${TIPOS_PROCEDIMENTO.map((t) => `<option value="${t.value}"${p.tipo_procedimento === t.value ? " selected" : ""}>${t.label}</option>`).join("")}</select>
      <label>Valor cobrado (R$)</label>
      <input type="number" id="procValor" step="0.01" min="0" value="${p.valor_cobrado != null ? p.valor_cobrado : ""}" placeholder="Valor usado em métricas e finanças">
      <label>Custo material estimado (R$)</label>
      <input type="number" id="procCusto" step="0.01" min="0" value="${p.custo_material_estimado != null ? p.custo_material_estimado : ""}" placeholder="Para precificação">
      <label>Margem mínima desejada (%)</label>
      <input type="number" id="procMargem" min="0" max="100" step="0.5" value="${p.margem_minima_desejada != null ? p.margem_minima_desejada : ""}" placeholder="Base para sugestão de preço">
      <label>Comissão do profissional (%)</label>
      <input type="number" id="procComissao" min="0" max="100" step="0.5" value="${p.comissao_profissional_pct != null ? p.comissao_profissional_pct : ""}" placeholder="Vazio = usa o padrão da empresa">
      <span class="procedimento-modal-hint">Sobre o valor cobrado. Custo total = material + este %. No Financeiro você vê quais procedimentos ficam abaixo da margem alvo.</span>
      <label>Cláusula de consentimento (opcional)</label>
      <textarea id="procTermoEspecifico" rows="3" placeholder="Texto jurídico específico deste procedimento (riscos, cuidados). Será exibido no termo de consentimento quando aplicável.">${escapeHtml(p.termo_especifico || "")}</textarea>
      <p class="procedimento-modal-hint">Use para o termo se adaptar ao procedimento: o advogado pode redigir uma cláusula por tipo de serviço.</p>
      <div class="procedimento-pricing-block">
        <h4>🤖 Apoio à precificação (IA)</h4>
        <p class="procedimento-modal-hint" style="margin:0 0 8px;">A IA sugere um valor com base em custo, margem e duração. Você decide se aplica.</p>
        <button type="button" id="btnSugerirPreco" class="btn-secondary">Sugerir valor com IA</button>
        <div id="procPricingResult" class="procedimento-pricing-suggestion hidden" aria-live="polite"></div>
      </div>
      <div class="procedimento-pricing-taxas-block" id="procPrecificacaoComTaxasWrap">
        <h4>📐 Precificação com taxas (margem real)</h4>
        <p class="procedimento-modal-hint procedimento-aviso-taxas" style="margin:0 0 6px;">Com as <strong>taxas reais da maquininha</strong> em Configurações → Taxas da maquininha, a precificação fica mais assertiva: você vê a margem real deste procedimento por forma de pagamento e, ao montar o plano, já define como cobrar (parcelas, desconto à vista).</p>
        <div id="procPrecificacaoComTaxas" class="proc-precificacao-taxas-content" aria-live="polite"></div>
      </div>
      <div id="procCustoRealBlock" class="procedimento-custo-real-block" aria-live="polite"></div>
      <input type="hidden" id="procId" value="${p.id}">
      <p class="procedimento-modal-hint">O procedimento entra em finanças: lucro real, custo operacional, pagamento funcionário; depois ajuda em metas plausíveis.</p>
      `,
      () => submitEdit(id)
    );
    bindPricingSuggestion();
    bindPrecificacaoComTaxas();
    const block = document.getElementById("procCustoRealBlock");
    if (block) {
      try {
        const { custoReal, itens } = await getCustoRealProcedimento(id);
        if (itens.length === 0) {
          block.innerHTML = `<h4>📦 Materiais usados e custo real</h4><p class="procedimento-custo-real-empty">Nenhum material vinculado a este procedimento (tabela <code>procedure_stock_usage</code>). Quando houver, o custo real será calculado com base no custo médio do estoque.</p>`;
        } else {
          block.innerHTML = `
            <h4>📦 Materiais usados e custo real (calculado)</h4>
            <p class="procedimento-modal-hint">Custo real = soma (quantidade × custo médio do estoque por produto). Compare com o custo estimado acima.</p>
            <ul class="proc-custo-real-list">${itens.map((i) => `<li><strong>${escapeHtml(i.item_ref)}</strong>: ${i.quantity_used} × ${i.custo_unitario != null ? "R$ " + i.custo_unitario.toFixed(2).replace(".", ",") : "—"} = R$ ${i.subtotal.toFixed(2).replace(".", ",")}</li>`).join("")}</ul>
            <p class="proc-custo-real-total"><strong>Custo real total: R$ ${custoReal.toFixed(2).replace(".", ",")}</strong></p>
          `;
        }
      } catch (e) {
        block.innerHTML = `<h4>📦 Materiais usados e custo real</h4><p class="procedimento-custo-real-empty">Erro ao carregar custo real.</p>`;
      }
    }
  } catch (err) {
    console.error("[PROCEDIMENTO] erro openEdit", err);
    toast("Erro ao abrir edição");
  }
}

async function submitCreate() {
  const nameEl = document.getElementById("procName");
  const durationEl = document.getElementById("procDuration");
  const descEl = document.getElementById("procDesc");
  const valorEl = document.getElementById("procValor");
  const codigoEl = document.getElementById("procCodigo");
  const categoryEl = document.getElementById("procCategory");
  const custoEl = document.getElementById("procCusto");
  const margemEl = document.getElementById("procMargem");
  const comissaoEl = document.getElementById("procComissao");
  if (!nameEl || !durationEl) return;
  const name = (nameEl.value || "").trim();
  if (!name) {
    toast("Informe o nome do serviço");
    return;
  }
  const description = descEl ? (descEl.value || "").trim() || null : null;
  const valorCobrado = valorEl && valorEl.value !== "" ? valorEl.value : undefined;
  const codigo = codigoEl ? (codigoEl.value || "").trim() || null : null;
  const categoryId = categoryEl && categoryEl.value ? categoryEl.value : null;
  const custoMaterialEstimado = custoEl && custoEl.value !== "" ? custoEl.value : undefined;
  const margemMinimaDesejada = margemEl && margemEl.value !== "" ? margemEl.value : undefined;
  const comissaoProfissionalPct = comissaoEl && comissaoEl.value !== "" ? comissaoEl.value : undefined;
  const tipoEl = document.getElementById("procTipo");
  const tipoProcedimento = tipoEl ? (tipoEl.value || null) : null;
  const termoEl = document.getElementById("procTermoEspecifico");
  const termoEspecifico = termoEl ? (termoEl.value || "").trim() || null : null;
  try {
    await createProcedure({ name, description, durationMinutes: Number(durationEl.value) || 60, valorCobrado, codigo, categoryId, custoMaterialEstimado, margemMinimaDesejada, comissaoProfissionalPct, tipoProcedimento, termoEspecifico });
    closeModal();
    renderProcedimentos();
    toast("Procedimento criado!");
  } catch (err) {
    console.error("[PROCEDIMENTO] erro create", err);
    toast(err.message || "Erro ao criar procedimento");
  }
}

async function submitEdit(id) {
  const nameEl = document.getElementById("procName");
  const durationEl = document.getElementById("procDuration");
  const descEl = document.getElementById("procDesc");
  const valorEl = document.getElementById("procValor");
  const codigoEl = document.getElementById("procCodigo");
  const categoryEl = document.getElementById("procCategory");
  const custoEl = document.getElementById("procCusto");
  const margemEl = document.getElementById("procMargem");
  const comissaoEl = document.getElementById("procComissao");
  if (!nameEl || !durationEl) return;
  const name = (nameEl.value || "").trim();
  if (!name) {
    toast("Informe o nome do serviço");
    return;
  }
  const description = descEl ? (descEl.value || "").trim() || null : null;
  const valorCobrado = valorEl ? (valorEl.value === "" ? null : valorEl.value) : undefined;
  const codigo = codigoEl ? (codigoEl.value || "").trim() || null : null;
  const categoryId = categoryEl ? (categoryEl.value || null) : null;
  const custoMaterialEstimado = custoEl ? (custoEl.value === "" ? null : custoEl.value) : undefined;
  const margemMinimaDesejada = margemEl ? (margemEl.value === "" ? null : margemEl.value) : undefined;
  const comissaoProfissionalPct = comissaoEl ? (comissaoEl.value === "" ? null : comissaoEl.value) : undefined;
  const tipoEl = document.getElementById("procTipo");
  const tipoProcedimento = tipoEl ? (tipoEl.value || null) : null;
  const termoEl = document.getElementById("procTermoEspecifico");
  const termoEspecifico = termoEl ? (termoEl.value || "").trim() || null : null;
  try {
    await updateProcedure(id, {
      name,
      description,
      durationMinutes: Number(durationEl.value) || 60,
      valorCobrado,
      codigo,
      categoryId,
      custoMaterialEstimado,
      tipoProcedimento,
      margemMinimaDesejada,
      comissaoProfissionalPct,
      termoEspecifico,
    });
    closeModal();
    renderProcedimentos();
    toast("Procedimento atualizado!");
  } catch (err) {
    console.error("[PROCEDIMENTO] erro update", err);
    toast(err.message || "Erro ao atualizar");
  }
}

async function toggleActive(id, currentlyActive) {
  try {
    await updateProcedure(id, { active: !currentlyActive });
    renderProcedimentos();
    toast(currentlyActive ? "Procedimento desativado" : "Procedimento ativado");
  } catch (err) {
    console.error("[PROCEDIMENTO] erro toggle", err);
    toast(err.message || "Erro ao alterar status");
  }
}

async function confirmDelete(id) {
  openConfirmModal("Excluir procedimento?", "Quem já usou em agendamentos não será afetado.", async () => {
  try {
    await deleteProcedure(id);
    renderProcedimentos();
    toast("Procedimento excluído");
  } catch (err) {
    console.error("[PROCEDIMENTO] erro delete", err);
    toast(err.message || "Erro ao excluir");
  }
  });
}

/* =====================
   PLANOS TERAPÊUTICOS (dentro de Procedimentos)
===================== */

export async function renderPlanosTerapeuticos() {
  const listEl = document.getElementById("listaPlanosTerapeuticos");
  if (!listEl) return;
  try {
    const [planos, procedures] = await Promise.all([
      listPlanosTerapeuticos().catch(() => []),
      listProcedures(false).catch(() => []),
    ]);
    const procById = (procedures || []).reduce((acc, p) => { acc[p.id] = p; return acc }, {});

    if (!planos || planos.length === 0) {
      listEl.innerHTML = `
        <p class="planos-terapeuticos-empty">Nenhum plano ainda. Crie um plano para combinar procedimentos e atender a uma dor do cliente.</p>
      `;
      return;
    }

    listEl.innerHTML = (planos || []).map((plano) => {
      const procNames = (plano.procedimentos || [])
        .map((pp) => procById[pp.procedure_id] ? procById[pp.procedure_id].name : "—")
        .filter(Boolean)
        .join(" → ");
      let valorTotal = 0;
      (plano.procedimentos || []).forEach((pp) => {
        const proc = procById[pp.procedure_id];
        if (proc && proc.valor_cobrado != null && Number(proc.valor_cobrado) > 0) {
          const qtd = Math.max(1, Number(pp.quantidade) || 1);
          valorTotal += Number(proc.valor_cobrado) * qtd;
        }
      });
      const valorFormatado = valorTotal > 0 ? Number(valorTotal).toFixed(2).replace(".", ",") : "";
      const blocoFinanceiro = valorTotal > 0
        ? `<p class="plano-terapeutico-card__valor">Valor sugerido do plano: R$ ${valorFormatado}</p>
           <button type="button" class="btn-secondary btn-sm btn-simular-plano" data-valor="${valorTotal}" title="Ver quanto você recebe e qual desconto à vista oferecer">Simular recebimento</button>`
        : "";
      return `
        <div class="plano-terapeutico-card" data-id="${plano.id}">
          <div class="plano-terapeutico-card__body">
            <h4 class="plano-terapeutico-card__nome">${escapeHtml(plano.nome)}</h4>
            ${plano.dor_cliente ? `<p class="plano-terapeutico-card__dor">Dor: ${escapeHtml(plano.dor_cliente.slice(0, 120))}${plano.dor_cliente.length > 120 ? "…" : ""}</p>` : ""}
            ${procNames ? `<p class="plano-terapeutico-card__procs">${escapeHtml(procNames)}</p>` : ""}
            ${blocoFinanceiro}
          </div>
          <div class="plano-terapeutico-card__actions">
            <button type="button" class="btn-secondary btn-edit-plano" data-id="${plano.id}" title="Editar">Editar</button>
            <button type="button" class="btn-secondary btn-delete-plano" data-id="${plano.id}" title="Excluir">Excluir</button>
          </div>
        </div>
      `;
    }).join("");

    listEl.querySelectorAll(".btn-edit-plano").forEach((btn) => {
      btn.onclick = (e) => { e.stopPropagation(); openEditPlanoModal(btn.dataset.id); };
    });
    listEl.querySelectorAll(".btn-delete-plano").forEach((btn) => {
      btn.onclick = (e) => { e.stopPropagation(); confirmDeletePlano(btn.dataset.id); };
    });
    listEl.querySelectorAll(".btn-simular-plano").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const valor = btn.dataset.valor;
        if (valor != null && valor !== "") {
          try {
            sessionStorage.setItem("precificacaoValorSimulador", String(valor));
            navigate("precificacao-taxas");
          } catch (err) {
            toast("Erro ao abrir simulador");
          }
        }
      };
    });
  } catch (err) {
    console.error("[PLANOS TERAPÊUTICOS] erro render", err);
    listEl.innerHTML = `<p class="planos-terapeuticos-error">Erro ao carregar planos. Verifique se as tabelas planos_terapeuticos existem (rode supabase-planos-terapeuticos.sql).</p>`;
  }
}

function openCreatePlanoModal() {
  listProcedures(false).then((procedures) => {
    const procOptions = (procedures || []).map((p) => `
      <label class="plano-modal-proc"><input type="checkbox" name="planoProc" value="${p.id}"> ${escapeHtml(p.name)}</label>
    `).join("");
    openModal(
      "Criar plano terapêutico",
      `
      <label>Nome do plano</label>
      <input type="text" id="planoNome" placeholder="Ex: Melhora da oleosidade e poros" required>
      <label>Dor do cliente (qual dor esse plano trata?)</label>
      <textarea id="planoDor" placeholder="Ex: Pele oleosa, poros dilatados, brilho excessivo" rows="2"></textarea>
      <label>Explicação terapêutica (por que esses procedimentos juntos?)</label>
      <textarea id="planoExp" placeholder="Lógica do caminho para o cliente" rows="2"></textarea>
      <label>Procedimentos (ordem = ordem da lista)</label>
      <div class="plano-modal-procs">${procOptions || "<p>Cadastre procedimentos antes.</p>"}</div>
      `,
      submitCreatePlano
    );
  }).catch(() => {
    openModal("Criar plano", "<p>Carregue os procedimentos antes.</p>", () => closeModal());
  });
}

async function openEditPlanoModal(id) {
  try {
    const [planos, procedures] = await Promise.all([listPlanosTerapeuticos(), listProcedures(false)]);
    const plano = (planos || []).find((p) => p.id === id);
    if (!plano) { toast("Plano não encontrado"); return; }
    const selectedIds = new Set((plano.procedimentos || []).map((pp) => pp.procedure_id));
    const procOptions = (procedures || []).map((p) => `
      <label class="plano-modal-proc"><input type="checkbox" name="planoProc" value="${p.id}" ${selectedIds.has(p.id) ? "checked" : ""}> ${escapeHtml(p.name)}</label>
    `).join("");
    openModal(
      "Editar plano terapêutico",
      `
      <label>Nome do plano</label>
      <input type="text" id="planoNome" value="${escapeHtml(plano.nome)}" required>
      <label>Dor do cliente</label>
      <textarea id="planoDor" rows="2">${escapeHtml(plano.dor_cliente || "")}</textarea>
      <label>Explicação terapêutica</label>
      <textarea id="planoExp" rows="2">${escapeHtml(plano.explicacao_terapeutica || "")}</textarea>
      <label>Procedimentos</label>
      <div class="plano-modal-procs">${procOptions || ""}</div>
      <input type="hidden" id="planoId" value="${plano.id}">
      `,
      () => submitEditPlano(id)
    );
  } catch (err) {
    console.error("[PLANOS TERAPÊUTICOS] erro openEdit", err);
    toast("Erro ao abrir edição");
  }
}

async function submitCreatePlano() {
  const nomeEl = document.getElementById("planoNome");
  const dorEl = document.getElementById("planoDor");
  const expEl = document.getElementById("planoExp");
  if (!nomeEl || !nomeEl.value.trim()) { toast("Informe o nome do plano"); return; }
  const procedureIds = Array.from(document.querySelectorAll("input[name=planoProc]:checked")).map((c) => c.value).filter(Boolean);
  try {
    await createPlanoTerapeutico({
      nome: nomeEl.value.trim(),
      dorCliente: dorEl ? dorEl.value.trim() || null : null,
      explicacaoTerapeutica: expEl ? expEl.value.trim() || null : null,
      procedureIds,
    });
    closeModal();
    renderPlanosTerapeuticos();
    toast("Plano criado!");
  } catch (err) {
    console.error("[PLANOS TERAPÊUTICOS] erro create", err);
    toast(err.message || "Erro ao criar plano");
  }
}

async function submitEditPlano(id) {
  const nomeEl = document.getElementById("planoNome");
  const dorEl = document.getElementById("planoDor");
  const expEl = document.getElementById("planoExp");
  if (!nomeEl || !nomeEl.value.trim()) { toast("Informe o nome do plano"); return; }
  const procedureIds = Array.from(document.querySelectorAll("input[name=planoProc]:checked")).map((c) => c.value).filter(Boolean);
  try {
    await updatePlanoTerapeutico(id, {
      nome: nomeEl.value.trim(),
      dorCliente: dorEl ? dorEl.value.trim() || null : null,
      explicacaoTerapeutica: expEl ? expEl.value.trim() || null : null,
      procedureIds,
    });
    closeModal();
    renderPlanosTerapeuticos();
    toast("Plano atualizado!");
  } catch (err) {
    console.error("[PLANOS TERAPÊUTICOS] erro update", err);
    toast(err.message || "Erro ao atualizar");
  }
}

function confirmDeletePlano(id) {
  openConfirmModal("Excluir plano?", "A decisão de usar em atendimentos continua com você.", async () => {
    try {
      await deletePlanoTerapeutico(id);
      renderPlanosTerapeuticos();
      toast("Plano excluído");
    } catch (err) {
      console.error("[PLANOS TERAPÊUTICOS] erro delete", err);
      toast(err.message || "Erro ao excluir");
    }
  });
}

/* =====================
   DISCUSSÃO DE CASO — opinião da IA + referências para preparar o profissional
===================== */

async function pedirOpiniao() {
  const inputEl = document.getElementById("discussaoCasoInput");
  const resultEl = document.getElementById("discussaoCasoResult");
  const btnEl = document.getElementById("btnPedirOpiniao");
  if (!inputEl || !resultEl) return;
  const texto = (inputEl.value || "").trim();
  if (!texto) {
    toast("Descreva o caso para pedir opinião da IA.");
    return;
  }
  resultEl.hidden = false;
  resultEl.innerHTML = "<p class=\"procedimento-discussao__loading\">Consultando a IA…</p>";
  if (btnEl) btnEl.disabled = true;
  try {
    const content = await pedirOpiniaoCaso(texto);
    resultEl.innerHTML = `<div class="procedimento-discussao__markdown">${simpleMarkdownToHtml(content)}</div>`;
  } catch (err) {
    console.error("[DISCUSSÃO CASO]", err);
    resultEl.innerHTML = `<p class="procedimento-discussao__error">${escapeHtml(err.message || "Erro ao pedir opinião da IA.")}</p>`;
  }
  if (btnEl) btnEl.disabled = false;
}

function simpleMarkdownToHtml(md) {
  if (!md) return "";
  // Extrair links [texto](url) e trocar por placeholders; depois escapar o resto e reinserir links seguros
  const links = [];
  let s = md.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (_, text, url) => {
    const rawUrl = (url || "").trim();
    const isSafe = /^https?:\/\//i.test(rawUrl);
    const idx = links.length;
    links.push({ text: text || "", url: rawUrl, isSafe });
    return "\x00L" + idx + "\x00";
  });
  s = escapeHtml(s)
    .replace(/\x00L(\d+)\x00/g, (_, i) => {
      const L = links[Number(i)];
      if (!L || !L.isSafe) return escapeHtml("[" + (L ? L.text : "") + "](" + (L ? L.url : "") + ")");
      return `<a href="${escapeHtml(L.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(L.text)}</a>`;
    })
    .replace(/^## (.+)$/gm, "<h3>$1</h3>")
    .replace(/^### (.+)$/gm, "<h4>$1</h4>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");
  if (!s.startsWith("<")) s = "<p>" + s;
  if (!s.endsWith(">")) s = s + "</p>";
  return s;
}

function escapeHtml(str) {
  if (str == null) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Apoio à precificação: IA sugere valor; humano aplica se quiser.
 */
function bindPricingSuggestion() {
  const btn = document.getElementById("btnSugerirPreco");
  const resultEl = document.getElementById("procPricingResult");
  if (!btn || !resultEl) return;

  btn.onclick = async () => {
    const nameEl = document.getElementById("procName");
    const durationEl = document.getElementById("procDuration");
    const custoEl = document.getElementById("procCusto");
    const margemEl = document.getElementById("procMargem");
    const valorEl = document.getElementById("procValor");

    const nome = (nameEl && nameEl.value || "").trim() || "Procedimento";
    const duracao = durationEl ? Number(durationEl.value) || 60 : 60;
    const custoMaterial = custoEl && custoEl.value !== "" ? Number(custoEl.value) : null;
    const margemMin = margemEl && margemEl.value !== "" ? Number(margemEl.value) : null;

    resultEl.classList.remove("hidden");
    resultEl.innerHTML = "<p>Consultando IA…</p>";

    let precoIdeal = null;
    let justificativa = "";

    try {
      const custos = { duracao_minutos: duracao };
      if (custoMaterial != null) custos.custo_material_estimado = custoMaterial;
      const protocolo = { nome, margem_minima_desejada: margemMin };
      const res = await gerarPreco({ custos, protocolo, mercado: {} });

      const raw = (res && res.content) ? res.content : (typeof res === "string" ? res : "");
      const jsonStr = raw.replace(/```json?\s*/g, "").replace(/```\s*$/g, "").trim();
      let data = {};
      try {
        data = JSON.parse(jsonStr);
      } catch (_) {
        data = typeof res === "object" && res.preco_ideal != null ? res : {};
      }
      precoIdeal = data.preco_ideal ?? data.preco_ideal;
      if (precoIdeal == null) precoIdeal = data.preco_min;
      justificativa = data.justificativa || "";
    } catch (e) {
      console.warn("[PROCEDIMENTO] IA precificação falhou, usando fórmula", e);
    }

    if (precoIdeal == null && custoMaterial != null && margemMin != null && margemMin < 100) {
      precoIdeal = custoMaterial / (1 - margemMin / 100);
      justificativa = "Sugestão por fórmula: custo ÷ (1 − margem%). Você pode ajustar.";
    }

    if (precoIdeal != null) {
      const valorStr = Number(precoIdeal).toFixed(2).replace(".", ",");
      resultEl.innerHTML = `
        <p><span class="valor-sugerido">Valor sugerido: R$ ${valorStr}</span></p>
        ${justificativa ? `<p>${escapeHtml(justificativa)}</p>` : ""}
        <button type="button" class="btn-secondary" id="btnAplicarPreco">Aplicar ao valor cobrado</button>
      `;
      const aplicarBtn = document.getElementById("btnAplicarPreco");
      if (aplicarBtn && valorEl) {
        aplicarBtn.onclick = () => {
          valorEl.value = Number(precoIdeal).toFixed(2);
          toast("Valor aplicado. Ajuste se quiser e salve.");
        };
      }
    } else {
      resultEl.innerHTML = "<p>Preencha custo material e margem mínima (ou nome) e tente de novo. A IA usa esses dados para sugerir o valor.</p>";
    }
  };
}

/**
 * Precificação cruzada com taxas: valor mínimo para margem e margem real por forma de pagamento.
 */
function bindPrecificacaoComTaxas() {
  const container = document.getElementById("procPrecificacaoComTaxas");
  const valorEl = document.getElementById("procValor");
  const custoEl = document.getElementById("procCusto");
  const margemEl = document.getElementById("procMargem");
  if (!container) return;

  function fmt(v) {
    if (v == null || Number.isNaN(v)) return "—";
    return Number(v).toFixed(2).replace(".", ",");
  }

  function atualizar() {
    const valor = valorEl && valorEl.value !== "" ? Number(valorEl.value) : null;
    const custo = custoEl && custoEl.value !== "" ? Number(custoEl.value) : null;
    const margem = margemEl && margemEl.value !== "" ? Number(margemEl.value) : null;

    getTaxasOrganizacao()
      .then((taxas) => {
        const temParceladoN = Array.from({ length: 11 }, (_, i) => taxas[`taxa_parcelado_${i + 2}_pct`] != null).some(Boolean);
        const taxasConfiguradas = taxas.taxa_avista_pct != null || taxas.taxa_avista_debito_pct != null || taxas.taxa_avista_credito_pct != null || taxas.taxa_parcelado_2_6_pct != null || taxas.taxa_parcelado_7_12_pct != null || temParceladoN;
        const wrap = document.getElementById("procPrecificacaoComTaxasWrap");
        const aviso = wrap?.querySelector(".procedimento-aviso-taxas");
        if (aviso) aviso.hidden = !!taxasConfiguradas;

        const taxaAvista = getTaxaParaParcelas(taxas, 1);
        const taxa6 = getTaxaParaParcelas(taxas, 6);
        const taxa12 = getTaxaParaParcelas(taxas, 12);

        const partes = [];

        if (custo != null && custo > 0 && margem != null && margem >= 0 && margem < 100) {
          const minAvista = valorBrutoMinimoParaMargem(custo, margem, taxaAvista);
          const min6 = valorBrutoMinimoParaMargem(custo, margem, taxa6);
          const min12 = valorBrutoMinimoParaMargem(custo, margem, taxa12);
          partes.push(
            `<p><strong>Para manter margem ${fmt(margem)}%</strong> sobre o que você recebe: valor mínimo <strong>à vista R$ ${fmt(minAvista)}</strong>, <strong>6x R$ ${fmt(min6)}</strong>, <strong>12x R$ ${fmt(min12)}</strong>.</p>`
          );
        }

        if (valor != null && valor > 0 && custo != null) {
          const liqAvista = calcularLiquido(valor, taxaAvista);
          const liq6 = calcularLiquido(valor, taxa6);
          const liq12 = calcularLiquido(valor, taxa12);
          const margemA = margemReal(liqAvista, custo);
          const margem6 = margemReal(liq6, custo);
          const margem12 = margemReal(liq12, custo);
          partes.push(
            `<p><strong>Se cobrar R$ ${fmt(valor)}:</strong> à vista você recebe R$ ${fmt(liqAvista)} (margem ${margemA != null ? fmt(margemA) + "%" : "—"}); 6x recebe R$ ${fmt(liq6)} (margem ${margem6 != null ? fmt(margem6) + "%" : "—"}); 12x recebe R$ ${fmt(liq12)} (margem ${margem12 != null ? fmt(margem12) + "%" : "—"}).</p>`
          );
        }

        if (partes.length > 0) {
          container.innerHTML = partes.join("");
        } else {
          container.innerHTML = "<p class=\"procedimento-modal-hint\">Preencha <strong>custo e margem mínima</strong> (para ver valor mínimo por forma de pagamento) ou <strong>valor e custo</strong> (para ver margem real). Configure as taxas em <strong>Precificação e taxas</strong>.</p>";
        }
      })
      .catch(() => {
        const wrap = document.getElementById("procPrecificacaoComTaxasWrap");
        const aviso = wrap?.querySelector(".procedimento-aviso-taxas");
        if (aviso) aviso.hidden = false;
        container.innerHTML = "<p class=\"procedimento-modal-hint\">Configure as taxas em <strong>Configurações → Taxas da maquininha</strong> para ver valor mínimo e margem após taxa.</p>";
      });
  }

  [valorEl, custoEl, margemEl].filter(Boolean).forEach((el) => {
    el.addEventListener("input", atualizar);
    el.addEventListener("change", atualizar);
  });
  atualizar();
}
