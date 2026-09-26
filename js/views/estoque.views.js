/**
 * Estoque — entrada por OCR, importar nota, entrada manual.
 * Canon: referência inteligente; OCR sugere, não decide; entrada facilitada.
 */

import { lerNota, parseTextoNota } from "../services/ocr.service.js"
import { listEntradas, createEntrada, getResumoPorProduto, getAcuraciaEstoque, registrarConsumoReal, getProdutosProximosVencer, getProcedimentosQueUsamProduto } from "../services/estoque-entradas.service.js"
import { saveOcrNota } from "../services/ocr-notas.service.js"
import { normalizeParsedNota, parseNfeXml } from "../utils/ocr-nota.js"
import { analisarEstoque } from "../services/estoque.service.js"
import { supabase } from "../core/supabase.js"
import { getActiveOrg } from "../core/org.js"
import { toast } from "../ui/toast.js"
import { openModal, closeModal } from "../ui/modal.js"
import { createAvaliacao } from "../services/produto-avaliacoes.service.js"
import { listProdutosCatalogo, upsertProdutoCatalogo } from "../services/estoque-produtos.service.js"
import { alertaValidade, montarRevenda } from "../utils/estoque-revenda.js"

export async function init() {
  bindUI()
  await renderCatalogo()
  await renderRevenda()
  await renderList()
  await renderResumo()
  await renderProximosVencer()
  await renderAcuracia()
}

function bindUI() {
  const btnOCR = document.getElementById("btnEstoqueEntradaOCR")
  const btnColar = document.getElementById("btnEstoqueColarTexto")
  const btnImportar = document.getElementById("btnEstoqueImportarNota")
  const btnManual = document.getElementById("btnEstoqueEntradaManual")
  const btnCatalogo = document.getElementById("btnEstoqueCadastrarProduto")

  if (btnOCR) btnOCR.onclick = () => openEntradaOCR()
  if (btnColar) btnColar.onclick = () => openColarTextoNota()
  if (btnImportar) {
    btnImportar.disabled = false
    btnImportar.removeAttribute("title")
    btnImportar.onclick = () => openEntradaXml()
  }
  if (btnManual) btnManual.onclick = () => openEntradaManual()
  if (btnCatalogo) btnCatalogo.onclick = () => openCadastroProduto()

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

async function renderCatalogo() {
  const listEl = document.getElementById("estoqueCatalogoList")
  const emptyEl = document.getElementById("estoqueCatalogoEmpty")
  const hintEl = document.getElementById("estoquePortfolioSqlHint")
  if (!listEl) return
  try {
    const items = await listProdutosCatalogo()
    if (hintEl) hintEl.classList.add("hidden")
    if (!items.length) {
      listEl.innerHTML = ""
      if (emptyEl) emptyEl.classList.remove("hidden")
      return
    }
    if (emptyEl) emptyEl.classList.add("hidden")
    listEl.innerHTML = items.map((p) => {
      const alerta = alertaValidade(p.validade_referencia)
      const badge = alerta ? `<span class="estoque-validade-badge estoque-validade-badge--${alerta.nivel}">${escapeHtml(alerta.label)}</span>` : ""
      const validade = p.validade_referencia
        ? new Date(p.validade_referencia + "T12:00:00").toLocaleDateString("pt-BR")
        : "—"
      return `
        <div class="estoque-catalogo-card">
          <div class="estoque-catalogo-head">
            <strong>${escapeHtml(p.nome)}</strong>
            ${badge}
          </div>
          <div class="estoque-catalogo-precos">
            <span>Pago: ${fmtBrl(p.custo_pago)}</span>
            <span>Profissional: ${fmtBrl(p.preco_profissional)}</span>
            <span>Cliente: ${fmtBrl(p.preco_cliente)}</span>
            <span>Frete típico: ${fmtBrl(p.frete_padrao)}</span>
          </div>
          <p class="estoque-catalogo-meta">Validade ref.: ${validade}</p>
          <button type="button" class="btn-secondary estoque-btn-editar-produto" data-id="${escapeAttr(p.id)}">Editar</button>
        </div>
      `
    }).join("")
    listEl.querySelectorAll(".estoque-btn-editar-produto").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id")
        const row = items.find((x) => x.id === id)
        if (row) openCadastroProduto(row)
      })
    })
  } catch (err) {
    const msg = String(err?.message || "")
    if (/portfolio-colar|estoque_produtos|does not exist/i.test(msg)) {
      if (hintEl) hintEl.classList.remove("hidden")
    }
    listEl.innerHTML = ""
    if (emptyEl) emptyEl.classList.remove("hidden")
  }
}

