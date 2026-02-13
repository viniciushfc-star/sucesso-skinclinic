/**
 * Estoque — entrada por OCR, importar nota, entrada manual.
 * Canon: referência inteligente; OCR sugere, não decide; entrada facilitada.
 */

import { lerNota } from "../services/ocr.service.js"
import { listEntradas, createEntrada, getResumoPorProduto, getAcuraciaEstoque, registrarConsumoReal } from "../services/estoque-entradas.service.js"
import { analisarEstoque } from "../services/estoque.service.js"
import { supabase } from "../core/supabase.js"
import { getActiveOrg } from "../core/org.js"
import { toast } from "../ui/toast.js"
import { openModal, closeModal } from "../ui/modal.js"
import { createAvaliacao } from "../services/produto-avaliacoes.service.js"

export async function init() {
  bindUI()
  await renderList()
  await renderResumo()
  await renderAcuracia()
}

function bindUI() {
  const btnOCR = document.getElementById("btnEstoqueEntradaOCR")
  const btnImportar = document.getElementById("btnEstoqueImportarNota")
  const btnManual = document.getElementById("btnEstoqueEntradaManual")

  if (btnOCR) btnOCR.onclick = () => openEntradaOCR()
  if (btnImportar) btnImportar.onclick = () => toast("Importar XML em breve.")
  if (btnManual) btnManual.onclick = () => openEntradaManual()

  const periodoAcuracia = document.getElementById("estoqueAcuraciaPeriodo")
  if (periodoAcuracia) periodoAcuracia.addEventListener("change", () => renderAcuracia())
  const btnRegistrarReal = document.getElementById("btnEstoqueRegistrarReal")
  if (btnRegistrarReal) btnRegistrarReal.addEventListener("click", () => openModalRegistrarConsumoReal())

  const btnAnalisar = document.getElementById("btnAnalisarEstoque")
  const resultadoEstoque = document.getElementById("resultadoEstoque")
  if (btnAnalisar && resultadoEstoque) {
    btnAnalisar.onclick = async () => {
      try {
        const resumo = await getResumoPorProduto()
        resultadoEstoque.textContent = "Analisando…"
        resultadoEstoque.classList.remove("hidden")
        const res = await analisarEstoque({ estoque: resumo, consumo: [] })
        resultadoEstoque.textContent = res.content ?? res.message ?? JSON.stringify(res)
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          try {
            await supabase.from("sugestoes_estoque").insert({
              user_id: user.id,
              org_id: getActiveOrg() || null,
              sugestao: resultadoEstoque.textContent,
              prioridade: "alta"
            })
          } catch (_) {}
        }
      } catch (err) {
        console.error("[ESTOQUE analisar]", err)
        toast("Erro ao analisar")
        resultadoEstoque.textContent = "Erro: " + (err.message || "Tente novamente.")
        resultadoEstoque.classList.remove("hidden")
      }
    }
  }
}

async function renderList() {
  const listEl = document.getElementById("listaEstoqueEntradas")
  const emptyEl = document.getElementById("estoqueEmpty")
  if (!listEl) return

  try {
    const items = await listEntradas(50)
    if (items.length === 0) {
      listEl.innerHTML = ""
      if (emptyEl) emptyEl.classList.remove("hidden")
      return
    }
    if (emptyEl) emptyEl.classList.add("hidden")
    listEl.innerHTML = items.map((e) => {
      const data = e.data_entrada ? new Date(e.data_entrada).toLocaleDateString("pt-BR") : "—"
      const total = e.valor_total != null ? `R$ ${Number(e.valor_total).toFixed(2)}` : "—"
      const origem = e.origem === "ocr" ? "Nota fiscal" : e.origem === "xml" ? "XML" : "Manual"
      return `
        <div class="estoque-entrada-card">
          <span class="estoque-entrada-produto">${escapeHtml(e.produto_nome || "")}</span>
          <span class="estoque-entrada-qty">${Number(e.quantidade)}</span>
          <span class="estoque-entrada-total">${total}</span>
          <span class="estoque-entrada-fornecedor">${escapeHtml(e.fornecedor || "—")}</span>
          <span class="estoque-entrada-data">${data}</span>
          <span class="estoque-entrada-origem">${origem}</span>
        </div>
      `
    }).join("")
  } catch (err) {
    console.error("[ESTOQUE]", err)
    toast(err.message || "Erro ao carregar entradas.")
    listEl.innerHTML = ""
    if (emptyEl) emptyEl.classList.remove("hidden")
  }
}

