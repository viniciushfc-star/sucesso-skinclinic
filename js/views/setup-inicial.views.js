/**
 * Custo fixo — fragmento usado na aba "Custo fixo" do Financeiro.
 * Organizar custos fixos da clínica (aluguel, luz, etc.) e criar lançamentos.
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg } from "../core/org.js";
import { toast } from "../ui/toast.js";
import { CUSTOS_FIXOS_COMUNS } from "../utils/categoria-financeiro.js";

const BTN_CRIAR_ID = "btnSetupCriarLancamentos";
const BTN_ADD_CUSTO_ID = "btnSetupAddCusto";
const CUSTO_NOME_ID = "setupCustoNome";
const CUSTO_VALOR_ID = "setupCustoValor";
const CUSTOS_CUSTOM_LIST = "setupCustosCustomList";

/** Chamado quando a view Setup inicial era uma rota própria; mantido para compat. */
export function init() {}

/**
 * Renderiza o bloco "Custo fixo" dentro do container (ex.: aba do Financeiro).
 * @param {HTMLElement} container - Elemento que receberá o conteúdo (ex. financeiroCustoFixoPanel).
 */
export function renderCustoFixo(container) {
  if (!container) return;

  container.innerHTML = `
    <div class="setup-inicial-custos"></div>
    <div class="setup-inicial-custos-custom">
      <h4 class="setup-inicial-custos-custom-title">Outros custos (segurança, manutenção, seguro, etc.)</h4>
      <div class="setup-inicial-custos-custom-add">
        <input type="text" id="${CUSTO_NOME_ID}" class="setup-inicial-custo-nome" placeholder="Ex.: Segurança, Manutenção elevador" aria-label="Nome do custo">
        <span class="setup-inicial-custo-valor-wrap">R$ <input type="number" id="${CUSTO_VALOR_ID}" class="setup-inicial-custo-valor" step="0.01" min="0" placeholder="0,00" aria-label="Valor mensal"></span>
        <button type="button" id="${BTN_ADD_CUSTO_ID}" class="btn-secondary">+ Adicionar</button>
      </div>
      <ul id="${CUSTOS_CUSTOM_LIST}" class="setup-inicial-custos-custom-list" aria-label="Custos adicionados"></ul>
    </div>
    <div class="setup-inicial-actions">
      <button type="button" id="${BTN_CRIAR_ID}" class="btn-primary">Criar lançamentos no Financeiro</button>
    </div>
    <p class="setup-inicial-next">
      Próximos passos: <a href="#" data-view="procedimento">Cadastrar procedimentos</a> ·
      <a href="#" data-view="export">Importar clientes ou agenda em lote</a>
    </p>
  `;

  const listEl = container.querySelector(".setup-inicial-custos");
  if (!listEl) return;

  listEl.innerHTML = CUSTOS_FIXOS_COMUNS.map((item) => `
    <label class="setup-inicial-row">
      <input type="checkbox" class="setup-inicial-check" data-id="${item.id}" data-descricao="${(item.descricao || item.label).replace(/"/g, "&quot;")}">
      <span class="setup-inicial-label">${(item.label || "").replace(/</g, "&lt;")}</span>
      <span class="setup-inicial-input-wrap">
        R$ <input type="number" class="setup-inicial-valor" data-id="${item.id}" step="0.01" min="0" placeholder="0,00">
      </span>
    </label>
  `).join("");
}

function escapeHtml(s) {
  if (s == null) return "";
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

/**
 * Associa eventos do bloco Custo fixo (botão criar, links de navegação).
 * @param {HTMLElement} container - Mesmo elemento usado em renderCustoFixo.
 */
export function bindCustoFixoEvents(container) {
  if (!container) return;

  const btn = container.querySelector(`#${BTN_CRIAR_ID}`);
  if (btn) btn.onclick = () => criarLancamentos(container);

  const btnAdd = container.querySelector(`#${BTN_ADD_CUSTO_ID}`);
  const inputNome = container.querySelector(`#${CUSTO_NOME_ID}`);
  const inputValor = container.querySelector(`#${CUSTO_VALOR_ID}`);
  const listCustom = container.querySelector(`#${CUSTOS_CUSTOM_LIST}`);
  if (btnAdd && inputNome && inputValor && listCustom) {
    btnAdd.onclick = () => {
      const nome = (inputNome.value || "").trim();
      const valor = parseFloat(String(inputValor.value || "").replace(",", "."));
      if (!nome) {
        toast("Digite o nome do custo.");
        return;
      }
      if (!Number.isFinite(valor) || valor <= 0) {
        toast("Digite um valor maior que zero.");
        return;
      }
      const li = document.createElement("li");
      li.className = "setup-inicial-row-custom";
      li.dataset.descricao = nome;
      li.dataset.valor = String(valor);
      li.innerHTML = `<span class="setup-inicial-row-custom-label">${escapeHtml(nome)}</span> <span class="setup-inicial-row-custom-valor">R$ ${valor.toFixed(2).replace(".", ",")}</span> <button type="button" class="btn-small setup-inicial-row-custom-remove" aria-label="Remover">Remover</button>`;
      li.querySelector(".setup-inicial-row-custom-remove").onclick = () => li.remove();
      listCustom.appendChild(li);
      inputNome.value = "";
      inputValor.value = "";
      inputNome.focus();
    };
  }

  /* Links data-view são tratados pelo SPA (bindMenu com delegação) */
}

async function criarLancamentos(container) {
  const orgId = getActiveOrg();
  if (!orgId) {
    toast("Organização não definida.");
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    toast("Sessão expirada.");
    return;
  }

  const rows = [];
  const scope = container || document;
  scope.querySelectorAll(".setup-inicial-row").forEach((row) => {
    const check = row.querySelector(".setup-inicial-check");
    const valorEl = row.querySelector(".setup-inicial-valor");
    if (!check || !check.checked || !valorEl) return;
    const valor = parseFloat(String(valorEl.value).replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) return;
    const descricao = check.getAttribute("data-descricao") || "Custo fixo";
    rows.push({ descricao, valor });
  });
  scope.querySelectorAll(".setup-inicial-row-custom").forEach((li) => {
    const descricao = (li.dataset.descricao || "").trim();
    const valor = parseFloat(String(li.dataset.valor || "").replace(",", "."));
    if (descricao && Number.isFinite(valor) && valor > 0) rows.push({ descricao, valor });
  });

  if (rows.length === 0) {
    toast("Marque pelo menos um custo (ou adicione outro) e informe o valor.");
    return;
  }

  const hoje = new Date().toISOString().slice(0, 10);

  const toInsert = rows.map((r) => ({
    org_id: orgId,
    user_id: user.id,
    descricao: r.descricao,
    tipo: "saida",
    valor: r.valor,
    data: hoje,
    categoria_saida: "custo_fixo",
    importado: false,
    procedure_id: null,
  }));

  const { data, error } = await supabase.from("financeiro").insert(toInsert).select("id");
  if (error) {
    toast("Erro ao criar: " + (error.message || "tente de novo."));
    return;
  }

  const count = data?.length ?? 0;
  toast(`${count} lançamento(s) criado(s) no Financeiro.`);
  if (container) {
    renderCustoFixo(container);
    bindCustoFixoEvents(container);
  }
  if (typeof window.renderFinanceiro === "function") window.renderFinanceiro();
}
