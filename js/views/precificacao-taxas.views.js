/**
 * Precificação e taxas — configuração das taxas reais do banco e simulador.
 * Ajuda o cliente a ver quanto recebe por forma de pagamento e qual desconto à vista pode dar.
 */

import {
  getTaxasOrganizacao,
  updateTaxasOrganizacao,
  getTaxaParaParcelas,
  calcularLiquido,
  descontoMaximoParaManterLiquido,
} from "../services/precificacao-taxas.service.js";
import { toast } from "../ui/toast.js";

function fmtNum(v) {
  if (v == null || Number.isNaN(v)) return "—";
  return Number(v).toFixed(2).replace(".", ",");
}
function fmtPct(v) {
  if (v == null || Number.isNaN(v)) return "—";
  return Number(v).toFixed(2).replace(".", ",") + "%";
}

export async function init() {
  const container = document.getElementById("view-precificacao-taxas");
  if (!container) return;

  const formTaxas = document.getElementById("precificacaoTaxasForm");
  const inputTaxaTransacao = document.getElementById("precificacaoTaxaTransacao");
  const inputTaxaAvistaDebito = document.getElementById("precificacaoTaxaAvistaDebito");
  const inputTaxaAvistaCredito = document.getElementById("precificacaoTaxaAvistaCredito");
  const inputTaxaParcelado = [];
  for (let i = 2; i <= 12; i++) inputTaxaParcelado[i] = document.getElementById("precificacaoTaxa" + i);
  const btnSalvarTaxas = document.getElementById("precificacaoBtnSalvarTaxas");
  const inputValorProcedimento = document.getElementById("precificacaoValorProcedimento");
  const tabelaSimulador = document.getElementById("precificacaoTabelaSimulador");
  const blocoDescontoAvista = document.getElementById("precificacaoBlocoDescontoAvista");
  const recomendacao = document.getElementById("precificacaoRecomendacao");

  let taxasAtuais = {
    taxa_transacao_pct: null,
    taxa_avista_pct: null,
    taxa_avista_debito_pct: null,
    taxa_avista_credito_pct: null,
    taxa_parcelado_2_6_pct: null,
    taxa_parcelado_7_12_pct: null
  };
  for (let i = 2; i <= 12; i++) taxasAtuais[`taxa_parcelado_${i}_pct`] = null;

  async function carregarTaxas() {
    try {
      taxasAtuais = await getTaxasOrganizacao();
      if (inputTaxaTransacao) inputTaxaTransacao.value = taxasAtuais.taxa_transacao_pct != null ? taxasAtuais.taxa_transacao_pct : "";
      if (inputTaxaAvistaDebito) inputTaxaAvistaDebito.value = taxasAtuais.taxa_avista_debito_pct != null ? taxasAtuais.taxa_avista_debito_pct : "";
      if (inputTaxaAvistaCredito) inputTaxaAvistaCredito.value = taxasAtuais.taxa_avista_credito_pct != null ? taxasAtuais.taxa_avista_credito_pct : "";
      for (let i = 2; i <= 12; i++) {
        const el = inputTaxaParcelado[i];
        const key = `taxa_parcelado_${i}_pct`;
        if (el) el.value = taxasAtuais[key] != null ? taxasAtuais[key] : "";
      }
    } catch (e) {
      console.error("[PRECIFICACAO-TAXAS] Erro ao carregar taxas", e);
      toast("Erro ao carregar taxas da organização");
    }
  }

  if (formTaxas && btnSalvarTaxas) {
    formTaxas.addEventListener("submit", async (e) => {
      e.preventDefault();
      const parsePct = (el) => {
        const v = el?.value?.trim();
        if (v === "") return null;
        const n = parseFloat(v, 10);
        return Number.isNaN(n) ? null : n;
      };
      const payload = {
        taxa_transacao_pct: parsePct(inputTaxaTransacao),
        taxa_avista_debito_pct: parsePct(inputTaxaAvistaDebito),
        taxa_avista_credito_pct: parsePct(inputTaxaAvistaCredito),
        taxa_parcelado_2_6_pct: null,
        taxa_parcelado_7_12_pct: null
      };
      for (let i = 2; i <= 12; i++) {
        payload[`taxa_parcelado_${i}_pct`] = parsePct(inputTaxaParcelado[i]);
      }
      payload.taxa_avista_pct = payload.taxa_avista_credito_pct ?? taxasAtuais.taxa_avista_pct;
      try {
        taxasAtuais = await updateTaxasOrganizacao(payload);
        toast("Taxas salvas.");
        atualizarSimulador();
      } catch (err) {
        toast(err?.message || "Erro ao salvar taxas");
      }
    });
  }

  function atualizarSimulador() {
    const valor = parseFloat(String(inputValorProcedimento?.value || "").replace(",", "."), 10);
    if (!tabelaSimulador) return;

    const temTaxasParcelado = Array.from({ length: 11 }, (_, i) => taxasAtuais[`taxa_parcelado_${i + 2}_pct`] != null).some(Boolean);
    const temTaxas = taxasAtuais.taxa_avista_debito_pct != null || taxasAtuais.taxa_avista_credito_pct != null || taxasAtuais.taxa_avista_pct != null || taxasAtuais.taxa_parcelado_2_6_pct != null || taxasAtuais.taxa_parcelado_7_12_pct != null || temTaxasParcelado;

    if (valor == null || Number.isNaN(valor) || valor <= 0) {
      tabelaSimulador.innerHTML = "<p class=\"precificacao-simulador-empty\">Digite o valor do procedimento acima para ver quanto você recebe em cada forma de pagamento.</p>";
      if (blocoDescontoAvista) blocoDescontoAvista.classList.add("hidden");
      if (recomendacao) recomendacao.classList.add("hidden");
      return;
    }

    const taxaAvistaDebito = getTaxaParaParcelas(taxasAtuais, 1, "debito");
    const taxaAvistaCredito = getTaxaParaParcelas(taxasAtuais, 1, "credito");
    const liquidoAvistaDebito = calcularLiquido(valor, taxaAvistaDebito);
    const liquidoAvistaCredito = calcularLiquido(valor, taxaAvistaCredito);
    const refAvista = Math.min(liquidoAvistaDebito, liquidoAvistaCredito);

    const linhas = [];
    linhas.push(`<tr><td>À vista (débito)</td><td>${fmtPct(taxaAvistaDebito)}</td><td>R$ ${fmtNum(liquidoAvistaDebito)}</td><td>—</td></tr>`);
    linhas.push(`<tr><td>À vista (crédito)</td><td>${fmtPct(taxaAvistaCredito)}</td><td>R$ ${fmtNum(liquidoAvistaCredito)}</td><td>—</td></tr>`);
    for (let p = 2; p <= 12; p++) {
      const taxa = getTaxaParaParcelas(taxasAtuais, p);
      const liquido = calcularLiquido(valor, taxa);
      const diff = liquido - refAvista;
      const diffStr = (diff >= 0 ? "+" : "") + " R$ " + fmtNum(diff);
      linhas.push(`<tr><td>${p}x</td><td>${fmtPct(taxa)}</td><td>R$ ${fmtNum(liquido)}</td><td>${diffStr}</td></tr>`);
    }

    const notaSemTaxas = !temTaxas
      ? "<p class=\"precificacao-simulador-empty\">Preencha e salve suas taxas acima para ver valores reais. Abaixo está com 0% de taxa.</p>"
      : "";
    tabelaSimulador.innerHTML =
      notaSemTaxas +
      "<table class=\"precificacao-tabela\" aria-label=\"Simulador: valor líquido por forma de pagamento\"><thead><tr><th>Forma</th><th>Taxa</th><th>Você recebe</th><th>Diferença vs à vista</th></tr></thead><tbody>" +
      linhas.join("") +
      "</tbody></table>";

    const liquido12 = calcularLiquido(valor, getTaxaParaParcelas(taxasAtuais, 12));
    const taxaAvistaRef = (taxasAtuais.taxa_avista_credito_pct != null || taxasAtuais.taxa_avista_debito_pct != null)
      ? taxaAvistaCredito
      : (taxasAtuais.taxa_avista_pct ?? 0) + (taxasAtuais.taxa_transacao_pct ?? 0);
    const descontoMax = descontoMaximoParaManterLiquido(valor, taxaAvistaRef, liquido12);
    if (blocoDescontoAvista) {
      blocoDescontoAvista.classList.remove("hidden");
      const text = blocoDescontoAvista.querySelector(".precificacao-desconto-text");
      if (text) {
        text.textContent =
          descontoMax <= 0
            ? "Se o cliente pagar à vista, você não precisa dar desconto para já receber mais que em 12x (a taxa à vista é menor)."
            : `Se o cliente pagar à vista, você pode dar até ${fmtPct(descontoMax)} de desconto e ainda receber o mesmo ou mais que em 12 parcelas.`;
      }
    }

    if (recomendacao) {
      recomendacao.classList.remove("hidden");
      const recText = recomendacao.querySelector(".precificacao-recomendacao-text");
      if (recText) {
        const melhorParcelas = 6;
        const taxa6 = getTaxaParaParcelas(taxasAtuais, 6);
        const rec =
          `Para manter mais lucro: prefira até ${melhorParcelas} parcelas (taxa ${fmtPct(taxa6)}) ou ofereça até ${fmtPct(descontoMax)} de desconto à vista.`;
        recText.textContent = rec;
      }
    }
  }

  if (inputValorProcedimento) {
    inputValorProcedimento.addEventListener("input", atualizarSimulador);
    inputValorProcedimento.addEventListener("change", atualizarSimulador);
  }

  await carregarTaxas();
  // Valor vindo do plano (Procedimentos → "Simular recebimento")
  const valorPlano = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("precificacaoValorSimulador") : null;
  if (valorPlano != null && valorPlano !== "" && inputValorProcedimento) {
    inputValorProcedimento.value = String(valorPlano).replace(".", ",");
    sessionStorage.removeItem("precificacaoValorSimulador");
  }
  atualizarSimulador();
}
