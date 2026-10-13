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
  getProcedureStockUsage,
  listAllProcedureStockUsage,
  replaceProcedureStockUsage,
  isUsageVaga,
  usageDisplayName,
  USAGE_VAGA_PREFIX,
} from "../services/procedimentos.service.js";
import { listProdutosCatalogo } from "../services/estoque-produtos.service.js";
import { getCustoRealProcedimento, getResumoPorProduto } from "../services/estoque-entradas.service.js";
import {
  custoRealFromUsage,
  joinUsageRef,
  labelUnidadeQtd,
  normalizarUnidade,
  qtyFromUsaRende,
  rendimentoFromQty,
  splitUsageRef,
  UNIDADES_RECEITA,
} from "../utils/estoque-custo.js";
import {
  listPlanosTerapeuticos,
  createPlanoTerapeutico,
  updatePlanoTerapeutico,
  deletePlanoTerapeutico,
} from "../services/planos-terapeuticos.service.js";
import { pedirOpiniaoCaso } from "../services/discussao-caso.service.js";
import { gerarPreco } from "../services/preco.service.js";
import { listMarketRadar } from "../services/market-radar.service.js";
import { casarRadarRef } from "../utils/market-radar.js";
import { leituraNaoPerder } from "../utils/preco-nao-perder.js";
import { TIPOS_PROCEDIMENTO } from "../constants/tipos-procedimento.js";
import { importarLote, getTemplateHeaders } from "../services/importacao-lote.service.js";
import { getMargemEmRisco } from "../services/audit.service.js";
import { htmlCardMargemRisco } from "../utils/margem-risco.js";
import { rankLucroHora, summarizeLucroHora } from "../utils/lucro-hora.js";
import { explainProcedureEconomics, brl } from "../services/procedimento-pl.service.js";
import {
  contaDiaEquipamento,
  parseAluguelCadastro,
  stripAluguelMarker,
  textoContaDia,
  withAluguelMarker,
} from "../utils/aluguel-dia.js";
import { navigate } from "../core/spa.js";
import { checkPermission } from "../core/permissions.js";
import { getOrgMembers } from "../core/org.js";
import { getProcedimentosRealizadosPorPeriodo } from "../services/metrics.service.js";
import {
  getTaxasOrganizacao,
  getTaxaParaParcelas,
  calcularLiquido,
  valorBrutoMinimoParaMargem,
  margemReal,
} from "../services/precificacao-taxas.service.js";

const PAPEL_RECEITA = [
  { id: "mascara", label: "Máscara" },
  { id: "emoliente", label: "Emoliente" },
  { id: "descartavel", label: "Descartável" },
  { id: "limpeza", label: "Limpeza / higiene" },
  { id: "outro", label: "Outro" },
];

let custosReceitaMap = {};
let unidadesReceitaMap = {};

function unidadeOptionsHtml(selected) {
  const cur = normalizarUnidade(selected);
  return UNIDADES_RECEITA.map(
    (u) => `<option value="${u.id}"${u.id === cur ? " selected" : ""}>${u.label}</option>`
  ).join("");
}

async function nomesEstoqueReceita() {
  const names = new Set();
  try {
    const cat = await listProdutosCatalogo();
    for (const p of cat || []) {
      const n = String(p.nome || "").trim();
      if (n) names.add(n);
    }
  } catch (_) {}
  try {
    const resumo = await getResumoPorProduto();
    for (const r of resumo || []) {
      const n = String(r.produto_nome || "").trim();
      if (n) names.add(n);
    }
  } catch (_) {}
  return [...names].sort((a, b) => a.localeCompare(b, "pt"));
}

async function custosEstoqueReceita() {
  const map = {};
  try {
    const resumo = await getResumoPorProduto();
    for (const r of resumo || []) {
      const n = String(r.produto_nome || "").trim().toLowerCase();
      if (n && r.custo_medio != null && Number.isFinite(Number(r.custo_medio))) {
        map[n] = Number(r.custo_medio);
      }
    }
  } catch (_) {}
  try {
    const cat = await listProdutosCatalogo();
    for (const p of cat || []) {
      const n = String(p.nome || "").trim().toLowerCase();
      const c = Number(p.custo_pago);
      if (n && Number.isFinite(c) && map[n] == null) map[n] = c;
    }
  } catch (_) {}
  return map;
}

async function unidadesEstoqueReceita() {
  const map = {};
  try {
    const cat = await listProdutosCatalogo();
    for (const p of cat || []) {
      const n = String(p.nome || "").trim().toLowerCase();
      if (n && p.unidade) map[n] = normalizarUnidade(p.unidade);
    }
  } catch (_) {}
  return map;
}

function brlReceita(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return "R$ " + Number(n).toFixed(2).replace(".", ",");
}

