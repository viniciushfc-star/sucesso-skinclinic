/**
 * Custo fixo — fragmento usado na aba "Custo fixo" do Financeiro.
 * Organizar custos fixos da clínica (aluguel, luz, etc.) e criar lançamentos.
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg } from "../core/org.js";
import { toast } from "../ui/toast.js";
import { navigate } from "../core/spa.js";
import { CUSTOS_FIXOS_COMUNS } from "../utils/categoria-financeiro.js";

const BTN_CRIAR_ID = "btnSetupCriarLancamentos";

/** Chamado quando a view Setup inicial era uma rota própria; mantido para compat. */
export function init() {}

/**
 * Renderiza o bloco "Custo fixo" dentro do container (ex.: aba do Financeiro).
 * @param {HTMLElement} container - Elemento que receberá o conteúdo (ex. financeiroCustoFixoPanel).
 */
export function renderCustoFixo(container) {
  if (!container) return;

  container.innerHTML = `
    <h3 class="custo-fixo-title">Custo fixo</h3>
    <p class="setup-inicial-intro">
      Marque os custos fixos que você tem e informe o valor (mensal ou último pago).
      O sistema já classifica como <strong>Custo fixo</strong> — aluguel, luz, internet etc.
      Você pode editar ou adicionar mais na aba «Visão geral».
    </p>
    <div class="setup-inicial-custos"></div>
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

/**
 * Associa eventos do bloco Custo fixo (botão criar, links de navegação).
 * @param {HTMLElement} container - Mesmo elemento usado em renderCustoFixo.
 */
export function bindCustoFixoEvents(container) {
  if (!container) return;

  const btn = container.querySelector(`#${BTN_CRIAR_ID}`);
  if (btn) btn.onclick = () => criarLancamentos(container);

  container.querySelectorAll("a[data-view]").forEach((a) => {
    a.onclick = (e) => {
      e.preventDefault();
      const view = a.getAttribute("data-view");
      if (view) navigate(view);
    };
  });
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

  if (rows.length === 0) {
    toast("Marque pelo menos um custo e informe o valor.");
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