async function renderRevenda() {
  const tableEl = document.getElementById("estoqueRevendaTabela")
  const chartEl = document.getElementById("estoqueRevendaGrafico")
  if (!tableEl || !chartEl) return
  try {
    const [catalogo, resumo] = await Promise.all([
      listProdutosCatalogo().catch(() => []),
      getResumoPorProduto().catch(() => []),
    ])
    const consumoPorNome = {}
    const custoMedioPorNome = {}
    for (const r of resumo) {
      const n = (r.produto_nome || "").trim()
      if (!n) continue
      consumoPorNome[n] = Number(r.consumo_qty) || 0
      if (r.custo_medio != null) custoMedioPorNome[n] = Number(r.custo_medio)
    }
    const rows = montarRevenda({ catalogo, consumoPorNome, custoMedioPorNome })
    if (!rows.length) {
      tableEl.innerHTML = "<p class=\"estoque-acuracia-empty\">Cadastre produtos no portfólio e registre saídas (protocolo ou consumo) para ver ranking e lucro.</p>"
      chartEl.innerHTML = ""
      return
    }
    tableEl.innerHTML = `
      <table class="estoque-acuracia-table estoque-revenda-table">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Saídas</th>
            <th>Custo + frete</th>
            <th>Preço profissional</th>
            <th>Preço cliente</th>
            <th>Lucro un. (cliente)</th>
            <th>Lucro nas saídas</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td>${escapeHtml(r.produto_nome)}</td>
              <td>${Number(r.saida).toFixed(2)}</td>
              <td>${fmtBrl(r.custo_investido)}</td>
              <td>${fmtBrl(r.preco_profissional)}</td>
              <td>${fmtBrl(r.preco_cliente)}</td>
              <td>${fmtBrl(r.lucro_cliente_un)}</td>
              <td>${fmtBrl(r.lucro_estimado_saida)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `
    const max = Math.max(...rows.map((r) => r.saida), 0.01)
    chartEl.innerHTML = rows.slice(0, 8).map((r) => {
      const pct = Math.max(4, (r.saida / max) * 100)
      return `
        <div class="estoque-revenda-bar-row">
          <span class="estoque-revenda-bar-name">${escapeHtml(r.produto_nome)}</span>
          <div class="estoque-revenda-bar-track"><div class="estoque-revenda-bar-fill" style="width:${pct}%"></div></div>
          <span class="estoque-revenda-bar-qty">${Number(r.saida).toFixed(1)}</span>
        </div>
      `
    }).join("")
  } catch (err) {
    tableEl.innerHTML = `<p class="estoque-acuracia-erro">${escapeHtml(err.message || "Erro ao montar revenda.")}</p>`
    chartEl.innerHTML = ""
  }
}