function usageEditorHtml(existing = [], nomes = []) {
  const opts = PAPEL_RECEITA.map((p) => `<option value="${p.id}">${p.label}</option>`).join("");
  const chips = PAPEL_RECEITA.map(
    (p) => `<button type="button" class="btn-secondary proc-usage-chip" data-papel="${p.id}">+ ${p.label}</button>`
  ).join(" ");
  const list = nomes
    .map((n) => `<option value="${escapeHtml(n)}"></option>`)
    .join("");
  const materiais = (existing || []).filter((u) => !/^aluguel:/i.test(String(u.item_ref || "")));
  const rows = (materiais.length ? materiais : [{ item_ref: "", quantity_used: 1 }])
    .map((u) => usageRowHtml(u, opts))
    .join("");
  return `
    <div id="procUsageWrap" class="proc-usage-wrap">
      <h4>Receita deste procedimento</h4>
      <p class="procedimento-modal-hint">Os números são desta ficha, não da clínica inteira: cada procedimento (e cada clínica) preenche o que usa. Exemplo só para a conta: 3 pares numa caixa de 50 a R$ 40 → R$ 2,40 nesta sessão. Vaga (sem produto: o profissional escolhe a marca no dia) fica sem custo. Não baixa estoque daqui; não muda o preço.</p>
      <div class="proc-usage-chips">${chips}</div>
      <datalist id="procUsageProdutosList">${list}</datalist>
      <div id="procUsageRows">${rows}</div>
      <button type="button" class="btn-secondary" id="btnProcUsageAdd">+ Linha</button>
    </div>
  `;
}

function usageRowHtml(u = {}, papelOpts) {
  const parsed = splitUsageRef(u.item_ref);
  const ref = parsed.nome;
  const vaga = isUsageVaga(ref);
  const papel = vaga ? ref.slice(USAGE_VAGA_PREFIX.length).trim().toLowerCase() : "";
  const produto = vaga ? "" : ref;
  const qty = u.quantity_used != null && u.quantity_used !== "" ? u.quantity_used : 1;
  const unidade = u.unidade ? normalizarUnidade(u.unidade) : parsed.unidade;
  const usa = u.usa != null ? u.usa : parsed.usa != null ? parsed.usa : !vaga && produto ? 1 : "";
  const rend =
    u.rende != null
      ? u.rende
      : parsed.rende != null
        ? parsed.rende
        : !vaga && produto
          ? rendimentoFromQty(qty)
          : "";
  const opts = PAPEL_RECEITA.map(
    (p) => `<option value="${p.id}"${p.id === papel ? " selected" : ""}>${p.label}</option>`
  ).join("");
  return `<div class="proc-usage-row">
    <label>Papel<select class="proc-usage-papel"><option value="">—</option>${opts || papelOpts}</select></label>
    <label>Produto (opcional na vaga)<input type="text" class="proc-usage-produto" list="procUsageProdutosList" value="${escapeHtml(produto)}" placeholder="Vazio = escolhe no dia"></label>
    <label>Usa nesta ficha<input type="number" class="proc-usage-usa" min="0.01" step="any" value="${usa}" placeholder="Quanto usa aqui"></label>
    <label>Unidade<select class="proc-usage-unidade">${unidadeOptionsHtml(unidade)}</select></label>
    <label>Cabe na embalagem<input type="number" class="proc-usage-rendimento" min="1" step="any" value="${rend ?? ""}" placeholder="Quanto vem no produto"></label>
    <input type="hidden" class="proc-usage-qty" value="${qty}">
    <p class="proc-usage-custo" aria-live="polite"></p>
    <button type="button" class="btn-secondary proc-usage-remove" aria-label="Remover linha">×</button>
  </div>`;
}

function refreshUsageRowCusto(row) {
  if (!row) return;
  const el = row.querySelector(".proc-usage-custo");
  if (!el) return;
  const produto = (row.querySelector(".proc-usage-produto")?.value || "").trim();
  const usa = Number(row.querySelector(".proc-usage-usa")?.value);
  const rend = Number(row.querySelector(".proc-usage-rendimento")?.value);
  const unidade = row.querySelector(".proc-usage-unidade")?.value;
  const frac = qtyFromUsaRende(usa, rend);
  if (row.querySelector(".proc-usage-qty") && frac != null) {
    row.querySelector(".proc-usage-qty").value = String(frac);
  }
  if (!produto) {
    el.textContent = "Vaga: sem custo até escolher o produto.";
    return;
  }
  const q = frac != null ? frac : Number(row.querySelector(".proc-usage-qty")?.value);
  const out = custoRealFromUsage(
    [{ item_ref: joinUsageRef(produto, unidade, usa, rend), quantity_used: q || 0 }],
    custosReceitaMap
  );
  const item = out.itens[0];
  if (!item || item.custo_unitario == null) {
    el.textContent = "Produto sem custo médio no estoque — informe a entrada com valor.";
    return;
  }
  const unUsa = labelUnidadeQtd(unidade, usa);
  const unEmb = labelUnidadeQtd(unidade, rend);
  if (Number.isFinite(usa) && usa > 0 && Number.isFinite(rend) && rend > 0) {
    el.textContent = `${usa} ${unUsa} nesta sessão / ${rend} ${unEmb} na embalagem de ${brlReceita(item.custo_unitario)} = ${brlReceita(item.subtotal)}`;
    return;
  }
  el.textContent = `${brlReceita(item.custo_unitario)} × ${q} = ${brlReceita(item.subtotal)} nesta sessão`;
}

