
import { openModal, closeModal, openConfirmModal } from "../ui/modal.js"

import { supabase }
from "../core/supabase.js"

import { toast }
from "../ui/toast.js"

import { gerarPdf }
from "../utils/pdf.js"

import { getFinanceiro }
from "../services/financeiro.service.js"

import { withOrg, getActiveOrg } from "../core/org.js"

import { listProcedures } from "../services/procedimentos.service.js"
import { inferirCategoriaSaida } from "../utils/categoria-financeiro.js"

import { audit, getMargemEmRisco } from "../services/audit.service.js"

import { getRole } from "../services/permissions.service.js"
import {
  listContasAPagar,
  createContaAPagar,
  updateContaAPagar,
  deleteContaAPagar,
} from "../services/contas-a-pagar.service.js"
import {
  listFinanceiroMetas,
  createFinanceiroMeta,
  updateFinanceiroMeta,
  deleteFinanceiroMeta,
  TIPOS_META,
} from "../services/financeiro-metas.service.js"
import {
  listParticipacaoLucros,
  createParticipacaoLucros,
  updateParticipacaoLucros,
  deleteParticipacaoLucros,
} from "../services/participacao-lucros.service.js"
import {
  parseCSVExtrato,
  inserirTransacoesImportadas,
  contarImportadosParaRevisao,
} from "../services/importacao-bancaria.service.js"
import { importarLote, getTemplateHeaders } from "../services/importacao-lote.service.js"
import {
  listContasVinculadas,
  createContaVinculada,
  desvincularConta,
  getWebhookTransacoesUrl,
} from "../services/contas-vinculadas.service.js"


/* =====================
   Patch
===================== */


export function init(){
 bindUI()
 bindFinanceiroMainTabs()
 const openTab = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("financeiro_open_tab") : null
 if (openTab === "custo-fixo") {
   sessionStorage.removeItem("financeiro_open_tab")
   switchFinanceiroMainTab("custo-fixo")
 }
 renderFinanceiro()
}

/* =====================
   INIT
===================== */

function bindUI(){

 const btnNovaTransacao =
  document.getElementById(
   "btnNovaTransacao"
  )

 const btnPdf =
  document.getElementById(
   "btnPdf"
  )

 if(btnNovaTransacao)
  btnNovaTransacao.onclick =
   () => openCreateModal()

 if(btnPdf)
  btnPdf.onclick =
   exportarPdf

 const btnImportar = document.getElementById("btnImportarExtrato")
 if (btnImportar) btnImportar.onclick = () => openImportarExtratoModal()
 const btnPlanilha = document.getElementById("btnImportarPlanilha")
 const inputPlanilha = document.getElementById("importFinanceiroFile")
 if (btnPlanilha && inputPlanilha) {
   btnPlanilha.onclick = () => inputPlanilha.click()
   inputPlanilha.onchange = async () => {
     const file = inputPlanilha.files?.[0]
     if (!file) return
     inputPlanilha.value = ""
     try {
       const r = await importarLote("financeiro", file)
       toast(r.inseridos ? r.inseridos + " transação(ões) importada(s)." : "Nenhum importado. Verifique o CSV.")
       if (r.erros?.length) toast("Erros: " + r.erros.length + " linha(s).", "warn")
       renderFinanceiro()
     } catch (e) {
       toast(e.message || "Erro ao importar.")
     }
   }
 }
 const btnVincular = document.getElementById("btnVincularConta")
 if (btnVincular) btnVincular.onclick = () => openVincularContaModal()

 const btnModelo = document.getElementById("btnModeloFinanceiro")
 if (btnModelo) {
   btnModelo.onclick = (e) => {
     e.preventDefault()
     const headers = getTemplateHeaders("financeiro")
     const line = headers.join(";")
     const blob = new Blob([line + "\n"], { type: "text/csv" })
     const a = document.createElement("a")
     a.href = URL.createObjectURL(blob)
     a.download = "modelo_financeiro.csv"
     a.click()
     toast("Modelo baixado!")
   }
 }
}

function bindFinanceiroMainTabs() {
  const tabs = document.querySelectorAll(".financeiro-main-tab")
  const panels = document.querySelectorAll(".financeiro-main-panel")
  if (!tabs.length || !panels.length) return
  tabs.forEach((tab) => {
    tab.onclick = () => switchFinanceiroMainTab(tab.dataset.tab)
  })
}

function switchFinanceiroMainTab(tabId) {
  const tabs = document.querySelectorAll(".financeiro-main-tab")
  const panels = document.querySelectorAll(".financeiro-main-panel")
  tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.tab === tabId))
  panels.forEach((p) => p.classList.toggle("hidden", p.dataset.tab !== tabId))
  if (tabId === "custo-fixo") {
    const panel = document.getElementById("financeiroCustoFixoPanel")
    if (panel && !panel.querySelector(".setup-inicial-custos")) {
      import("../views/setup-inicial.views.js").then((m) => {
        if (m.renderCustoFixo && m.bindCustoFixoEvents) {
          m.renderCustoFixo(panel)
          m.bindCustoFixoEvents(panel)
        }
      }).catch(() => {})
    }
  }
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