async function renderResumo() {
  const wrap = document.getElementById("estoqueResumoWrap")
  const el = document.getElementById("estoqueResumo")
  if (!el) return

  try {
    const resumo = await getResumoPorProduto()
    if (resumo.length === 0) {
      wrap?.classList.add("hidden")
      return
    }
  wrap?.classList.remove("hidden")
    el.innerHTML = resumo.map((r) => {
      const saldo = Number(r.saldo_estimado).toFixed(2)
      const custo = r.custo_medio != null ? `R$ ${Number(r.custo_medio).toFixed(2)}` : "—"
      const prod = escapeHtml(r.produto_nome)
      return `
        <div class="estoque-resumo-card">
          <span class="estoque-resumo-produto">${prod}</span>
          <span class="estoque-resumo-saldo">Saldo: ${saldo}</span>
          <span class="estoque-resumo-custo">Custo médio: ${custo}</span>
          <button type="button" class="btn-secondary btn-sm estoque-btn-avaliar" data-produto="${escapeAttr(r.produto_nome)}">Avaliar</button>
        </div>
      `
    }).join("")
    document.querySelectorAll(".estoque-btn-avaliar").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nome = btn.getAttribute("data-produto") || ""
        openModalAvaliarProduto(nome)
      })
    })
  } catch (err) {
    wrap?.classList.add("hidden")
  }
}

async function renderAcuracia() {
  const cardEl = document.getElementById("estoqueAcuraciaCard")
  const tabelaEl = document.getElementById("estoqueAcuraciaTabela")
  const periodoEl = document.getElementById("estoqueAcuraciaPeriodo")
  if (!cardEl || !tabelaEl) return
  const dias = Math.max(1, parseInt(periodoEl?.value || "30", 10))
  try {
    const data = await getAcuraciaEstoque(dias)
    const { totalPrevisto, totalReal, acuraciaPct, metaPct, porProduto } = data
    const pct = acuraciaPct != null ? acuraciaPct.toFixed(1) : "—"
    const meta = metaPct
    const ok = acuraciaPct != null && acuraciaPct >= meta
    cardEl.innerHTML = `
      <div class="estoque-acuracia-metricas">
        <div class="estoque-acuracia-metrica">
          <span class="estoque-acuracia-metrica-label">Meta</span>
          <span class="estoque-acuracia-metrica-valor">${meta}%</span>
        </div>
        <div class="estoque-acuracia-metrica">
          <span class="estoque-acuracia-metrica-label">Acurácia atual</span>
          <span class="estoque-acuracia-metrica-valor ${ok ? "estoque-acuracia-ok" : "estoque-acuracia-abaixo"}">${pct}%</span>
        </div>
        <div class="estoque-acuracia-metrica">
          <span class="estoque-acuracia-metrica-label">Consumo previsto (período)</span>
          <span class="estoque-acuracia-metrica-valor">${Number(totalPrevisto).toFixed(2)} un.</span>
        </div>
        <div class="estoque-acuracia-metrica">
          <span class="estoque-acuracia-metrica-label">Consumo real (período)</span>
          <span class="estoque-acuracia-metrica-valor">${Number(totalReal).toFixed(2)} un.</span>
        </div>
      </div>
    `
    if (porProduto.length === 0) {
      tabelaEl.innerHTML = "<p class=\"estoque-acuracia-empty\">Nenhum consumo previsto ou real no período. Registre protocolos aplicados (previsto) e use <strong>Registrar consumo real</strong> para comparar.</p>"
    } else {
      tabelaEl.innerHTML = `
        <table class="estoque-acuracia-table">
          <thead><tr><th>Produto</th><th>Previsto</th><th>Real</th><th>Acurácia</th></tr></thead>
          <tbody>
            ${porProduto.map((p) => {
              const acc = p.acuraciaPct != null ? `${p.acuraciaPct.toFixed(1)}%` : "—"
              const cls = p.acuraciaPct != null && p.acuraciaPct >= meta ? "estoque-acuracia-ok" : "estoque-acuracia-abaixo"
              return `<tr><td>${escapeHtml(p.produto_nome)}</td><td>${Number(p.previsto).toFixed(2)}</td><td>${Number(p.real).toFixed(2)}</td><td class="${cls}">${acc}</td></tr>`
            }).join("")}
          </tbody>
        </table>
      `
    }
  } catch (err) {
    console.error("[ESTOQUE] acurácia", err)
    cardEl.innerHTML = "<p class=\"estoque-acuracia-erro\">Erro ao carregar indicador.</p>"
    tabelaEl.innerHTML = ""
  }
}