function bindUsageEditor(custos = {}, unidades = {}) {
  custosReceitaMap = custos || {};
  unidadesReceitaMap = unidades || {};
  const wrap = document.getElementById("procUsageWrap");
  if (!wrap) return;
  const rows = document.getElementById("procUsageRows");
  const opts = PAPEL_RECEITA.map((p) => `<option value="${p.id}">${p.label}</option>`).join("");
  wrap.querySelectorAll(".proc-usage-chip").forEach((btn) => {
    btn.onclick = () => {
      rows?.insertAdjacentHTML("beforeend", usageRowHtml({ item_ref: USAGE_VAGA_PREFIX + btn.dataset.papel, quantity_used: 1 }, opts));
      const last = rows?.querySelector(".proc-usage-row:last-child");
      refreshUsageRowCusto(last);
    };
  });
  document.getElementById("btnProcUsageAdd")?.addEventListener("click", () => {
    rows?.insertAdjacentHTML("beforeend", usageRowHtml({}, opts));
    refreshUsageRowCusto(rows?.querySelector(".proc-usage-row:last-child"));
  });
  wrap.addEventListener("click", (e) => {
    const rm = e.target.closest(".proc-usage-remove");
    if (!rm) return;
    const row = rm.closest(".proc-usage-row");
    if (!row) return;
    if (rows.querySelectorAll(".proc-usage-row").length <= 1) {
      row.querySelector(".proc-usage-produto").value = "";
      row.querySelector(".proc-usage-papel").value = "";
      row.querySelector(".proc-usage-rendimento").value = "";
      const usaEl = row.querySelector(".proc-usage-usa");
      if (usaEl) usaEl.value = "";
      row.querySelector(".proc-usage-qty").value = "1";
      const unEl = row.querySelector(".proc-usage-unidade");
      if (unEl) unEl.value = "un";
      refreshUsageRowCusto(row);
      return;
    }
    row.remove();
  });
  wrap.addEventListener("input", (e) => {
    const row = e.target.closest(".proc-usage-row");
    if (!row) return;
    if (e.target.classList.contains("proc-usage-produto")) {
      const nome = e.target.value.trim().toLowerCase();
      const un = unidadesReceitaMap[nome];
      const unEl = row.querySelector(".proc-usage-unidade");
      if (un && unEl && !unEl.dataset.touched) unEl.value = un;
    }
    refreshUsageRowCusto(row);
  });
  wrap.addEventListener("change", (e) => {
    if (e.target.classList.contains("proc-usage-unidade")) {
      e.target.dataset.touched = "1";
    }
    const row = e.target.closest(".proc-usage-row");
    refreshUsageRowCusto(row);
  });
  wrap.querySelectorAll(".proc-usage-row").forEach(refreshUsageRowCusto);
}

function collectUsageFromForm() {
  const out = [];
  const seen = new Set();
  document.querySelectorAll("#procUsageRows .proc-usage-row").forEach((row) => {
    const papel = (row.querySelector(".proc-usage-papel")?.value || "").trim();
    const produto = (row.querySelector(".proc-usage-produto")?.value || "").trim();
    const usa = Number(row.querySelector(".proc-usage-usa")?.value);
    const rende = Number(row.querySelector(".proc-usage-rendimento")?.value);
    const frac = qtyFromUsaRende(usa, rende);
    let qty = frac != null ? frac : Number(row.querySelector(".proc-usage-qty")?.value);
    if (!produto && !papel) return;
    const nome = produto || (papel ? USAGE_VAGA_PREFIX + papel : "");
    if (!nome) return;
    const key = nome.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const unidade = produto ? row.querySelector(".proc-usage-unidade")?.value : "un";
    out.push({
      item_ref: joinUsageRef(nome, unidade, usa, rende),
      quantity_used: Number.isFinite(qty) && qty > 0 ? qty : 1,
      usa: Number.isFinite(usa) && usa > 0 ? usa : undefined,
      rende: Number.isFinite(rende) && rende > 0 ? rende : undefined,
      unidade,
    });
  });
  return out;
}

function aluguelEditorHtml(cfg = {}) {
  return `
    <div id="procAluguelWrap" class="proc-aluguel-wrap">
      <h4>Aluguel de equipamento no dia</h4>
      <p class="procedimento-modal-hint">Quando a clínica aluga o aparelho por dia (ex.: dia de laser), o aluguel entra no custo desse dia — não é rateado automaticamente em cada sessão e não muda o preço do paciente. Informe o valor do dia; o sistema mostra quantos atendimentos pagam o aluguel e ainda sobram.</p>
      <label>Equipamento (opcional)</label>
      <input type="text" id="procAluguelEquip" value="${escapeHtml(cfg.equip || "")}" placeholder="Ex.: HIFU, laser de CO2">
      <label>Aluguel neste dia (R$)</label>
      <input type="number" id="procAluguelDia" step="0.01" min="0" value="${cfg.dia != null ? cfg.dia : ""}" placeholder="Quanto custa o aparelho neste dia">
      <label>Horas com o equipamento neste dia</label>
      <input type="number" id="procAluguelHoras" min="1" max="16" step="0.5" value="${cfg.horas != null ? cfg.horas : 8}">
      <div id="procAluguelConta" class="proc-aluguel-conta" aria-live="polite"></div>
    </div>
  `;
}

