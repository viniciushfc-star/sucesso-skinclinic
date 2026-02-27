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
  const tabelaSimuladorBandeiras = document.getElementById("precificacaoTabelaSimuladorBandeiras");
  const blocoDescontoAvista = document.getElementById("precificacaoBlocoDescontoAvista");
  const recomendacao = document.getElementById("precificacaoRecomendacao");

  const BANDEIRAS_IDS = {
    visa: { debito: "precificacaoBandeiraVisaDebito", credito_avista: "precificacaoBandeiraVisaCredito", parcelado_2_6: "precificacaoBandeiraVisaParcelado26", parcelado_7_12: "precificacaoBandeiraVisaParcelado712" },
    master: { debito: "precificacaoBandeiraMasterDebito", credito_avista: "precificacaoBandeiraMasterCredito", parcelado_2_6: "precificacaoBandeiraMasterParcelado26", parcelado_7_12: "precificacaoBandeiraMasterParcelado712" },
    elo: { debito: "precificacaoBandeiraEloDebito", credito_avista: "precificacaoBandeiraEloCredito", parcelado_2_6: "precificacaoBandeiraEloParcelado26", parcelado_7_12: "precificacaoBandeiraEloParcelado712" }
  };

  let taxasAtuais = {
    taxa_transacao_pct: null,
    taxa_avista_pct: null,
    taxa_avista_debito_pct: null,
    taxa_avista_credito_pct: null,
    taxa_parcelado_2_6_pct: null,
    taxa_parcelado_7_12_pct: null
  };
  for (let i = 2; i <= 12; i++) taxasAtuais[`taxa_parcelado_${i}_pct`] = null;

  function setVal(id, v) {
    const el = document.getElementById(id);
    if (el) el.value = v != null && v !== "" ? v : "";
  }

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
      const bandeiras = taxasAtuais.taxas_bandeiras;
      if (bandeiras && typeof bandeiras === "object") {
        for (const bandeira of ["visa", "master", "elo"]) {
          const b = bandeiras[bandeira];
          if (!b || typeof b !== "object") continue;
          const ids = BANDEIRAS_IDS[bandeira];
          setVal(ids.debito, b.debito);
          setVal(ids.credito_avista, b.credito_avista);
          setVal(ids.parcelado_2_6, b.parcelado_2_6);
          setVal(ids.parcelado_7_12, b.parcelado_7_12);
        }
      }
      setVal("precificacaoParcelamentoMargem", taxasAtuais.parcelamento_margem_minima_pct != null ? taxasAtuais.parcelamento_margem_minima_pct : 80);
      setVal("precificacaoParcelamentoMax", taxasAtuais.parcelamento_max_parcelas != null ? taxasAtuais.parcelamento_max_parcelas : "");
      setVal("precificacaoMargemAlvoPadrao", taxasAtuais.margem_alvo_padrao_pct != null ? taxasAtuais.margem_alvo_padrao_pct : 40);
      setVal("precificacaoComissaoPadrao", taxasAtuais.comissao_profissional_padrao_pct != null ? taxasAtuais.comissao_profissional_padrao_pct : "");
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
      const bandeirasOut = {};
      for (const bandeira of ["visa", "master", "elo"]) {
        const ids = BANDEIRAS_IDS[bandeira];
        const debito = parsePct(document.getElementById(ids.debito));
        const credito = parsePct(document.getElementById(ids.credito_avista));
        const p26 = parsePct(document.getElementById(ids.parcelado_2_6));
        const p712 = parsePct(document.getElementById(ids.parcelado_7_12));
        if (debito != null || credito != null || p26 != null || p712 != null) {
          bandeirasOut[bandeira] = { debito: debito ?? null, credito_avista: credito ?? null, parcelado_2_6: p26 ?? null, parcelado_7_12: p712 ?? null };
        }
      }
      if (Object.keys(bandeirasOut).length) payload.taxas_bandeiras = bandeirasOut;
      const margemEl = document.getElementById("precificacaoParcelamentoMargem");
      const maxEl = document.getElementById("precificacaoParcelamentoMax");
      const margemAlvoEl = document.getElementById("precificacaoMargemAlvoPadrao");
      const comissaoPadraoEl = document.getElementById("precificacaoComissaoPadrao");
      if (margemEl) payload.parcelamento_margem_minima_pct = margemEl.value.trim() === "" ? 80 : parseFloat(margemEl.value, 10) || 80;
      if (maxEl) payload.parcelamento_max_parcelas = maxEl.value.trim() === "" ? null : (parseInt(maxEl.value, 10) || null);
      if (margemAlvoEl) payload.margem_alvo_padrao_pct = margemAlvoEl.value.trim() === "" ? 40 : parseFloat(margemAlvoEl.value, 10) || 40;
      if (comissaoPadraoEl) payload.comissao_profissional_padrao_pct = comissaoPadraoEl.value.trim() === "" ? null : (parseFloat(comissaoPadraoEl.value, 10) || null);
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
    linhas.push(`<tr><td>PIX</td><td>0%</td><td>R$ ${fmtNum(valor)}</td><td>—</td></tr>`);
    linhas.push(`<tr><td>Dinheiro</td><td>0%</td><td>R$ ${fmtNum(valor)}</td><td>—</td></tr>`);
    linhas.push(`<tr><td>Transferência</td><td>0%</td><td>R$ ${fmtNum(valor)}</td><td>—</td></tr>`);
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

    const transacao = Number(taxasAtuais.taxa_transacao_pct) || 0;
    const bandeiras = taxasAtuais.taxas_bandeiras;
    if (tabelaSimuladorBandeiras && bandeiras && typeof bandeiras === "object" && Object.keys(bandeiras).length > 0) {
      const bandeiraLabels = { visa: "Visa", master: "Master", elo: "Elo" };
      const linhasB = [];
      for (const [key, b] of Object.entries(bandeiras)) {
        if (!b || typeof b !== "object") continue;
        const taxaDeb = transacao + (Number(b.debito) || 0);
        const taxaCred = transacao + (Number(b.credito_avista) || 0);
        const taxa26 = transacao + (Number(b.parcelado_2_6) || 0);
        const taxa712 = transacao + (Number(b.parcelado_7_12) || 0);
        const liqDeb = calcularLiquido(valor, taxaDeb);
        const liqCred = calcularLiquido(valor, taxaCred);
        const liq26 = calcularLiquido(valor, taxa26);
        const liq712 = calcularLiquido(valor, taxa712);
        linhasB.push(
          `<tr><th scope="row">${bandeiraLabels[key] || key}</th><td>${fmtPct(taxaDeb)}<br><small>R$ ${fmtNum(liqDeb)}</small></td><td>${fmtPct(taxaCred)}<br><small>R$ ${fmtNum(liqCred)}</small></td><td>${fmtPct(taxa26)}<br><small>R$ ${fmtNum(liq26)}</small></td><td>${fmtPct(taxa712)}<br><small>R$ ${fmtNum(liq712)}</small></td></tr>`
        );
      }
      tabelaSimuladorBandeiras.innerHTML =
        "<h4 class=\"precificacao-simulador-bandeiras-title\">Por bandeira (conforme cadastrado)</h4>" +
        "<table class=\"precificacao-tabela precificacao-bandeiras-simulador\" aria-label=\"Simulador por bandeira\"><thead><tr><th scope=\"col\">Bandeira</th><th scope=\"col\">Débito</th><th scope=\"col\">Crédito à vista</th><th scope=\"col\">Parcelado 2x–6x</th><th scope=\"col\">Parcelado 7x–12x</th></tr></thead><tbody>" +
        linhasB.join("") + "</tbody></table>";
      tabelaSimuladorBandeiras.classList.remove("hidden");
    } else if (tabelaSimuladorBandeiras) {
      tabelaSimuladorBandeiras.innerHTML = "";
      tabelaSimuladorBandeiras.classList.add("hidden");
    }

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