function openModalRegistrarConsumoReal() {
  getResumoPorProduto().then((resumo) => {
    const opcoes = (resumo || []).map((r) => `<option value="${escapeAttr(r.produto_nome)}">${escapeHtml(r.produto_nome)}</option>`).join("")
    openModal(
      "Registrar consumo real",
      `
      <p class="form-hint">Informe o que foi realmente consumido (ex.: após contagem). Isso alimenta o indicador de acurácia (previsto vs real).</p>
      <label>Produto</label>
      <input type="text" id="acuraciaRealProduto" list="acuraciaRealProdutoList" placeholder="Nome do produto" required>
      <datalist id="acuraciaRealProdutoList">${opcoes}</datalist>
      <label>Quantidade consumida (real)</label>
      <input type="number" id="acuraciaRealQty" step="0.01" min="0.01" placeholder="Ex.: 2,5" required>
      `,
      async () => {
        const produto = document.getElementById("acuraciaRealProduto")?.value?.trim()
        const qty = document.getElementById("acuraciaRealQty")?.value
        if (!produto) {
          toast("Informe o produto.")
          return
        }
        const num = parseFloat(qty)
        if (isNaN(num) || num <= 0) {
          toast("Informe uma quantidade válida.")
          return
        }
        try {
          await registrarConsumoReal({ produto_nome: produto, quantidade: num })
          toast("Consumo real registrado.")
          closeModal()
          await renderAcuracia()
          await renderResumo()
        } catch (e) {
          toast(e.message || "Erro ao registrar.")
        }
      }
    )
  }).catch(() => {
    openModal(
      "Registrar consumo real",
      `<label>Produto</label><input type="text" id="acuraciaRealProduto" placeholder="Nome do produto" required>
       <label>Quantidade</label><input type="number" id="acuraciaRealQty" step="0.01" min="0.01" required>`,
      async () => {
        const produto = document.getElementById("acuraciaRealProduto")?.value?.trim()
        const qty = document.getElementById("acuraciaRealQty")?.value
        if (!produto || !qty || parseFloat(qty) <= 0) {
          toast("Preencha produto e quantidade.")
          return
        }
        try {
          await registrarConsumoReal({ produto_nome: produto, quantidade: parseFloat(qty) })
          toast("Consumo real registrado.")
          closeModal()
          await renderAcuracia()
          await renderResumo()
        } catch (e) {
          toast(e.message || "Erro ao registrar.")
        }
      }
    )
  })
}

function escapeHtml(s) {
  if (!s) return ""
  const div = document.createElement("div")
  div.textContent = s
  return div.innerHTML
}
function escapeAttr(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
}