export async function renderFinanceiro(){
  const resumoEl = document.getElementById("financeiroResumo")
  const porProcEl = document.getElementById("financeiroPorProcedimento")
  const listaEl = document.getElementById("listaFinanceiro")
  if (!listaEl) return

  renderCardMargemRisco("financeiroCardMargemRisco");

  try{
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast("Sessão expirada")
      window.location.href = "/index.html"
      return
    }

    const data = await getFinanceiro()
    let procedures = []
    try { procedures = await listProcedures(false) } catch (_) {}
    const procById = (procedures || []).reduce((acc, p) => { acc[p.id] = p; return acc }, {})

    const valorEntrada = (t) => (t.tipo === "entrada" && t.valor_recebido != null && t.valor_recebido !== "") ? Number(t.valor_recebido) : Number(t.valor) || 0
    const totalEntradas = (data || []).filter(t => t.tipo === "entrada").reduce((s, t) => s + valorEntrada(t), 0)
    const saidasList = (data || []).filter(t => t.tipo === "saida")
    const totalSaidas = saidasList.reduce((s, t) => s + Number(t.valor) || 0, 0)
    const saldo = totalEntradas - totalSaidas

    const categorias = { funcionario: 0, insumos: 0, custo_fixo: 0, outro: 0 }
    saidasList.forEach(t => {
      const cat = t.categoria_saida && categorias.hasOwnProperty(t.categoria_saida) ? t.categoria_saida : "outro"
      categorias[cat] += Number(t.valor) || 0
    })
    const labelsCat = { funcionario: "Funcionário", insumos: "Insumos", custo_fixo: "Custo fixo", outro: "Outro" }
    const percentuais = totalSaidas > 0
      ? Object.entries(categorias).map(([k, v]) => ({ key: k, label: labelsCat[k], valor: v, pct: (v / totalSaidas) * 100 })).filter(x => x.valor > 0)
      : []

    if (resumoEl) {
      resumoEl.innerHTML = `
        <div class="financeiro-resumo__grid">
          <div class="financeiro-resumo__card financeiro-resumo__entradas">
            <span class="financeiro-resumo__label">Entradas</span>
            <span class="financeiro-resumo__valor">R$ ${totalEntradas.toFixed(2).replace(".", ",")}</span>
          </div>
          <div class="financeiro-resumo__card financeiro-resumo__saidas">
            <span class="financeiro-resumo__label">Saídas</span>
            <span class="financeiro-resumo__valor">R$ ${totalSaidas.toFixed(2).replace(".", ",")}</span>
            ${percentuais.length ? `<div class="financeiro-resumo__breakdown">${percentuais.map(x => `${x.pct.toFixed(0)}% ${x.label}`).join(" · ")}</div>` : ""}
          </div>
          <div class="financeiro-resumo__card financeiro-resumo__saldo">
            <span class="financeiro-resumo__label">Saldo</span>
            <span class="financeiro-resumo__valor">R$ ${saldo.toFixed(2).replace(".", ",")}</span>
          </div>
        </div>
      `
    }

    const detalheEl = document.getElementById("financeiroSaidasDetalhe")
    if (detalheEl && percentuais.length > 0 && typeof window.Chart !== "undefined") {
      detalheEl.innerHTML = `
        <h3 class="financeiro-saidas-detalhe__title">Saídas por tipo</h3>
        <div class="financeiro-saidas-detalhe__chart-wrap">
          <canvas id="financeiroPieChart" width="280" height="280" aria-label="Gráfico de pizza: distribuição das saídas por tipo"></canvas>
        </div>
      `
      const ctx = document.getElementById("financeiroPieChart")
      if (ctx) {
        if (window._financeiroPieChart) window._financeiroPieChart.destroy()
        const cores = ["#4f46e5", "#059669", "#dc2626", "#d97706"]
        window._financeiroPieChart = new window.Chart(ctx.getContext("2d"), {
          type: "pie",
          data: {
            labels: percentuais.map(x => `${x.label} (${x.pct.toFixed(0)}%)`),
            datasets: [{ data: percentuais.map(x => x.valor), backgroundColor: percentuais.map((_, i) => cores[i % cores.length]) }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: { position: "bottom" }
            }
          }
        })
      }
    } else if (detalheEl) {
      detalheEl.innerHTML = ""
    }

    const entradasPorProc = {}
    ;(data || []).filter(t => t.tipo === "entrada" && t.procedure_id).forEach(t => {
      entradasPorProc[t.procedure_id] = (entradasPorProc[t.procedure_id] || 0) + valorEntrada(t)
    })
    const porProcedimento = Object.entries(entradasPorProc).map(([procedureId, receita]) => {
      const p = procById[procedureId]
      const custoEst = p && p.custo_material_estimado != null ? Number(p.custo_material_estimado) : null
      const valorCobrado = p && p.valor_cobrado != null ? Number(p.valor_cobrado) : null
      let margemPct = null
      if (receita > 0 && custoEst != null) margemPct = ((receita - custoEst) / receita) * 100
      return { procedureId, name: p ? (p.name || "—") : "—", receita, custoEst, margemPct }
    }).sort((a, b) => b.receita - a.receita)

    if (porProcEl) {
      if (porProcedimento.length === 0) {
        porProcEl.innerHTML = `<p class="financeiro-por-procedimento__empty">Vincule entradas a procedimentos para ver receita, custo e margem por procedimento.</p>`
      } else {
        porProcEl.innerHTML = `
          <h3 class="financeiro-por-procedimento__title">Por procedimento (receita vinculada)</h3>
          <div class="financeiro-por-procedimento__table-wrap">
            <table class="financeiro-por-procedimento__table">
              <thead><tr><th>Procedimento</th><th>Receita</th><th>Custo est.</th><th>Margem</th></tr></thead>
              <tbody>
                ${porProcedimento.map(row => `
                  <tr>
                    <td>${escapeHtml(row.name)}</td>
                    <td>R$ ${row.receita.toFixed(2).replace(".", ",")}</td>
                    <td>${row.custoEst != null ? "R$ " + row.custoEst.toFixed(2).replace(".", ",") : "—"}</td>
                    <td>${row.margemPct != null ? row.margemPct.toFixed(1) + "%" : "—"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `
      }
    }

    const formaPagamentoLabel = (f) => ({ pix: "PIX", cartao_credito: "Cartão crédito", cartao_debito: "Cartão débito", dinheiro: "Dinheiro", transferencia: "Transferência", boleto: "Boleto", outro: "Outro" })[f] || f || ""
    const catLabel = (c) => ({ funcionario: "Funcionário", insumos: "Insumos", custo_fixo: "Custo fixo", outro: "Outro" })[c] || ""
    listaEl.innerHTML = (data || []).map(t => {
      const procName = t.procedure_id && procById[t.procedure_id] ? procById[t.procedure_id].name : ""
      const catName = t.tipo === "saida" && t.categoria_saida ? catLabel(t.categoria_saida) : ""
      const isImportado = t.importado === true
      const cardClass = "item-card" + (isImportado ? " item-card--imported" : "")
      const valorExibir = t.tipo === "entrada" ? valorEntrada(t) : Number(t.valor) || 0
      const formaPagamentoText = t.tipo === "entrada" && t.forma_pagamento ? formaPagamentoLabel(t.forma_pagamento) : ""
      const valorRecebidoDiferente = t.tipo === "entrada" && t.valor_recebido != null && t.valor_recebido !== "" && Number(t.valor_recebido) !== Number(t.valor)
      return `
        <div class="${cardClass}" data-id="${t.id}">
          <b>${escapeHtml(t.descricao || "")}</b>${isImportado ? " <span class=\"item-card__badge-importado\">Importado</span>" : ""}<br>
          ${t.tipo} - R$ ${valorExibir.toFixed(2).replace(".", ",")}${valorRecebidoDiferente ? ` <span class="item-card__valor-recebido">(cobrado R$ ${Number(t.valor).toFixed(2).replace(".", ",")})</span>` : ""}
          ${formaPagamentoText ? `<br><span class="item-card__forma-pagamento">${escapeHtml(formaPagamentoText)}</span>` : ""}
          ${procName ? `<br><span class="item-card__procedure">${escapeHtml(procName)}</span>` : ""}
          ${catName ? `<br><span class="item-card__categoria">${escapeHtml(catName)}</span>` : ""}
          ${t.conta_origem ? `<br><span class="item-card__conta">${escapeHtml(t.conta_origem)}</span>` : ""}
        </div>
      `
    }).join("")

    const bannerEl = document.getElementById("financeiroImportacaoBanner")
    if (bannerEl) {
      try {
        const { deHoje, totalUltimos7 } = await contarImportadosParaRevisao()
        if (totalUltimos7 > 0) {
          bannerEl.classList.remove("hidden")
          const msgHoje = deHoje > 0 ? `Você teve <strong>${deHoje}</strong> ${deHoje === 1 ? "gasto importado" : "gastos importados"} hoje.` : ""
          const msg7 = totalUltimos7 > 0 ? `Nos últimos 7 dias: <strong>${totalUltimos7}</strong> ${totalUltimos7 === 1 ? "transação" : "transações"} importada(s).` : ""
          bannerEl.innerHTML = `
            <p class="financeiro-importacao-banner__text">
              ${msgHoje} ${msg7}
              Quer <button type="button" class="financeiro-importacao-banner__btn">adicionar descrição</button> para manter o sistema organizado? (No Brasil o nome na máquina nem sempre é de quem você comprou.)
            </p>
          `
          bannerEl.querySelector(".financeiro-importacao-banner__btn")?.addEventListener("click", () => {
            document.getElementById("listaFinanceiro")?.scrollIntoView({ behavior: "smooth" })
            bannerEl.classList.add("hidden")
          })
        } else {
          bannerEl.classList.add("hidden")
          bannerEl.innerHTML = ""
        }
      } catch (_) {
        bannerEl.classList.add("hidden")
      }
    }

    bindEditEvents()

    await renderContasVinculadas()

    const masterWrap = document.getElementById("financeiroMasterWrap")
    const role = await getRole()
    if (masterWrap) {
      if (role === "master") {
        masterWrap.classList.remove("hidden")
        await renderMasterSection(data, totalEntradas, totalSaidas, saldo)
        bindMasterUI()
      } else {
        masterWrap.classList.add("hidden")
      }
    }
  } catch (err) {
    console.error("[FINANCEIRO] erro render", err)
    if (listaEl) listaEl.innerHTML = ""
    toast("Erro ao carregar financeiro")
  }
}

function escapeHtml(str) {
  if (str == null) return ""
  const div = document.createElement("div")
  div.textContent = str
  return div.innerHTML
}


/* =====================
   MODAIS
===================== */

async function openCreateModal(){

 let procedures = []
 try { procedures = await listProcedures(true) } catch (_) {}
 const procOptions = "<option value=\"\">Nenhum</option>" + (procedures || []).map((p) => `<option value="${p.id}">${(p.name || "").replace(/</g, "&lt;")}</option>`).join("")

 openModal(
  "Nova transação",

  `
   <p class="financeiro-categoria-hint">Dica: ao digitar "Aluguel", "Luz", "Internet" etc., o sistema classifica como Custo fixo automaticamente.</p>
   <label>Descrição</label>
   <input id="desc" required placeholder="Ex.: Aluguel, Conta de luz, Salário Maria">

   <label>Tipo</label>
   <select id="tipo">
    <option value="entrada">Entrada</option>
    <option value="saida">Saída</option>
   </select>

   <label id="labelCategoriaSaida" class="financeiro-categoria-saida-label">Tipo de saída</label>
   <select id="categoriaSaida">
    <option value="">— (detectar pela descrição)</option>
    <option value="funcionario">Funcionário</option>
    <option value="insumos">Insumos</option>
    <option value="custo_fixo">Custo fixo</option>
    <option value="outro">Outro</option>
   </select>

   <label id="labelProc" class="financeiro-proc-label">Procedimento (receita por serviço)</label>
   <select id="procId">${procOptions}</select>

   <div id="wrapFormaPagamento" class="financeiro-entrada-extra" style="display:none;">
     <label>Forma de pagamento</label>
     <select id="formaPagamento">
       <option value="">—</option>
       <option value="pix">PIX</option>
       <option value="cartao_credito">Cartão crédito</option>
       <option value="cartao_debito">Cartão débito</option>
       <option value="dinheiro">Dinheiro</option>
       <option value="transferencia">Transferência</option>
       <option value="boleto">Boleto</option>
       <option value="outro">Outro</option>
     </select>
     <label>Valor recebido (quanto entrou de fato)</label>
     <input id="valorRecebido" type="number" step="0.01" placeholder="Deixe vazio = mesmo que o valor">
   </div>

   <label>Valor</label>
   <input id="valor" type="number" step="0.01" required>

   <label>Data</label>
   <input id="data" type="date" required>
  `,

  createTransacao
 )
 const tipoSelect = document.getElementById("tipo")
 if (tipoSelect) tipoSelect.addEventListener("change", toggleEntradaCamposCreate)
 toggleEntradaCamposCreate()
}
function toggleEntradaCamposCreate() {
  const wrap = document.getElementById("wrapFormaPagamento")
  const tipo = document.getElementById("tipo")?.value
  if (wrap) wrap.style.display = tipo === "entrada" ? "block" : "none"
}


async function openEditModal(id){

 try{

  const { data, error } =
   await supabase
    .from("financeiro")
    .select("*")
    .eq("id",id)
    .single()

  if(error) throw error

  let procedures = []
  try { procedures = await listProcedures(true) } catch (_) {}
  const procOptionsEdit = "<option value=\"\">Nenhum</option>" + (procedures || []).map((p) => {
   const sel = data.procedure_id === p.id ? " selected" : ""
   return `<option value="${p.id}"${sel}>${(p.name || "").replace(/</g, "&lt;")}</option>`
  }).join("")

  const hintImportado = data.importado ? "<p class=\"financeiro-importacao-hint\">Transação importada; você pode editar a descrição para manter organizado (no Brasil o nome na máquina nem sempre é de quem você comprou).</p>" : ""
  openModal(
   "Editar transação",

   `
    ${hintImportado}
    <label>Descrição</label>
    <input id="desc" value="${(data.descricao || "").replace(/"/g, "&quot;")}">

    <label>Tipo</label>
    <select id="tipo">
     <option value="entrada" ${data.tipo === "entrada" ? "selected" : ""}>Entrada</option>
     <option value="saida" ${data.tipo === "saida" ? "selected" : ""}>Saída</option>
    </select>

    <label id="labelCategoriaSaida" class="financeiro-categoria-saida-label">Tipo de saída</label>
    <select id="categoriaSaida">
     <option value="">—</option>
     <option value="funcionario" ${data.categoria_saida === "funcionario" ? "selected" : ""}>Funcionário</option>
     <option value="insumos" ${data.categoria_saida === "insumos" ? "selected" : ""}>Insumos</option>
     <option value="custo_fixo" ${data.categoria_saida === "custo_fixo" ? "selected" : ""}>Custo fixo</option>
     <option value="outro" ${data.categoria_saida === "outro" ? "selected" : ""}>Outro</option>
    </select>

    <label id="labelProc" class="financeiro-proc-label">Procedimento (receita por serviço)</label>
    <select id="procId">${procOptionsEdit}</select>

    <div id="wrapFormaPagamentoEdit" class="financeiro-entrada-extra" style="display:${data.tipo === "entrada" ? "block" : "none"};">
      <label>Forma de pagamento</label>
      <select id="formaPagamentoEdit">
        <option value="">—</option>
        <option value="pix" ${data.forma_pagamento === "pix" ? "selected" : ""}>PIX</option>
        <option value="cartao_credito" ${data.forma_pagamento === "cartao_credito" ? "selected" : ""}>Cartão crédito</option>
        <option value="cartao_debito" ${data.forma_pagamento === "cartao_debito" ? "selected" : ""}>Cartão débito</option>
        <option value="dinheiro" ${data.forma_pagamento === "dinheiro" ? "selected" : ""}>Dinheiro</option>
        <option value="transferencia" ${data.forma_pagamento === "transferencia" ? "selected" : ""}>Transferência</option>
        <option value="boleto" ${data.forma_pagamento === "boleto" ? "selected" : ""}>Boleto</option>
        <option value="outro" ${data.forma_pagamento === "outro" ? "selected" : ""}>Outro</option>
      </select>
      <label>Valor recebido (quanto entrou de fato)</label>
      <input id="valorRecebidoEdit" type="number" step="0.01" value="${data.valor_recebido != null && data.valor_recebido !== "" ? data.valor_recebido : ""}" placeholder="Vazio = mesmo que o valor">
    </div>

    <label>Valor</label>
    <input id="valor" type="number" step="0.01" value="${data.valor}">

    <label>Data</label>
    <input id="data" type="date" value="${data.data || ""}">
   `,

   () => updateTransacao(id)
  )
  document.getElementById("tipo")?.addEventListener("change", () => {
    const wrap = document.getElementById("wrapFormaPagamentoEdit")
    const tipo = document.getElementById("tipo")?.value
    if (wrap) wrap.style.display = tipo === "entrada" ? "block" : "none"
  })

 }catch(err){

  console.error(
   "[FINANCEIRO] erro edit",
   err
  )

  toast("Erro ao abrir edição")
 }
}


/* =====================
   AÇÕES
===================== */

async function createTransacao(){

 const descInput =
  document.getElementById("desc")

 const tipoInput =
  document.getElementById("tipo")

 const valorInput =
  document.getElementById("valor")

 const dataInput =
  document.getElementById("data")

 try{

  const { data:{ user }} =
   await supabase.auth.getUser()

 if(!user){
 toast("Sessão expirada")
 window.location.href="/index.html"
 return
}


  const procIdEl = document.getElementById("procId")
  const categoriaSaidaEl = document.getElementById("categoriaSaida")
  const formaPagamentoEl = document.getElementById("formaPagamento")
  const valorRecebidoEl = document.getElementById("valorRecebido")
  const procedureId = (tipoInput.value === "entrada" && procIdEl && procIdEl.value) ? procIdEl.value : null
  let categoriaSaida = (tipoInput.value === "saida" && categoriaSaidaEl && categoriaSaidaEl.value) ? categoriaSaidaEl.value : null
  if (tipoInput.value === "saida" && !categoriaSaida && descInput.value)
    categoriaSaida = inferirCategoriaSaida(descInput.value) || null
  const payload = {
    descricao: descInput.value,
    tipo: tipoInput.value,
    valor: valorInput.value,
    data: dataInput.value,
    user_id: user.id,
    org_id: getActiveOrg()
  }
  if (procedureId) payload.procedure_id = procedureId
  if (categoriaSaida) payload.categoria_saida = categoriaSaida
  if (tipoInput.value === "entrada") {
    if (formaPagamentoEl?.value) payload.forma_pagamento = formaPagamentoEl.value
    const vr = valorRecebidoEl?.value?.trim()
    if (vr !== "" && vr != null) payload.valor_recebido = Number(vr)
  }

  const { error } =
   await supabase
 .from("financeiro")
 .insert(payload)

  if(error) throw error

  await audit({
    action: "financeiro.create",
    tableName: "financeiro",
    recordId: null,
    permissionUsed: "financeiro:manage",
    metadata: { valor: valorInput.value }
  })

  closeModal()
  renderFinanceiro()
  toast("Transação criada!")

 }catch(err){

  console.error(
   "[FINANCEIRO] erro create",
   err
  )

  toast("Erro ao criar transação")
 }
}


async function updateTransacao(id){

 const descInput =
  document.getElementById("desc")

 const tipoInput =
  document.getElementById("tipo")

 const valorInput =
  document.getElementById("valor")

 const dataInput =
  document.getElementById("data")

 try{

  const procIdEl = document.getElementById("procId")
  const categoriaSaidaEl = document.getElementById("categoriaSaida")
  const formaPagamentoEditEl = document.getElementById("formaPagamentoEdit")
  const valorRecebidoEditEl = document.getElementById("valorRecebidoEdit")
  const procedureId = (tipoInput.value === "entrada" && procIdEl && procIdEl.value) ? procIdEl.value : null
  const categoriaSaida = (tipoInput.value === "saida" && categoriaSaidaEl && categoriaSaidaEl.value) ? categoriaSaidaEl.value : null
  const payload = {
   descricao: descInput.value,
   tipo: tipoInput.value,
   valor: valorInput.value,
   data: dataInput.value
  }
  if (procedureId !== undefined) payload.procedure_id = procedureId || null
  payload.categoria_saida = (tipoInput.value === "saida" && categoriaSaida) ? categoriaSaida : null
  if (tipoInput.value === "entrada") {
    payload.forma_pagamento = formaPagamentoEditEl?.value || null
    const vr = valorRecebidoEditEl?.value?.trim()
    payload.valor_recebido = (vr !== "" && vr != null) ? Number(vr) : null
  } else {
    payload.forma_pagamento = null
    payload.valor_recebido = null
  }

  const { error } =
   await withOrg(
    supabase
     .from("financeiro")
     .update(payload)
     .eq("id",id)
  )


  if(error) throw error

  await audit({
    action: "financeiro.update",
    tableName: "financeiro",
    recordId: id,
    permissionUsed: "financeiro:manage",
    metadata: { id }
  })

  closeModal()
  renderFinanceiro()
  toast("Transação atualizada!")

 }catch(err){

  console.error(
   "[FINANCEIRO] erro update",
   err
  )

  toast("Erro ao atualizar")
 }
}


/* =====================
   EVENTS
===================== */

function bindEditEvents(){

 document
  .querySelectorAll(
   ".item-card"
  )
  .forEach(card=>{
   card.onclick =
    () =>
     openEditModal(
      card.dataset.id
     )
  })
}


/* =====================
   ÁREA MASTER (contas a pagar, fluxo, reserva, metas, participação)
===================== */

async function renderMasterSection(data, totalEntradas, totalSaidas, saldo) {
  const listaContas = document.getElementById("listaContasAPagar")
  const fluxoResumo = document.getElementById("fluxoCaixaResumo")
  const listaMetas = document.getElementById("listaFinanceiroMetas")
  const listaPart = document.getElementById("listaParticipacaoLucros")
  if (!listaContas && !fluxoResumo && !listaMetas && !listaPart) return

  let contas = []
  let metas = []
  let participacao = []
  try {
    contas = await listContasAPagar()
  } catch (_) {}
  try {
    metas = await listFinanceiroMetas()
  } catch (_) {}
  try {
    participacao = await listParticipacaoLucros()
  } catch (_) {}

  const hoje = new Date().toISOString().slice(0, 10)
  const pendentes = (contas || []).filter((c) => c.status === "pendente")
  const totalPendente = pendentes.reduce((s, c) => s + (Number(c.valor) || 0), 0)
  const projecao = saldo - totalPendente

  if (listaContas) {
    if (!contas || contas.length === 0) {
      listaContas.innerHTML = "<p class=\"financeiro-master-empty\">Nenhuma conta a pagar. Clique em \"+ Nova conta\".</p>"
    } else {
      listaContas.innerHTML = (contas || []).map((c) => {
        const venc = c.data_vencimento || ""
        const atrasada = venc && venc < hoje && c.status === "pendente"
        const cls = atrasada ? "conta-a-pagar-card atrasada" : c.status === "pago" ? "conta-a-pagar-card paga" : "conta-a-pagar-card"
        return `
          <div class="${cls}" data-id="${c.id}">
            <div>
              <b>${escapeHtml(c.descricao || "")}</b>
              <br><span class="item-card__categoria">Venc: ${venc} · R$ ${Number(c.valor).toFixed(2).replace(".", ",")} · ${c.status}</span>
            </div>
            <div>
              <button type="button" class="btn-secondary btn-edit-conta" data-id="${c.id}">Editar</button>
              <button type="button" class="btn-secondary btn-delete-conta" data-id="${c.id}">Excluir</button>
            </div>
          </div>
        `
      }).join("")
      listaContas.querySelectorAll(".btn-edit-conta").forEach((btn) => {
        btn.onclick = (e) => { e.stopPropagation(); openEditContaModal(btn.dataset.id) }
      })
      listaContas.querySelectorAll(".btn-delete-conta").forEach((btn) => {
        btn.onclick = (e) => { e.stopPropagation(); confirmDeleteConta(btn.dataset.id) }
      })
    }
  }

  if (fluxoResumo) {
    fluxoResumo.innerHTML = `
      <div class="fluxo-caixa-card">
        <span class="fluxo-caixa-card__label">Saldo atual</span>
        <span class="fluxo-caixa-card__valor">R$ ${(saldo || 0).toFixed(2).replace(".", ",")}</span>
      </div>
      <div class="fluxo-caixa-card">
        <span class="fluxo-caixa-card__label">Contas a pagar (pendentes)</span>
        <span class="fluxo-caixa-card__valor">R$ ${totalPendente.toFixed(2).replace(".", ",")}</span>
      </div>
      <div class="fluxo-caixa-card">
        <span class="fluxo-caixa-card__label">Projeção (saldo − pendentes)</span>
        <span class="fluxo-caixa-card__valor">R$ ${projecao.toFixed(2).replace(".", ",")}</span>
      </div>
    `
  }

  const labelsMeta = { reserva_emergencia: "Reserva de emergência", receita_mensal: "Receita mensal", lucro_mensal: "Lucro mensal", outro: "Outro" }
  if (listaMetas) {
    if (!metas || metas.length === 0) {
      listaMetas.innerHTML = "<p class=\"financeiro-master-empty\">Nenhuma meta. Clique em \"+ Nova meta\" (ex.: reserva de emergência).</p>"
    } else {
      listaMetas.innerHTML = (metas || []).map((m) => `
        <div class="meta-card" data-id="${m.id}">
          <div>
            <b>${escapeHtml(labelsMeta[m.tipo] || m.tipo)}</b>
            <br><span class="item-card__categoria">R$ ${Number(m.valor_meta).toFixed(2).replace(".", ",")}${m.periodo_ref ? " · " + m.periodo_ref : ""}</span>
          </div>
          <div>
            <button type="button" class="btn-secondary btn-edit-meta" data-id="${m.id}">Editar</button>
            <button type="button" class="btn-secondary btn-delete-meta" data-id="${m.id}">Excluir</button>
          </div>
        </div>
      `).join("")
      listaMetas.querySelectorAll(".btn-edit-meta").forEach((btn) => {
        btn.onclick = (e) => { e.stopPropagation(); openEditMetaModal(btn.dataset.id) }
      })
      listaMetas.querySelectorAll(".btn-delete-meta").forEach((btn) => {
        btn.onclick = (e) => { e.stopPropagation(); confirmDeleteMeta(btn.dataset.id) }
      })
    }
  }

  if (listaPart) {
    if (!participacao || participacao.length === 0) {
      listaPart.innerHTML = "<p class=\"financeiro-master-empty\">Nenhuma participação nos lucros. Clique em \"+ Nova participação\" (master ou sócio).</p>"
    } else {
      listaPart.innerHTML = (participacao || []).map((p) => `
        <div class="participacao-card" data-id="${p.id}">
          <div>
            <b>${escapeHtml(p.nome_label || "")}</b> (${p.tipo})
            <br><span class="item-card__categoria">${p.percentual != null ? p.percentual + "%" : "R$ " + Number(p.valor_fixo || 0).toFixed(2).replace(".", ",")} · ${p.periodo_ref}${p.valor_calculado != null ? " · R$ " + Number(p.valor_calculado).toFixed(2).replace(".", ",") : ""}</span>
          </div>
          <div>
            <button type="button" class="btn-secondary btn-edit-participacao" data-id="${p.id}">Editar</button>
            <button type="button" class="btn-secondary btn-delete-participacao" data-id="${p.id}">Excluir</button>
          </div>
        </div>
      `).join("")
      listaPart.querySelectorAll(".btn-edit-participacao").forEach((btn) => {
        btn.onclick = (e) => { e.stopPropagation(); openEditParticipacaoModal(btn.dataset.id) }
      })
      listaPart.querySelectorAll(".btn-delete-participacao").forEach((btn) => {
        btn.onclick = (e) => { e.stopPropagation(); confirmDeleteParticipacao(btn.dataset.id) }
      })
    }
  }
}

function bindMasterUI() {
  const tabs = document.querySelectorAll(".financeiro-master-tab")
  const panels = document.querySelectorAll(".financeiro-master-panel")
  tabs.forEach((tab) => {
    tab.onclick = () => {
      const t = tab.dataset.tab
      tabs.forEach((x) => x.classList.remove("is-active"))
      panels.forEach((p) => {
        p.classList.toggle("hidden", p.dataset.tab !== t)
      })
      tab.classList.add("is-active")
    }
  })

  const btnConta = document.getElementById("btnNovaContaAPagar")
  if (btnConta) btnConta.onclick = () => openNovaContaModal()
  const btnMeta = document.getElementById("btnNovaMeta")
  if (btnMeta) btnMeta.onclick = () => openNovaMetaModal()
  const btnPart = document.getElementById("btnNovaParticipacao")
  if (btnPart) btnPart.onclick = () => openNovaParticipacaoModal()
}

function openNovaContaModal() {
  const y = new Date().toISOString().slice(0, 10)
  openModal(
    "Nova conta a pagar",
    `
    <label>Descrição</label>
    <input type="text" id="contaDesc" placeholder="Ex: Aluguel, Fornecedor" required>
    <label>Valor (R$)</label>
    <input type="number" id="contaValor" step="0.01" min="0.01" required>
    <label>Data de vencimento</label>
    <input type="date" id="contaVenc" value="${y}" required>
    <label>Categoria (opcional)</label>
    <input type="text" id="contaCategoria" placeholder="Ex: Custo fixo">
    `,
    submitNovaConta
  )
}

async function submitNovaConta() {
  const desc = document.getElementById("contaDesc")?.value?.trim()
  const valor = document.getElementById("contaValor")?.value
  const venc = document.getElementById("contaVenc")?.value
  const cat = document.getElementById("contaCategoria")?.value?.trim()
  if (!desc || !valor || !venc) { toast("Preencha descrição, valor e vencimento"); return }
  try {
    await createContaAPagar({ descricao: desc, valor, dataVencimento: venc, categoria: cat || null })
    closeModal()
    renderFinanceiro()
    toast("Conta a pagar criada")
  } catch (e) {
    toast(e.message || "Erro ao criar conta")
  }
}

async function openEditContaModal(id) {
  const contas = await listContasAPagar()
  const c = contas.find((x) => x.id === id)
  if (!c) { toast("Conta não encontrada"); return }
  openModal(
    "Editar conta a pagar",
    `
    <label>Descrição</label>
    <input type="text" id="contaDesc" value="${escapeHtml(c.descricao || "")}">
    <label>Valor (R$)</label>
    <input type="number" id="contaValor" step="0.01" value="${c.valor}">
    <label>Data de vencimento</label>
    <input type="date" id="contaVenc" value="${c.data_vencimento || ""}">
    <label>Data pagamento (deixe vazio se pendente)</label>
    <input type="date" id="contaPago" value="${c.data_pago || ""}">
    <label>Status</label>
    <select id="contaStatus">
      <option value="pendente" ${c.status === "pendente" ? "selected" : ""}>Pendente</option>
      <option value="pago" ${c.status === "pago" ? "selected" : ""}>Pago</option>
      <option value="cancelado" ${c.status === "cancelado" ? "selected" : ""}>Cancelado</option>
    </select>
    <p class="client-hint" style="margin-top:0.35rem;">Ao marcar como <strong>Pago</strong>, uma saída será registrada no financeiro (valor e data de pagamento).</p>
    <label>Categoria</label>
    <input type="text" id="contaCategoria" value="${escapeHtml(c.categoria || "")}">
    <input type="hidden" id="contaId" value="${c.id}">
    `,
    () => submitEditConta(id)
  )
}

async function submitEditConta(id) {
  const desc = document.getElementById("contaDesc")?.value?.trim()
  const valor = document.getElementById("contaValor")?.value
  const venc = document.getElementById("contaVenc")?.value
  const pago = document.getElementById("contaPago")?.value?.trim()
  const status = document.getElementById("contaStatus")?.value
  const cat = document.getElementById("contaCategoria")?.value?.trim()
  try {
    const contas = await listContasAPagar()
    const contaAntes = contas.find((x) => x.id === id)
    const eraPagoAntes = contaAntes?.status === "pago"

    await updateContaAPagar(id, { descricao: desc, valor, dataVencimento: venc, dataPago: pago || null, status, categoria: cat || null })

    if (!eraPagoAntes && status === "pago") {
      const dataPago = pago || new Date().toISOString().split("T")[0]
      const categoriaSaida = cat || inferirCategoriaSaida(desc || "") || null
      const { data: { user } } = await supabase.auth.getUser()
      const payload = {
        descricao: (desc || "Conta a pagar").trim(),
        tipo: "saida",
        valor: Number(valor) || 0,
        data: dataPago,
        user_id: user?.id ?? null,
        org_id: getActiveOrg(),
      }
      if (categoriaSaida) payload.categoria_saida = categoriaSaida
      const { error } = await supabase.from("financeiro").insert(payload)
      if (error) {
        console.warn("[FINANCEIRO] Falha ao criar saída da conta paga:", error)
        toast("Conta marcada como paga, mas a saída no financeiro não foi registrada.")
      }
    }
    closeModal()
    renderFinanceiro()
    toast("Conta atualizada")
  } catch (e) {
    toast(e.message || "Erro ao atualizar")
  }
}

function confirmDeleteConta(id) {
  openConfirmModal("Excluir conta a pagar?", "Excluir esta conta a pagar?", async () => {
    try {
      await deleteContaAPagar(id)
      renderFinanceiro()
      toast("Conta excluída")
    } catch (e) {
      toast(e.message || "Erro ao excluir")
    }
  })
}

function openNovaMetaModal() {
  const opts = TIPOS_META.map((t) => {
    const labels = { reserva_emergencia: "Reserva de emergência", receita_mensal: "Receita mensal", lucro_mensal: "Lucro mensal", outro: "Outro" }
    return `<option value="${t}">${labels[t] || t}</option>`
  }).join("")
  openModal(
    "Nova meta financeira",
    `
    <label>Tipo</label>
    <select id="metaTipo">${opts}</select>
    <label>Valor da meta (R$)</label>
    <input type="number" id="metaValor" step="0.01" min="0" required>
    <label>Período (opcional, ex: 2025-01)</label>
    <input type="text" id="metaPeriodo" placeholder="YYYY-MM">
    <label>Observação</label>
    <input type="text" id="metaObs" placeholder="Opcional">
    `,
    submitNovaMeta
  )
}

async function submitNovaMeta() {
  const tipo = document.getElementById("metaTipo")?.value
  const valor = document.getElementById("metaValor")?.value
  const periodo = document.getElementById("metaPeriodo")?.value?.trim()
  const obs = document.getElementById("metaObs")?.value?.trim()
  if (!tipo || valor === "" || valor == null) { toast("Preencha tipo e valor"); return }
  try {
    await createFinanceiroMeta({ tipo, valorMeta: valor, periodoRef: periodo || null, observacao: obs || null })
    closeModal()
    renderFinanceiro()
    toast("Meta criada")
  } catch (e) {
    toast(e.message || "Erro ao criar meta")
  }
}

async function openEditMetaModal(id) {
  const metas = await listFinanceiroMetas()
  const m = metas.find((x) => x.id === id)
  if (!m) { toast("Meta não encontrada"); return }
  const opts = TIPOS_META.map((t) => {
    const labels = { reserva_emergencia: "Reserva de emergência", receita_mensal: "Receita mensal", lucro_mensal: "Lucro mensal", outro: "Outro" }
    return `<option value="${t}" ${m.tipo === t ? "selected" : ""}>${labels[t] || t}</option>`
  }).join("")
  openModal(
    "Editar meta",
    `
    <label>Tipo</label>
    <select id="metaTipo">${opts}</select>
    <label>Valor da meta (R$)</label>
    <input type="number" id="metaValor" step="0.01" value="${m.valor_meta}">
    <label>Período</label>
    <input type="text" id="metaPeriodo" value="${escapeHtml(m.periodo_ref || "")}">
    <label>Observação</label>
    <input type="text" id="metaObs" value="${escapeHtml(m.observacao || "")}">
    <input type="hidden" id="metaId" value="${m.id}">
    `,
    () => submitEditMeta(id)
  )
}

async function submitEditMeta(id) {
  const tipo = document.getElementById("metaTipo")?.value
  const valor = document.getElementById("metaValor")?.value
  const periodo = document.getElementById("metaPeriodo")?.value?.trim()
  const obs = document.getElementById("metaObs")?.value?.trim()
  try {
    await updateFinanceiroMeta(id, { tipo, valorMeta: valor, periodoRef: periodo || null, observacao: obs || null })
    closeModal()
    renderFinanceiro()
    toast("Meta atualizada")
  } catch (e) {
    toast(e.message || "Erro ao atualizar")
  }
}

function confirmDeleteMeta(id) {
  openConfirmModal("Excluir meta?", "Excluir esta meta?", async () => {
    try {
      await deleteFinanceiroMeta(id)
      renderFinanceiro()
      toast("Meta excluída")
    } catch (e) {
      toast(e.message || "Erro ao excluir")
    }
  })
}

function openNovaParticipacaoModal() {
  const periodo = new Date().toISOString().slice(0, 7)
  openModal(
    "Nova participação nos lucros",
    `
    <label>Tipo</label>
    <select id="partTipo">
      <option value="master">Master</option>
      <option value="socio">Sócio</option>
    </select>
    <label>Nome / rótulo</label>
    <input type="text" id="partNome" placeholder="Ex: João (sócio)" required>
    <label>Percentual (%) — ou deixe zero e use valor fixo</label>
    <input type="number" id="partPercentual" step="0.01" min="0" max="100" value="0" placeholder="0">
    <label>Valor fixo (R$) — se não usar percentual</label>
    <input type="number" id="partFixo" step="0.01" min="0" value="" placeholder="Opcional">
    <label>Período de referência (ex: 2025-01)</label>
    <input type="text" id="partPeriodo" value="${periodo}" placeholder="YYYY-MM">
    `,
    submitNovaParticipacao
  )
}

async function submitNovaParticipacao() {
  const tipo = document.getElementById("partTipo")?.value
  const nome = document.getElementById("partNome")?.value?.trim()
  const pct = document.getElementById("partPercentual")?.value
  const fixo = document.getElementById("partFixo")?.value
  const periodo = document.getElementById("partPeriodo")?.value?.trim()
  if (!nome || !periodo) { toast("Preencha nome e período"); return }
  if ((!pct || Number(pct) === 0) && (!fixo || Number(fixo) === 0)) { toast("Informe percentual ou valor fixo"); return }
  try {
    await createParticipacaoLucros({ tipo, nomeLabel: nome, percentual: pct || null, valorFixo: fixo || null, periodoRef: periodo })
    closeModal()
    renderFinanceiro()
    toast("Participação criada")
  } catch (e) {
    toast(e.message || "Erro ao criar participação")
  }
}

async function openEditParticipacaoModal(id) {
  const list = await listParticipacaoLucros()
  const p = list.find((x) => x.id === id)
  if (!p) { toast("Participação não encontrada"); return }
  openModal(
    "Editar participação",
    `
    <label>Tipo</label>
    <select id="partTipo">
      <option value="master" ${p.tipo === "master" ? "selected" : ""}>Master</option>
      <option value="socio" ${p.tipo === "socio" ? "selected" : ""}>Sócio</option>
    </select>
    <label>Nome / rótulo</label>
    <input type="text" id="partNome" value="${escapeHtml(p.nome_label || "")}">
    <label>Percentual (%)</label>
    <input type="number" id="partPercentual" step="0.01" value="${p.percentual ?? ""}">
    <label>Valor fixo (R$)</label>
    <input type="number" id="partFixo" step="0.01" value="${p.valor_fixo ?? ""}">
    <label>Período</label>
    <input type="text" id="partPeriodo" value="${escapeHtml(p.periodo_ref || "")}">
    <label>Valor calculado (R$) — preenchido ao fechar período</label>
    <input type="number" id="partCalculado" step="0.01" value="${p.valor_calculado ?? ""}">
    <input type="hidden" id="partId" value="${p.id}">
    `,
    () => submitEditParticipacao(id)
  )
}

async function submitEditParticipacao(id) {
  const tipo = document.getElementById("partTipo")?.value
  const nome = document.getElementById("partNome")?.value?.trim()
  const pct = document.getElementById("partPercentual")?.value
  const fixo = document.getElementById("partFixo")?.value
  const periodo = document.getElementById("partPeriodo")?.value?.trim()
  const calc = document.getElementById("partCalculado")?.value
  try {
    await updateParticipacaoLucros(id, {
      nomeLabel: nome,
      percentual: pct === "" ? null : pct,
      valorFixo: fixo === "" ? null : fixo,
      valorCalculado: calc === "" ? null : calc,
      periodoRef: periodo,
    })
    closeModal()
    renderFinanceiro()
    toast("Participação atualizada")
  } catch (e) {
    toast(e.message || "Erro ao atualizar")
  }
}

function confirmDeleteParticipacao(id) {
  openConfirmModal("Excluir participação?", "Excluir esta participação?", async () => {
    try {
      await deleteParticipacaoLucros(id)
      renderFinanceiro()
      toast("Participação excluída")
    } catch (e) {
      toast(e.message || "Erro ao excluir")
    }
  })
}

/* =====================
   IMPORTAÇÃO DE EXTRATO BANCÁRIO
===================== */

let _previewImportacao = []

function openImportarExtratoModal() {
  openModal(
    "Importar extrato (CSV)",
    `
    <p class="financeiro-importacao-hint">Envie um CSV do seu banco (data, valor, descrição). Não exige categoria — você pode revisar depois. Transações importadas aparecem com cor diferente.</p>
    <label>Arquivo CSV do extrato</label>
    <input type="file" id="importacaoArquivo" accept=".csv,.txt,text/csv,text/plain">
    <label>Nome da conta (opcional)</label>
    <input type="text" id="importacaoConta" placeholder="Ex: Conta Corrente, Cartão Nubank">
    <div id="importacaoPreviewWrap" class="financeiro-importacao-preview hidden" aria-live="polite"></div>
    <p id="importacaoErro" class="financeiro-importacao-erro hidden"></p>
    `,
    submitImportacaoExtrato
  )
  const fileEl = document.getElementById("importacaoArquivo")
  const contaEl = document.getElementById("importacaoConta")
  const previewWrap = document.getElementById("importacaoPreviewWrap")
  const erroEl = document.getElementById("importacaoErro")
  if (fileEl) {
    fileEl.value = ""
    fileEl.onchange = () => {
      _previewImportacao = []
      previewWrap?.classList.add("hidden")
      erroEl?.classList.add("hidden")
      if (!fileEl.files?.length) return
      const file = fileEl.files[0]
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const texto = reader.result
          const conta = contaEl?.value?.trim() || ""
          _previewImportacao = parseCSVExtrato(texto, conta)
          if (_previewImportacao.length === 0) {
            erroEl.textContent = "Nenhuma transação encontrada no CSV. Verifique o formato (data, valor, descrição)."
            erroEl.classList.remove("hidden")
          } else {
            previewWrap.classList.remove("hidden")
            previewWrap.innerHTML = `
              <p><strong>${_previewImportacao.length}</strong> transação(ões) detectada(s).</p>
              <div class="financeiro-importacao-preview-table-wrap">
                <table class="financeiro-importacao-preview-table">
                  <thead><tr><th>Data</th><th>Tipo</th><th>Valor</th><th>Descrição</th></tr></thead>
                  <tbody>
                    ${_previewImportacao.slice(0, 10).map((t) => `
                      <tr>
                        <td>${escapeHtml(t.data)}</td>
                        <td>${t.tipo}</td>
                        <td>R$ ${Number(t.valor).toFixed(2).replace(".", ",")}</td>
                        <td>${escapeHtml((t.descricao || "").slice(0, 40))}${(t.descricao || "").length > 40 ? "…" : ""}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
                ${_previewImportacao.length > 10 ? `<p>… e mais ${_previewImportacao.length - 10}.</p>` : ""}
              </div>
            `
          }
        } catch (e) {
          erroEl.textContent = e.message || "Erro ao ler o arquivo."
          erroEl.classList.remove("hidden")
        }
      }
      reader.readAsText(file, "UTF-8")
    }
  }
}