function collectAluguelFromForm() {
  const diaEl = document.getElementById("procAluguelDia");
  const horasEl = document.getElementById("procAluguelHoras");
  const equipEl = document.getElementById("procAluguelEquip");
  const dia = diaEl && diaEl.value !== "" ? Number(diaEl.value) : null;
  const horas = horasEl && horasEl.value !== "" ? Number(horasEl.value) : 8;
  const equip = equipEl ? (equipEl.value || "").trim() : "";
  if (!(dia > 0)) return { dia: null, horas: 8, equip: "" };
  return { dia, horas: Number.isFinite(horas) && horas > 0 ? horas : 8, equip };
}

function refreshAluguelConta() {
  const el = document.getElementById("procAluguelConta");
  if (!el) return;
  const cfg = collectAluguelFromForm();
  const preco = Number(document.getElementById("procValor")?.value);
  const material = Number(document.getElementById("procCusto")?.value);
  const comissaoPct = Number(document.getElementById("procComissao")?.value);
  const margem = Number(document.getElementById("procMargem")?.value);
  const durationMinutes = Number(document.getElementById("procDuration")?.value) || 60;
  const c = contaDiaEquipamento({
    aluguelDia: cfg.dia,
    preco,
    material,
    comissaoPct,
    durationMinutes,
    horasDia: cfg.horas,
    margemAlvoPct: Number.isFinite(margem) ? margem : null,
  });
  el.textContent = textoContaDia(c);
}

function bindAluguelConta() {
  const wrap = document.getElementById("procAluguelWrap");
  if (!wrap) return;
  const ids = ["procAluguelDia", "procAluguelHoras", "procAluguelEquip", "procValor", "procCusto", "procComissao", "procMargem", "procDuration"];
  ids.forEach((id) => {
    document.getElementById(id)?.addEventListener("input", refreshAluguelConta);
    document.getElementById(id)?.addEventListener("change", refreshAluguelConta);
  });
  refreshAluguelConta();
}

function mergeDescriptionComAluguel(rawDesc) {
  return withAluguelMarker(rawDesc, collectAluguelFromForm());
}

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
  if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("sc_open_planos") === "1") {
    sessionStorage.removeItem("sc_open_planos");
    setTimeout(() => openPlanosTerapeuticosPanel(), 80);
  }
}