function openModalAvaliarProduto(produtoNome) {
  openModal(
    "Avaliar produto",
    `
    <p class="form-hint">Sua avaliação ajuda na decisão de compra e precificação.</p>
    <input type="hidden" id="avaliarProdutoNome" value="${escapeHtml(produtoNome)}">
    <label>Produto</label>
    <p id="avaliarProdutoLabel">${escapeHtml(produtoNome)}</p>
    <label>Nota (1 a 5)</label>
    <select id="avaliarProdutoNota">
      <option value="1">1 — Ruim</option>
      <option value="2">2</option>
      <option value="3" selected>3 — Regular</option>
      <option value="4">4</option>
      <option value="5">5 — Ótimo</option>
    </select>
    <label>Comentário (opcional)</label>
    <textarea id="avaliarProdutoComentario" rows="2" placeholder="Ex.: textura boa, resultado rápido..."></textarea>
    `,
    async () => {
      const nome = document.getElementById("avaliarProdutoNome")?.value?.trim() || produtoNome
      const nota = document.getElementById("avaliarProdutoNota")?.value
      const comentario = document.getElementById("avaliarProdutoComentario")?.value?.trim() || ""
      if (!nome) {
        toast("Produto não informado.")
        return
      }
      try {
        await createAvaliacao({ produto_nome: nome, nota, comentario })
        closeModal()
        toast("Avaliação registrada. Obrigado!")
      } catch (e) {
        toast(e?.message || "Erro ao salvar avaliação.")
      }
    },
    null
  )
}

function openEntradaOCR() {
  const input = document.createElement("input")
  input.type = "file"
  input.accept = "image/*,.pdf"
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    const base64 = await toBase64(file)
    if (!base64) {
      toast("Arquivo inválido.")
      return
    }
    toast("Lendo nota…")
    try {
      const res = await lerNota(base64)
      if (res.error) {
        toast(res.error || "Erro ao ler nota.")
        return
      }
      const { text, parsed } = res
      if (!parsed?.itens?.length) {
        openModal(
          "OCR — texto lido",
          `<p class="estoque-ocr-hint">Nenhum item extraído. Use o texto abaixo para entrada manual ou confira a imagem.</p><pre class="estoque-ocr-texto">${escapeHtml((text || "").slice(0, 2000))}</pre>`,
          () => closeModal(),
          null
        )
        return
      }
      openModalSalvarItensOCR(parsed)
    } catch (e) {
      console.error("[ESTOQUE OCR]", e)
      toast("Erro ao processar nota.")
    }
  }
  input.click()
}

function toBase64(file) {
  return new Promise((resolve) => {
    const r = new FileReader()
    r.onload = () => resolve(typeof r.result === "string" ? r.result.split(",")[1] : null)
    r.onerror = () => resolve(null)
    r.readAsDataURL(file)
  })
}