async function submitImportacaoExtrato() {
  if (_previewImportacao.length === 0) {
    toast("Selecione um arquivo CSV com transações.")
    return
  }
  try {
    const contaEl = document.getElementById("importacaoConta")
    const conta = contaEl?.value?.trim() || ""
    _previewImportacao.forEach((t) => { t.conta_origem = t.conta_origem || conta || null })
    const { inseridas } = await inserirTransacoesImportadas(_previewImportacao, "csv")
    closeModal()
    renderFinanceiro()
    toast(` ${inseridas} transação(ões) importada(s). Aparecem em cor diferente; você pode editar a descrição quando quiser.`)
  } catch (e) {
    toast(e.message || "Erro ao importar.")
  }
}

/* =====================
   CONTAS VINCULADAS (TEMPO REAL)
===================== */

async function renderContasVinculadas() {
  const listEl = document.getElementById("listaContasVinculadas")
  if (!listEl) return
  try {
    const contas = await listContasVinculadas()
    if (!contas || contas.length === 0) {
      listEl.innerHTML = "<p class=\"financeiro-contas-vinculadas-empty\">Nenhuma conta ou cartão vinculado. Clique em \"Vincular cartão ou conta\" para receber transações em tempo real.</p>"
    } else {
      listEl.innerHTML = contas.map((c) => {
        const lastSync = c.last_sync_at ? new Date(c.last_sync_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"
        const tipoLabel = c.tipo === "cartao" ? "Cartão" : "Conta"
        const statusClass = c.status === "active" ? "active" : "revoked"
        return `
          <div class="conta-vinculada-card conta-vinculada-card--${statusClass}" data-id="${c.id}">
            <div>
              <b>${escapeHtml(c.nome_exibicao || "")}</b> <span class="conta-vinculada-tipo">${tipoLabel}</span>
              <br><span class="conta-vinculada-meta">Última sincronização: ${lastSync} · ${c.provider === "webhook" ? "Webhook" : escapeHtml(c.provider)}</span>
            </div>
            <div>
              ${c.status === "active" ? `<button type="button" class="btn-secondary btn-desvincular" data-id="${c.id}">Desvincular</button>` : "<span class=\"conta-vinculada-revoked\">Desvinculada</span>"}
            </div>
          </div>
        `
      }).join("")
      listEl.querySelectorAll(".btn-desvincular").forEach((btn) => {
        btn.onclick = (e) => { e.stopPropagation(); confirmDesvincularConta(btn.dataset.id) }
      })
    }
  } catch (e) {
    listEl.innerHTML = "<p class=\"financeiro-contas-vinculadas-empty\">Erro ao carregar contas vinculadas.</p>"
  }
}

function openVincularContaModal() {
  openModal(
    "Vincular cartão ou conta (tempo real)",
    `
    <p class="financeiro-importacao-hint">Vincule seu cartão ou conta para receber transações em tempo real. As transações entram automaticamente no Financeiro (em cor diferente) e você pode revisar a descrição depois.</p>
    <p class="financeiro-importacao-hint"><strong>Opção 1 (em breve):</strong> Conectar com um clique via Open Finance (Belvo/Pluggy).</p>
    <p class="financeiro-importacao-hint"><strong>Opção 2 (agora):</strong> Crie um vínculo e configure seu conector/agregador para enviar transações ao nosso webhook.</p>
    <label>Nome (ex: Cartão Nubank, Conta Corrente)</label>
    <input type="text" id="vinculadaNome" placeholder="Ex: Cartão Nubank" required>
    <label>Tipo</label>
    <select id="vinculadaTipo">
      <option value="conta">Conta</option>
      <option value="cartao">Cartão</option>
    </select>
    `,
    submitVincularConta
  )
}

async function submitVincularConta() {
  const nomeEl = document.getElementById("vinculadaNome")
  const tipoEl = document.getElementById("vinculadaTipo")
  const nome = (nomeEl?.value || "").trim()
  if (!nome) {
    toast("Informe o nome da conta ou cartão.")
    return
  }
  try {
    const conta = await createContaVinculada({
      nomeExibicao: nome,
      tipo: tipoEl?.value || "conta",
    })
    const webhookUrl = getWebhookTransacoesUrl()
    const accountId = conta.external_account_id
    closeModal()
    openModal(
      "Conta vinculada — receber em tempo real",
      `
      <p class="financeiro-importacao-hint">Conta criada. Para as transações chegarem em tempo real, seu conector (ou agregador Open Finance) deve enviar:</p>
      <p><strong>URL (POST):</strong><br><code class="financeiro-webhook-code">${escapeHtml(webhookUrl)}</code></p>
      <p><strong>Header:</strong> <code>X-Webhook-Secret</code> = (configure no servidor, mesma variável que no backend)</p>
      <p><strong>Body (JSON):</strong></p>
      <pre class="financeiro-webhook-pre">{
  "account_id": "${escapeHtml(accountId)}",
  "transactions": [
    { "date": "2026-01-29", "amount": -50.00, "description": "Compra XYZ", "type": "debit" }
  ]
}</pre>
      <p><strong>Guarde o account_id:</strong><br><code class="financeiro-webhook-code">${escapeHtml(accountId)}</code></p>
      <button type="button" id="btnCopyAccountId" class="btn-secondary">Copiar account_id</button>
      `,
      () => closeModal()
    )
    document.getElementById("btnCopyAccountId")?.addEventListener("click", () => {
      navigator.clipboard.writeText(accountId).then(() => toast("account_id copiado."))
    })
    renderFinanceiro()
    toast("Conta vinculada. Configure o webhook para receber transações em tempo real.")
  } catch (e) {
    toast(e.message || "Erro ao vincular.")
  }
}

function confirmDesvincularConta(id) {
  openConfirmModal("Desvincular conta?", "As transações já importadas permanecem no Financeiro; apenas não virão novas transações em tempo real.", async () => {
    try {
      await desvincularConta(id)
      renderFinanceiro()
      toast("Conta desvinculada.")
    } catch (e) {
      toast(e.message || "Erro ao desvincular.")
    }
  })
}

async function exportarPdf(){

 try{

  const data = await getFinanceiro()

  gerarPdf(data || [])

 await audit({
    action: "financeiro.export",
    tableName: "financeiro",
    permissionUsed: "financeiro:export",
    metadata: {
      total_registros: data?.length || 0,
      formato: "pdf"
    }
  })

 }catch(err){

  console.error(
   "[FINANCEIRO] erro PDF",
   err
  )

  toast("Erro ao gerar PDF")
 }
}