function fmtBrl(v) {
  if (v == null || v === "" || Number.isNaN(Number(v))) return "—"
  return `R$ ${Number(v).toFixed(2).replace(".", ",")}`
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

async function renderProximosVencer() {
  const wrap = document.getElementById("estoqueProximosVencerWrap")
  const listEl = document.getElementById("estoqueProximosVencerList")
  if (!wrap || !listEl) return

  try {
    const itens = await getProdutosProximosVencer()
    if (itens.length === 0) {
      wrap.classList.add("hidden")
      listEl.innerHTML = ""
      return
    }
    wrap.classList.remove("hidden")
    const html = await Promise.all(
      itens.map(async (r) => {
        const alerta = alertaValidade(r.data_validade)
        const dataFormatada = r.data_validade ? new Date(r.data_validade + "T12:00:00").toLocaleDateString("pt-BR") : "—"
        const procs = await getProcedimentosQueUsamProduto(r.produto_nome)
        const procsText = procs.length > 0
          ? `Procedimentos que usam: ${procs.map((p) => p.procedure_name).join(", ")}. <span class="estoque-proximos-vencer-campanha">Use para campanhas.</span>`
          : "<span class=\"estoque-proximos-vencer-sem-proc\">Nenhum procedimento vinculado ao nome deste produto.</span>"
        const cls = alerta?.nivel === "vencido" ? "estoque-proximos-vencer-item estoque-validade-vencido" : "estoque-proximos-vencer-item"
        const badge = alerta ? `<span class="estoque-validade-badge estoque-validade-badge--${alerta.nivel}">${escapeHtml(alerta.label)}</span>` : ""
        return `
          <div class="${cls}">
            <span class="estoque-proximos-vencer-produto">${escapeHtml(r.produto_nome)} ${badge}</span>
            <span class="estoque-proximos-vencer-validade">Vence: ${dataFormatada}</span>
            ${r.quantidade ? `<span class="estoque-proximos-vencer-qty">${r.quantidade} un.</span>` : ""}
            ${r.lote ? `<span class="estoque-proximos-vencer-lote">Lote ${escapeHtml(r.lote)}</span>` : ""}
            <p class="estoque-proximos-vencer-procs">${procsText}</p>
          </div>
        `
      })
    )
    listEl.innerHTML = html.join("")
  } catch (e) {
    console.warn("[ESTOQUE] Próximos a vencer:", e)
    wrap.classList.add("hidden")
    listEl.innerHTML = ""
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
      const semSaldo = Number(r.entrada_qty) === 0 ? `<span class="estoque-resumo-portfolio">Só no portfólio</span>` : ""
      return `
        <div class="estoque-resumo-card">
          <span class="estoque-resumo-produto">${prod}</span>
          <span class="estoque-resumo-saldo">Saldo: ${saldo}</span>
          <span class="estoque-resumo-custo">Custo médio (com frete): ${custo}</span>
          ${semSaldo}
          <button type="button" class="btn-secondary estoque-btn-avaliar" data-produto="${escapeAttr(r.produto_nome)}" title="Avaliar este produto (nota e comentário)">Avaliar produto</button>
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
      <label for="acuraciaRealProduto">Produto</label>
      <input type="text" id="acuraciaRealProduto" list="acuraciaRealProdutoList" placeholder="Nome do produto" required>
      <datalist id="acuraciaRealProdutoList">${opcoes}</datalist>
      <label for="acuraciaRealQty">Quantidade consumida (real)</label>
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
      `<label for="acuraciaRealProduto">Produto</label><input type="text" id="acuraciaRealProduto" placeholder="Nome do produto" required>
       <label for="acuraciaRealQty">Quantidade</label><input type="number" id="acuraciaRealQty" step="0.01" min="0.01" required>`,
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
    <span class="form-label">Produto</span>
    <p id="avaliarProdutoLabel">${escapeHtml(produtoNome)}</p>
    <label for="avaliarProdutoNota">Nota (1 a 5)</label>
    <select id="avaliarProdutoNota">
      <option value="1">1 — Ruim</option>
      <option value="2">2</option>
      <option value="3" selected>3 — Regular</option>
      <option value="4">4</option>
      <option value="5">5 — Ótimo</option>
    </select>
    <label for="avaliarProdutoComentario">Comentário (opcional)</label>
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
      const parsed = normalizeParsedNota(res.parsed)
      if (res.error && !res.text && !parsed.itens.length) {
        openColarTextoNota(res.error)
        return
      }
      if (!parsed.itens.length) {
        openColarTextoNota(res.text || "", "Nenhum item extraído. Confira ou cole o texto da nota.")
        return
      }
      openModalSalvarItensOCR(parsed, res.text, "ocr")
    } catch (e) {
      console.error("[ESTOQUE OCR]", e)
      openColarTextoNota("", "Erro ao processar a foto. Cole o texto da nota.")
    }
  }
  input.click()
}

function openColarTextoNota(seed = "", hint = "Cole o texto da nota. A IA sugere; você confere.") {
  openModal(
    "Colar texto da nota",
    `<p class="estoque-ocr-hint">${escapeHtml(hint)}</p>
     <textarea id="estoqueOcrTexto" rows="10" placeholder="Texto da nota">${escapeHtml(seed || "")}</textarea>`,
    async () => {
      const text = document.getElementById("estoqueOcrTexto")?.value?.trim() || ""
      if (!text) {
        toast("Cole o texto da nota.")
        return
      }
      toast("Interpretando…")
      try {
        const res = await parseTextoNota(text)
        const parsed = normalizeParsedNota(res.parsed)
        if (!parsed.itens.length) {
          toast("Não deu para extrair itens. Ajuste o texto ou use entrada manual.")
          return
        }
        closeModal()
        openModalSalvarItensOCR(parsed, text, "ocr")
      } catch (e) {
        toast(e?.message || "Erro ao interpretar texto.")
      }
    },
    null
  )
}

function openEntradaXml() {
  const input = document.createElement("input")
  input.type = "file"
  input.accept = ".xml,text/xml,application/xml"
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      const xml = await file.text()
      const parsed = parseNfeXml(xml)
      if (!parsed.itens.length) {
        toast("XML sem itens reconhecidos. Use foto/texto ou entrada manual.")
        return
      }
      openModalSalvarItensOCR(parsed, xml.slice(0, 8000), "xml")
    } catch (e) {
      toast(e?.message || "Não foi possível ler o XML.")
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

function openModalSalvarItensOCR(parsed, rawText = "", origem = "ocr") {
  const normalized = normalizeParsedNota(parsed)
  const fornecedor = normalized.fornecedor || ""
  const data = normalized.data || new Date().toISOString().slice(0, 10)
  const itens = normalized.itens

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
    <p class="estoque-ocr-hint">Sugestão da nota; você confere e salva. Nada bloqueia o atendimento.</p>
    <label>Fornecedor</label>
    <input type="text" id="estoqueOcrFornecedor" value="${escapeHtml(fornecedor)}" placeholder="Nome do fornecedor">
    <label>Data da nota</label>
    <input type="date" id="estoqueOcrData" value="${data}">
    <label>Itens</label>
    <div class="estoque-ocr-itens">${rows}</div>
  `

  openModal(
    origem === "xml" ? "XML — conferir e salvar" : "Nota fiscal — conferir e salvar",
    fields,
    async () => {
      const fornecedorVal = document.getElementById("estoqueOcrFornecedor")?.value?.trim() || null
      const dataVal = document.getElementById("estoqueOcrData")?.value || new Date().toISOString().slice(0, 10)
      const containers = document.querySelectorAll(".estoque-ocr-item")
      const conferido = []
      for (const div of containers) {
        const produto = div.querySelector(".estoque-ocr-produto")?.value?.trim()
        const qty = div.querySelector(".estoque-ocr-qty")?.value
        const unit = div.querySelector(".estoque-ocr-unit")?.value
        const total = div.querySelector(".estoque-ocr-total")?.value
        const lote = div.querySelector(".estoque-ocr-lote")?.value?.trim()
        if (!produto || !qty || Number(qty) <= 0) continue
        conferido.push({
          produto_nome: produto,
          quantidade: qty,
          valor_unitario: unit || null,
          valor_total: total || null,
          lote: lote || null,
        })
      }
      const ocrNotaId = origem === "ocr"
        ? await saveOcrNota({ rawText, parsed: { fornecedor: fornecedorVal, data: dataVal, itens: conferido } })
        : null
      let salvos = 0
      for (const item of conferido) {
        await createEntrada({
          ...item,
          fornecedor: fornecedorVal,
          data_entrada: dataVal,
          origem,
          ocr_nota_id: ocrNotaId,
        })
        salvos++
      }
      closeModal()
      toast(salvos > 0 ? `${salvos} item(ns) salvo(s) no estoque.` : "Nenhum item válido.")
      await renderList()
      await renderResumo()
      await renderCatalogo()
      await renderRevenda()
    },
    null
  )
}

function openCadastroProduto(existente = null) {
  const p = existente || {}
  const fields = `
    <p class="estoque-ocr-hint">Só o nome é obrigatório. Quantidade entra depois, quando o produto chegar no estoque.</p>
    <label>Nome do produto</label>
    <input type="text" id="estoqueCatNome" value="${escapeHtml(p.nome || "")}" placeholder="Ex.: Ácido hialurônico 1ml" required>
    <label>Quanto você paga (unidade)</label>
    <input type="number" id="estoqueCatCusto" step="0.01" min="0" value="${p.custo_pago ?? ""}" placeholder="R$">
    <label>Valor para a profissional</label>
    <input type="number" id="estoqueCatPro" step="0.01" min="0" value="${p.preco_profissional ?? ""}" placeholder="R$">
    <label>Valor para o cliente final</label>
    <input type="number" id="estoqueCatCli" step="0.01" min="0" value="${p.preco_cliente ?? ""}" placeholder="R$">
    <label>Frete típico por unidade (investimento)</label>
    <input type="number" id="estoqueCatFrete" step="0.01" min="0" value="${p.frete_padrao ?? ""}" placeholder="R$">
    <label>Validade de referência (opcional)</label>
    <input type="date" id="estoqueCatValidade" value="${p.validade_referencia ? String(p.validade_referencia).slice(0, 10) : ""}">
    <label>Unidade (opcional)</label>
    <input type="text" id="estoqueCatUnidade" value="${escapeHtml(p.unidade || "")}" placeholder="un, ml, cx">
  `
  openModal(
    existente ? "Editar produto do portfólio" : "Cadastrar produto no portfólio",
    fields,
    async () => {
      const nome = document.getElementById("estoqueCatNome")?.value?.trim()
      if (!nome) {
        toast("Informe o nome do produto.")
        return
      }
      try {
        await upsertProdutoCatalogo({
          id: p.id || undefined,
          nome,
          custo_pago: document.getElementById("estoqueCatCusto")?.value,
          preco_profissional: document.getElementById("estoqueCatPro")?.value,
          preco_cliente: document.getElementById("estoqueCatCli")?.value,
          frete_padrao: document.getElementById("estoqueCatFrete")?.value,
          validade_referencia: document.getElementById("estoqueCatValidade")?.value || null,
          unidade: document.getElementById("estoqueCatUnidade")?.value,
        })
        closeModal()
        toast(existente ? "Produto atualizado." : "Produto cadastrado no portfólio. Use Entrada quando chegar estoque.")
        await renderCatalogo()
        await renderRevenda()
        await renderResumo()
        await renderProximosVencer()
      } catch (e) {
        toast(e.message || "Erro ao salvar produto.")
      }
    },
    null
  )
}

function openEntradaManual() {
  listProdutosCatalogo().catch(() => []).then((catalogo) => {
    const opcoes = (catalogo || []).map((p) => `<option value="${escapeAttr(p.nome)}"></option>`).join("")
    const fields = `
    <p class="estoque-ocr-hint">Use só quando o produto chegou. Para cadastrar no portfólio sem estoque, use Cadastrar produto.</p>
    <label>Produto</label>
    <input type="text" id="estoqueManualProduto" list="estoqueManualProdutoList" placeholder="Nome do produto">
    <datalist id="estoqueManualProdutoList">${opcoes}</datalist>
    <label>Quantidade desta entrada</label>
    <input type="number" id="estoqueManualQty" step="0.01" min="0.01" placeholder="Ex.: 1">
    <label>Valor unitário pago (opcional)</label>
    <input type="number" id="estoqueManualUnit" step="0.01" min="0" placeholder="R$">
    <label>Valor total dos itens (opcional)</label>
    <input type="number" id="estoqueManualTotal" step="0.01" min="0" placeholder="R$">
    <label>Frete desta compra (investimento, total)</label>
    <input type="number" id="estoqueManualFrete" step="0.01" min="0" placeholder="R$">
    <label>Fornecedor (opcional)</label>
    <input type="text" id="estoqueManualFornecedor" placeholder="Nome">
    <label>Data da entrada</label>
    <input type="date" id="estoqueManualData" value="${new Date().toISOString().slice(0, 10)}">
    <label>Validade do lote (opcional)</label>
    <input type="date" id="estoqueManualValidade">
  `

    openModal(
      "Entrada no estoque",
      fields,
      async () => {
        const produto = document.getElementById("estoqueManualProduto")?.value?.trim()
        const qty = document.getElementById("estoqueManualQty")?.value
        const unit = document.getElementById("estoqueManualUnit")?.value
        const total = document.getElementById("estoqueManualTotal")?.value
        const frete = document.getElementById("estoqueManualFrete")?.value
        const fornecedor = document.getElementById("estoqueManualFornecedor")?.value?.trim() || null
        const data = document.getElementById("estoqueManualData")?.value || new Date().toISOString().slice(0, 10)
        const dataValidade = document.getElementById("estoqueManualValidade")?.value?.trim() || null
        if (!produto) {
          toast("Informe o produto.")
          return
        }
        if (!qty || Number(qty) <= 0) {
          toast("Informe a quantidade desta entrada. Para só cadastrar o produto, use Cadastrar produto.")
          return
        }
        try {
          await createEntrada({
            produto_nome: produto,
            quantidade: qty,
            valor_unitario: unit || null,
            valor_total: total || null,
            valor_frete: frete || null,
            fornecedor,
            data_entrada: data,
            data_validade: dataValidade || undefined,
            origem: "manual"
          })
          closeModal()
          toast("Entrada salva.")
          await renderList()
          await renderResumo()
          await renderProximosVencer()
          await renderCatalogo()
          await renderRevenda()
        } catch (e) {
          toast(e.message || "Erro ao salvar.")
        }
      },
      null
    )
  })
}