function openModalSalvarItensOCR(parsed) {
  const fornecedor = parsed.fornecedor || ""
  const data = parsed.data || new Date().toISOString().slice(0, 10)
  const itens = Array.isArray(parsed.itens) ? parsed.itens : []

  const rows = itens.map((item, i) => `
    <div class="estoque-ocr-item" data-i="${i}">
      <input type="text" class="estoque-ocr-produto" value="${escapeHtml(item.produto_nome || "")}" placeholder="Produto">
      <input type="number" step="0.01" min="0" class="estoque-ocr-qty" value="${item.quantidade ?? ""}" placeholder="Qtd">
      <input type="number" step="0.01" min="0" class="estoque-ocr-unit" value="${item.valor_unitario ?? ""}" placeholder="R$ unit">
      <input type="number" step="0.01" min="0" class="estoque-ocr-total" value="${item.valor_total ?? ""}" placeholder="R$ total">
      <input type="text" class="estoque-ocr-lote" value="${escapeHtml(item.lote || "")}" placeholder="Lote">
    </div>
  `).join("")

  const fields = `
    <p class="estoque-ocr-hint">OCR sugere; você pode editar e salvar. Nada bloqueia.</p>
    <label>Fornecedor</label>
    <input type="text" id="estoqueOcrFornecedor" value="${escapeHtml(fornecedor)}" placeholder="Nome do fornecedor">
    <label>Data da nota</label>
    <input type="date" id="estoqueOcrData" value="${data}">
    <label>Itens</label>
    <div class="estoque-ocr-itens">${rows}</div>
  `

  openModal(
    "Nota fiscal — conferir e salvar",
    fields,
    async () => {
      const fornecedorVal = document.getElementById("estoqueOcrFornecedor")?.value?.trim() || null
      const dataVal = document.getElementById("estoqueOcrData")?.value || new Date().toISOString().slice(0, 10)
      const containers = document.querySelectorAll(".estoque-ocr-item")
      let salvos = 0
      for (const div of containers) {
        const produto = div.querySelector(".estoque-ocr-produto")?.value?.trim()
        const qty = div.querySelector(".estoque-ocr-qty")?.value
        const unit = div.querySelector(".estoque-ocr-unit")?.value
        const total = div.querySelector(".estoque-ocr-total")?.value
        const lote = div.querySelector(".estoque-ocr-lote")?.value?.trim()
        if (!produto || !qty || Number(qty) <= 0) continue
        await createEntrada({
          produto_nome: produto,
          quantidade: qty,
          valor_unitario: unit || null,
          valor_total: total || null,
          fornecedor: fornecedorVal,
          data_entrada: dataVal,
          lote: lote || null,
          origem: "ocr"
        })
        salvos++
      }
      closeModal()
      toast(salvos > 0 ? `${salvos} item(ns) salvo(s) no estoque.` : "Nenhum item válido.")
      await renderList()
      await renderResumo()
    },
    null
  )
}

function openEntradaManual() {
  const fields = `
    <p class="estoque-ocr-hint">Poucos campos; entrada rápida. Sem obrigatoriedade excessiva.</p>
    <label>Produto</label>
    <input type="text" id="estoqueManualProduto" placeholder="Nome do produto">
    <label>Quantidade</label>
    <input type="number" id="estoqueManualQty" step="0.01" min="0.01" placeholder="Ex.: 1">
    <label>Valor unitário (opcional)</label>
    <input type="number" id="estoqueManualUnit" step="0.01" min="0" placeholder="R$">
    <label>Valor total (opcional)</label>
    <input type="number" id="estoqueManualTotal" step="0.01" min="0" placeholder="R$">
    <label>Fornecedor (opcional)</label>
    <input type="text" id="estoqueManualFornecedor" placeholder="Nome">
    <label>Data da entrada</label>
    <input type="date" id="estoqueManualData" value="${new Date().toISOString().slice(0, 10)}">
  `

  openModal(
    "Entrada manual",
    fields,
    async () => {
      const produto = document.getElementById("estoqueManualProduto")?.value?.trim()
      const qty = document.getElementById("estoqueManualQty")?.value
      const unit = document.getElementById("estoqueManualUnit")?.value
      const total = document.getElementById("estoqueManualTotal")?.value
      const fornecedor = document.getElementById("estoqueManualFornecedor")?.value?.trim() || null
      const data = document.getElementById("estoqueManualData")?.value || new Date().toISOString().slice(0, 10)
      if (!produto) {
        toast("Informe o produto.")
        return
      }
      if (!qty || Number(qty) <= 0) {
        toast("Informe a quantidade.")
        return
      }
      try {
        await createEntrada({
          produto_nome: produto,
          quantidade: qty,
          valor_unitario: unit || null,
          valor_total: total || null,
          fornecedor,
          data_entrada: data,
          origem: "manual"
        })
        closeModal()
        toast("Entrada salva.")
        await renderList()
        await renderResumo()
      } catch (e) {
        toast(e.message || "Erro ao salvar.")
      }
    },
    null
  )
}