/** Se as taxas já estiverem configuradas, esconde o aviso da seção de planos. */
async function esconderAvisoTaxasPlanosSeConfigurado() {
  const el = document.getElementById("procPlanosHintTaxas");
  if (!el) return;
  const canFin = await checkPermission("financeiro:view").catch(() => false);
  if (!canFin) {
    el.hidden = true;
    return;
  }
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
      const willOpen = planosPanel.hidden;
      planosPanel.hidden = !willOpen;
      planosToggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
      if (willOpen) renderPlanosTerapeuticos();
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
    el.innerHTML = htmlCardMargemRisco(list);
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
    const custoReceitaById = {};
    try {
      const [usos, resumo] = await Promise.all([listAllProcedureStockUsage(), getResumoPorProduto()]);
      const map = {};
      for (const r of resumo || []) {
        const n = String(r.produto_nome || "").trim().toLowerCase();
        if (n && r.custo_medio != null && Number.isFinite(Number(r.custo_medio))) map[n] = Number(r.custo_medio);
      }
      const byProc = {};
      for (const u of usos || []) {
        if (!u.procedure_id) continue;
        (byProc[u.procedure_id] ||= []).push(u);
      }
      for (const [id, rows] of Object.entries(byProc)) {
        const out = custoRealFromUsage(rows, map);
        if (out.custoReal != null) custoReceitaById[id] = out.custoReal;
      }
    } catch (_) {}
    data = data.map((p) => ({
      ...p,
      custo_material_exibicao: custoReceitaById[p.id] != null ? custoReceitaById[p.id] : p.custo_material_estimado,
      custo_receita: custoReceitaById[p.id],
    }));
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
    else if (sortBy === "lucro_hora") {
      const order = new Map(rankLucroHora(data.map((p) => ({ ...p, custo_material_estimado: p.custo_material_exibicao }))).map((r, i) => [r.id, i]));
      data = [...data].sort((a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999));
    }
    else data = [...data].sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    const lucroEl = document.getElementById("procLucroHora");
    if (lucroEl) {
      const sum = summarizeLucroHora(rankLucroHora(data.map((p) => ({ ...p, custo_material_estimado: p.custo_material_exibicao }))));
      lucroEl.textContent = sum.copy;
    }

    if (!data || data.length === 0) {
      const lucroElEmpty = document.getElementById("procLucroHora");
      if (lucroElEmpty) lucroElEmpty.textContent = "Lucro/hora não informado — falta preço ou duração.";
      listEl.innerHTML = `
        <p class="procedimento-empty">Nenhum procedimento encontrado. Ajuste os filtros ou clique em "+ Novo procedimento".</p>
      `;
      return;
    }

    listEl.innerHTML = data
      .map((p) => {
        const catName = p.category_id ? (catById[p.category_id] || "") : "";
        const custoStr = p.custo_receita != null
          ? `Custo receita: R$ ${Number(p.custo_receita).toFixed(2).replace(".", ",")}`
          : p.custo_material_estimado != null
            ? `Custo material est.: R$ ${Number(p.custo_material_estimado).toFixed(2).replace(".", ",")}`
            : "";
        const margemStr = p.margem_minima_desejada != null ? `Margem: ${Number(p.margem_minima_desejada)}%` : "";
        const aluguelCfg = parseAluguelCadastro(p);
        const aluguelConta = aluguelCfg
          ? contaDiaEquipamento({
              aluguelDia: aluguelCfg.dia,
              preco: p.valor_cobrado,
              material: p.custo_material_exibicao,
              comissaoPct: p.comissao_profissional_pct,
              durationMinutes: p.duration_minutes,
              horasDia: aluguelCfg.horas,
              margemAlvoPct: p.margem_minima_desejada,
            })
          : null;
        const aluguelStr =
          aluguelConta && aluguelConta.nPagar
            ? `Aluguel dia: ${aluguelConta.nPagar} p/ pagar${aluguelConta.nSobra ? ` · ${aluguelConta.nSobra} p/ sobrar` : ""}`
            : aluguelCfg
              ? `Aluguel dia: R$ ${Number(aluguelCfg.dia).toFixed(2).replace(".", ",")}`
              : "";
        const extra = [custoStr, margemStr, aluguelStr].filter(Boolean).join(" · ");
        const descVisivel = stripAluguelMarker(p.description || "");
        return `
      <div class="procedimento-card ${p.active ? "" : "procedimento-card--inactive"}" data-id="${p.id}">
        <div class="procedimento-card__body">
          <h3 class="procedimento-card__name">${p.codigo ? `<span class="procedimento-card__codigo">${escapeHtml(p.codigo)}</span> ` : ""}${escapeHtml(p.name)}</h3>
          ${catName ? `<p class="procedimento-card__category">${escapeHtml(catName)}</p>` : ""}
          ${descVisivel ? `<p class="procedimento-card__desc">${escapeHtml(descVisivel.slice(0, 80))}${descVisivel.length > 80 ? "…" : ""}</p>` : ""}
          <p class="procedimento-card__meta">${p.duration_minutes} min${p.valor_cobrado != null ? ` · R$ ${Number(p.valor_cobrado).toFixed(2).replace(".", ",")}` : ""}${extra ? ` · ${extra}` : ""}${(() => {
            const lh = rankLucroHora([{ ...p, custo_material_estimado: p.custo_material_exibicao }])[0];
            return lh ? ` · ~R$ ${Number(lh.lucroHora).toFixed(2).replace(".", ",")}/h` : "";
          })()}</p>
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
  let nomes = [];
  let custos = {};
  let unidades = {};
  try {
    categories = await listProcedureCategories();
  } catch (_) {}
  try {
    nomes = await nomesEstoqueReceita();
  } catch (_) {}
  try {
    custos = await custosEstoqueReceita();
  } catch (_) {}
  try {
    unidades = await unidadesEstoqueReceita();
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
    ${aluguelEditorHtml()}
    ${usageEditorHtml([], nomes)}
    ${htmlBlocoNaoPerder()}
    <p class="procedimento-modal-hint">O valor aqui entra em finanças (lucro, custo, pagamento) e depois em metas reais.</p>
    `,
    submitCreate
  );
  bindUsageEditor(custos, unidades);
  bindAluguelConta();
  bindPricingSuggestion();
  bindPrecificacaoComTaxas();
}

async function openEditModal(id) {
  try {
    const [list, categories, nomes, usage, custos, unidades] = await Promise.all([
      listProcedures(false),
      listProcedureCategories().catch(() => []),
      nomesEstoqueReceita().catch(() => []),
      getProcedureStockUsage(id),
      custosEstoqueReceita().catch(() => ({})),
      unidadesEstoqueReceita().catch(() => ({})),
    ]);
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
      <textarea id="procDesc" placeholder="Descrição do procedimento (opcional)" rows="2">${escapeHtml(stripAluguelMarker(p.description || ""))}</textarea>
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
      ${aluguelEditorHtml(parseAluguelCadastro(p) || {})}
      ${usageEditorHtml(usage, nomes)}
      ${htmlBlocoNaoPerder()}
      <div id="procCustoRealBlock" class="procedimento-custo-real-block" aria-live="polite"></div>
      <div id="procPlBlock" class="procedimento-pl-block" aria-live="polite"></div>
      <input type="hidden" id="procId" value="${p.id}">
      <p class="procedimento-modal-hint">O procedimento entra em finanças: lucro real, custo operacional, pagamento funcionário; depois ajuda em metas plausíveis.</p>
      `,
      () => submitEdit(id)
    );
    bindUsageEditor(custos, unidades);
    bindAluguelConta();
    bindPricingSuggestion();
    bindPrecificacaoComTaxas();
    const block = document.getElementById("procCustoRealBlock");
    if (block) {
      try {
        const { custoReal, itens } = await getCustoRealProcedimento(id);
        if (itens.length === 0) {
          block.innerHTML = "";
        } else {
          block.innerHTML = `
            <h4>📦 Materiais usados e custo real (calculado)</h4>
            <p class="procedimento-modal-hint">Custo desta ficha = (quanto usa aqui ÷ quanto cabe na embalagem) × valor do produto. Os valores são os que você cadastrou neste procedimento. Compare com o estimado acima.</p>
            <ul class="proc-custo-real-list">${itens.map((i) => `<li><strong>${escapeHtml(usageDisplayName(i.item_ref))}</strong>: ${i.vaga ? "vaga, sem custo até o dia" : i.usa && i.rende ? `${i.usa} ${escapeHtml(labelUnidadeQtd(i.unidade, i.usa))} / ${i.rende} na embalagem = R$ ${(i.subtotal != null ? i.subtotal : 0).toFixed(2).replace(".", ",")}` : `${i.quantity_used} ${escapeHtml(labelUnidadeQtd(i.unidade, i.quantity_used))} × ${i.custo_unitario != null ? "R$ " + i.custo_unitario.toFixed(2).replace(".", ",") : "—"} = R$ ${(i.subtotal != null ? i.subtotal : 0).toFixed(2).replace(".", ",")}`}</li>`).join("")}</ul>
            ${custoReal != null ? `<p class="proc-custo-real-total"><strong>Custo real total: R$ ${custoReal.toFixed(2).replace(".", ",")}</strong></p>` : `<p class="procedimento-modal-hint">Custo real total ainda não informado (vaga ou produto sem custo médio).</p>`}
          `;
        }
      } catch (e) {
        block.innerHTML = `<h4>📦 Materiais usados e custo real</h4><p class="procedimento-custo-real-empty">Erro ao carregar custo real.</p>`;
      }
    }
    const plBlock = document.getElementById("procPlBlock");
    if (plBlock) {
      try {
        const eco = await explainProcedureEconomics(p);
        plBlock.innerHTML = `
          <h4>P&amp;L do procedimento (estimativa)</h4>
          <p class="procedimento-modal-hint">${escapeHtml(eco.aviso)}</p>
          <ul class="proc-pl-list">
            <li>Preço atual: <strong>${brl(eco.preco)}</strong></li>
            <li>Material (${escapeHtml(eco.materialFonte || "não informado")}): <strong>${brl(eco.material)}</strong></li>
            <li>Comissão (${eco.comissaoPct}%): <strong>${brl(eco.comissao)}</strong></li>
            <li>Taxa maquininha à vista crédito (${eco.taxaPct}%): <strong>${brl(eco.taxaPagamento)}</strong></li>
            <li>Custo estrutural (${escapeHtml(eco.rateioMetodoLabel || "não informado")}): <strong>${brl(eco.custoEstrutural)}</strong>${eco.rateioDetalhe ? ` — ${escapeHtml(eco.rateioDetalhe)}` : ""}</li>
            <li>Lucro estimado: <strong>${brl(eco.lucro)}</strong> · margem ${eco.margemPct != null ? eco.margemPct.toFixed(1).replace(".", ",") + "%" : "não informado"}</li>
            <li>Lucro / hora: <strong>${brl(eco.lucroHora)}</strong></li>
            ${(() => {
              const cfgA = parseAluguelCadastro(p);
              if (!cfgA) return "";
              const dia = contaDiaEquipamento({
                aluguelDia: cfgA.dia,
                preco: p.valor_cobrado,
                material: eco.material,
                comissaoPct: eco.comissaoPct,
                taxaPct: eco.taxaPct,
                durationMinutes: p.duration_minutes,
                horasDia: cfgA.horas,
                margemAlvoPct: p.margem_minima_desejada,
              });
              return `<li>Aluguel no dia (${escapeHtml(cfgA.equip || "equipamento")}): <strong>${brl(cfgA.dia)}</strong> — ${escapeHtml(textoContaDia(dia, { nomeProc: p.name || "procedimento" }))}</li>`;
            })()}
            <li>Preço de equilíbrio: <strong>${brl(eco.precoEquilibrio)}</strong> · mínimo (margem alvo): <strong>${brl(eco.precoMinimo)}</strong> · calculado (estrutura de custos, não mercado): <strong>${brl(eco.precoCalculado)}</strong></li>
          </ul>
          <p class="procedimento-modal-hint">Sugestões não alteram o valor cobrado. Você decide.</p>
        `;
      } catch (_) {
        plBlock.innerHTML = `<h4>P&amp;L do procedimento</h4><p class="procedimento-custo-real-empty">Não foi possível calcular a estimativa.</p>`;
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
  const aluguel = collectAluguelFromForm();
  const description = mergeDescriptionComAluguel(descEl ? (descEl.value || "").trim() : "");
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
    const created = await createProcedure({ name, description, durationMinutes: Number(durationEl.value) || 60, valorCobrado, codigo, categoryId, custoMaterialEstimado, margemMinimaDesejada, comissaoProfissionalPct, tipoProcedimento, termoEspecifico, aluguelEquipamentoDia: aluguel.dia, aluguelHorasDia: aluguel.horas, aluguelEquipamentoNome: aluguel.equip });
    if (created?.id) {
      try {
        await replaceProcedureStockUsage(created.id, collectUsageFromForm());
      } catch (uErr) {
        console.warn("[PROCEDIMENTO] receita", uErr);
        toast(uErr.message || "Procedimento criado; a receita de materiais não salvou.");
        closeModal();
        renderProcedimentos();
        return;
      }
    }
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
  const aluguel = collectAluguelFromForm();
  const description = mergeDescriptionComAluguel(descEl ? (descEl.value || "").trim() : "");
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
      aluguelEquipamentoDia: aluguel.dia,
      aluguelHorasDia: aluguel.horas,
      aluguelEquipamentoNome: aluguel.equip,
    });
    try {
      await replaceProcedureStockUsage(id, collectUsageFromForm());
    } catch (uErr) {
      console.warn("[PROCEDIMENTO] receita", uErr);
      toast(uErr.message || "Procedimento salvo; a receita de materiais não atualizou.");
      closeModal();
      renderProcedimentos();
      return;
    }
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

function openPlanosTerapeuticosPanel() {
  const toggle = document.getElementById("procPlanosToggle");
  const panel = document.getElementById("procPlanosPanel");
  const wrap = document.getElementById("procedimentoPlanosWrap");
  if (!panel || !toggle) return;
  panel.hidden = false;
  toggle.setAttribute("aria-expanded", "true");
  wrap?.classList.add("procedimento-planos-wrap--focus");
  wrap?.scrollIntoView({ behavior: "smooth", block: "start" });
  renderPlanosTerapeuticos();
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
    const canSimular = await checkPermission("financeiro:view").catch(() => false);

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
      const blocoFinanceiro = canSimular && valorTotal > 0
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

function htmlBlocoNaoPerder() {
  return `
    <div class="procedimento-nao-perder" id="procNaoPerder" aria-live="polite"></div>
    <div class="procedimento-pricing-taxas-block" id="procPrecificacaoComTaxasWrap">
      <h4>Margem depois da maquininha</h4>
      <p class="procedimento-modal-hint procedimento-aviso-taxas" style="margin:0 0 6px;">Taxas reais em Configurações → Taxas da maquininha. O sistema não grava o preço daqui.</p>
      <div id="procPrecificacaoComTaxas" class="proc-precificacao-taxas-content" aria-live="polite"></div>
    </div>
    <div class="procedimento-pricing-block">
      <h4>Leitura da IA (opcional)</h4>
      <p class="procedimento-modal-hint" style="margin:0 0 8px;">Usa custo e, se houver, a faixa citada do radar. Não inventa concorrente. Você decide se aplica o valor.</p>
      <button type="button" id="btnSugerirPreco" class="btn-secondary">Pedir leitura da IA</button>
      <div id="procPricingResult" class="procedimento-pricing-suggestion hidden" aria-live="polite"></div>
    </div>
  `;
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
      const radar = casarRadarRef(radarRefsCache, {
        procedureId: document.getElementById("procId")?.value || "",
        nome,
      });
      const res = await gerarPreco({ custos, protocolo, mercado: radar || undefined });

      const raw = (res && res.content) ? res.content : (typeof res === "string" ? res : "");
      const jsonStr = raw.replace(/```json?\s*/g, "").replace(/```\s*$/g, "").trim();
      let data = {};
      try {
        data = JSON.parse(jsonStr);
      } catch (_) {
        data = typeof res === "object" && (res.preco_calculado != null || res.preco_ideal != null) ? res : {};
      }
      precoIdeal = data.preco_calculado ?? data.preco_ideal;
      if (precoIdeal == null) precoIdeal = data.preco_min;
      justificativa = data.justificativa || "";
    } catch (e) {
      console.warn("[PROCEDIMENTO] IA precificação falhou, usando fórmula", e);
    }

    if (precoIdeal == null && custoMaterial != null && margemMin != null && margemMin < 100) {
      precoIdeal = custoMaterial / (1 - margemMin / 100);
      justificativa = "Cálculo pela estrutura: custo ÷ (1 − margem%). Não é preço de mercado. Você pode ajustar.";
    }

    if (precoIdeal != null) {
      const valorStr = Number(precoIdeal).toFixed(2).replace(".", ",");
      resultEl.innerHTML = `
        <p><span class="valor-sugerido">Preço calculado (estrutura de custos): R$ ${valorStr}</span></p>
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

let radarRefsCache = [];

/**
 * Precificação cruzada: custo + taxa + faixa citada. Não grava preço.
 */
function bindPrecificacaoComTaxas() {
  const container = document.getElementById("procPrecificacaoComTaxas");
  const cardEl = document.getElementById("procNaoPerder");
  const valorEl = document.getElementById("procValor");
  const custoEl = document.getElementById("procCusto");
  const margemEl = document.getElementById("procMargem");
  const nomeEl = document.getElementById("procName");
  if (!container && !cardEl) return;

  radarRefsCache = [];
  listMarketRadar()
    .then((rows) => {
      radarRefsCache = rows || [];
      atualizar();
    })
    .catch(() => {
      radarRefsCache = [];
      atualizar();
    });

  function fmt(v) {
    if (v == null || Number.isNaN(v)) return "—";
    return Number(v).toFixed(2).replace(".", ",");
  }

  function atualizar() {
    const valor = valorEl && valorEl.value !== "" ? Number(valorEl.value) : null;
    const custo = custoEl && custoEl.value !== "" ? Number(custoEl.value) : null;
    const margem = margemEl && margemEl.value !== "" ? Number(margemEl.value) : null;
    const nome = (nomeEl && nomeEl.value || "").trim();
    const procedureId = document.getElementById("procId")?.value || "";
    const radar = casarRadarRef(radarRefsCache, { procedureId, nome });

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
        const liqAvista = valor != null && valor > 0 ? calcularLiquido(valor, taxaAvista) : null;
        const minAvista = custo != null && custo > 0 && margem != null && margem >= 0 && margem < 100
          ? valorBrutoMinimoParaMargem(custo, margem, taxaAvista)
          : null;

        if (cardEl) {
          const leitura = leituraNaoPerder({
            preco: valor,
            custo,
            margemAlvo: margem,
            liquidoAvista: liqAvista,
            taxaAvistaPct: taxaAvista,
            minAvistaAlvo: minAvista,
            radar,
          });
          const faixaHtml = radar
            ? `<p>Faixa citada: R$ ${fmt(radar.preco_min)} – R$ ${fmt(radar.preco_max)} · ${escapeHtml(radar.fonte)} · ${escapeHtml(radar.regiao)} · ${escapeHtml(String(radar.data_ref).slice(0, 10))}</p>`
            : "";
          const minHtml = minAvista != null
            ? `<p>Valor mínimo à vista para o alvo de margem (estrutura + taxa): <strong>R$ ${fmt(minAvista)}</strong>. Não é preço de mercado.</p>`
            : "";
          const liqHtml = liqAvista != null && valor != null && valor > 0
            ? `<p>Se cobrar R$ ${fmt(valor)}, à vista a clínica recebe <strong>R$ ${fmt(liqAvista)}</strong> depois da maquininha${leitura.margemAposTaxa != null ? ` (margem ${fmt(leitura.margemAposTaxa)}%)` : ""}.</p>`
            : "";
          cardEl.className = "procedimento-nao-perder procedimento-nao-perder--" + leitura.tom;
          cardEl.innerHTML =
            `<h4>${escapeHtml(leitura.titulo)}</h4>` +
            `<p class="procedimento-modal-hint">Custo + taxa + faixa citada. A IA não grava o preço.</p>` +
            faixaHtml +
            liqHtml +
            minHtml +
            `<p>${escapeHtml(leitura.alerta)}</p>` +
            `<p class="procedimento-modal-hint"><a href="#market-radar" data-view="market-radar">Radar de mercado</a> · <a href="#precificacao-taxas" data-view="precificacao-taxas">Taxas da maquininha</a></p>`;
        }

        if (!container) return;
        const partes = [];

        if (custo != null && custo > 0 && margem != null && margem >= 0 && margem < 100) {
          const min6 = valorBrutoMinimoParaMargem(custo, margem, taxa6);
          const min12 = valorBrutoMinimoParaMargem(custo, margem, taxa12);
          partes.push(
            `<p><strong>Para manter margem ${fmt(margem)}%</strong> sobre o que você recebe: valor mínimo <strong>à vista R$ ${fmt(minAvista)}</strong>, <strong>6x R$ ${fmt(min6)}</strong>, <strong>12x R$ ${fmt(min12)}</strong>.</p>`
          );
        }

        if (valor != null && valor > 0 && custo != null) {
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
        if (container) {
          container.innerHTML = "<p class=\"procedimento-modal-hint\">Configure as taxas em <strong>Configurações → Taxas da maquininha</strong> para ver valor mínimo e margem após taxa.</p>";
        }
        if (cardEl) {
          const leitura = leituraNaoPerder({
            preco: valor,
            custo,
            margemAlvo: margem,
            radar,
          });
          cardEl.className = "procedimento-nao-perder procedimento-nao-perder--" + leitura.tom;
          cardEl.innerHTML =
            `<h4>${escapeHtml(leitura.titulo)}</h4>` +
            `<p>${escapeHtml(leitura.alerta)}</p>`;
        }
      });
  }

  [valorEl, custoEl, margemEl, nomeEl].filter(Boolean).forEach((el) => {
    el.addEventListener("input", atualizar);
    el.addEventListener("change", atualizar);
  });
  atualizar();
}
