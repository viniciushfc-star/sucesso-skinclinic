import { toast } from "../ui/toast.js";
import { CONTABILIDADE_INTERNA_ENABLED } from "../core/feature-flags.js";
import { REGIMES, TIPOS_DOC_FISCAL } from "../constants/fiscal.js";
import {
  addFiscalDocument,
  exportCsvContador,
  getApuracaoEstimativa,
  getFiscalPrefs,
  listFiscalDocuments,
  saveApuracaoRascunho,
  saveFiscalPrefs,
} from "../services/fiscal.service.js";
import { getRelatorioContador } from "../services/contador.service.js";
import { relatorioContadorToReadable } from "../utils/contador-report.js";

function gerarPdfDoTexto(text, filename) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) throw new Error("Recarregue a página para gerar PDF.");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;
  const maxW = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;
  const lineHeight = 5;
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(11);
  for (const linha of text.split("\n")) {
    const split = doc.splitTextToSize(linha || " ", maxW);
    for (const piece of split) {
      if (y + lineHeight > pageH - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(piece, margin, y);
      y += lineHeight;
    }
  }
  doc.save(filename);
}

function money(v) {
  return "R$ " + (Number(v) || 0).toFixed(2).replace(".", ",");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;");
}

function defaultMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() - (d.getDate() < 5 ? 1 : 0));
  return d.toISOString().slice(0, 7);
}

let bound = false;

export async function initContadorPanel() {
  const regimeEl = document.getElementById("fiscalRegime");
  const aliqEl = document.getElementById("fiscalAliquota");
  const mesEl = document.getElementById("fiscalCompetencia");
  const internEl = document.getElementById("fiscalInternaHint");

  if (internEl) {
    internEl.textContent = CONTABILIDADE_INTERNA_ENABLED
      ? "Módulo interno ligado: esta tela passa a ser a base da apuração oficial."
      : "A apuração oficial (PGDAS, DCTF, e-Social) fica desligada de propósito. Esta aba entrega o que o contador usa hoje e guarda rascunho de competência para quando vocês forem o escritório.";
  }

  if (regimeEl && !regimeEl.dataset.filled) {
    regimeEl.dataset.filled = "1";
    regimeEl.innerHTML = REGIMES.map((r) => `<option value="${r.id}">${r.label}</option>`).join("");
  }
  if (mesEl && !mesEl.value) mesEl.value = defaultMonth();

  try {
    const prefs = await getFiscalPrefs();
    if (regimeEl) regimeEl.value = prefs.regime_tributario || "nao_informado";
    if (aliqEl && prefs.aliquota_simples_pct != null) aliqEl.value = prefs.aliquota_simples_pct;
  } catch (_) {}

  if (!bound) {
    bound = true;
    document.getElementById("fiscalBtnSalvarRegime")?.addEventListener("click", async () => {
      try {
        await saveFiscalPrefs({
          regime_tributario: regimeEl?.value,
          aliquota_simples_pct: aliqEl?.value,
        });
        toast("Regime salvo. O contador vê isso no CSV.");
        await renderApuracao();
      } catch (e) {
        toast(e.message || "Não salvou o regime. Rode o SQL fiscal se a coluna não existir.");
      }
    });
    document.getElementById("fiscalBtnApurar")?.addEventListener("click", renderApuracao);
    document.getElementById("fiscalBtnGuardarApuracao")?.addEventListener("click", async () => {
      try {
        const est = await getApuracaoEstimativa(mesEl?.value);
        await saveApuracaoRascunho(est);
        toast("Rascunho da competência guardado. Quando a contabilidade interna ligar, este registro vira o lançamento do mês.");
      } catch (e) {
        toast(e.message || "Guardado só neste aparelho (rode o SQL das apurações).");
      }
    });
    document.getElementById("fiscalBtnCsv")?.addEventListener("click", async () => {
      const mes = mesEl?.value || defaultMonth();
      const est = await getApuracaoEstimativa(mes);
      const csv = await exportCsvContador(est.start, est.end);
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `contador_${est.competencia}.csv`;
      a.click();
      toast("CSV do mês baixado (ponto e vírgula, abre no Excel).");
    });
    document.getElementById("fiscalBtnPdfClientes")?.addEventListener("click", async () => {
      try {
        const mes = mesEl?.value || defaultMonth();
        const est = await getApuracaoEstimativa(mes);
        const rel = await getRelatorioContador(est.start, est.end, { limiteClientes: 200 });
        const { text } = relatorioContadorToReadable(rel, est.clinica);
        gerarPdfDoTexto(text, `contador_clientes_${est.competencia}.pdf`);
        toast("PDF baixado.");
      } catch (e) {
        toast(e.message || "Não gerou o PDF.");
      }
    });
    document.getElementById("fiscalFormDoc")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await addFiscalDocument({
          tipo: document.getElementById("fiscalDocTipo")?.value,
          titulo: document.getElementById("fiscalDocTitulo")?.value,
          file_url: document.getElementById("fiscalDocUrl")?.value,
          competencia: mesEl?.value ? `${mesEl.value}-01` : null,
        });
        document.getElementById("fiscalFormDoc")?.reset();
        toast("Documento na pasta.");
        await renderPasta();
      } catch (err) {
        toast(err.message || "Não salvou o documento.");
      }
    });
  }

  const tipoSel = document.getElementById("fiscalDocTipo");
  if (tipoSel && !tipoSel.dataset.filled) {
    tipoSel.dataset.filled = "1";
    tipoSel.innerHTML = TIPOS_DOC_FISCAL.map((t) => `<option value="${t.id}">${t.label}</option>`).join("");
  }

  await renderApuracao();
  await renderPasta();
}

async function renderApuracao() {
  const box = document.getElementById("fiscalApuracaoResumo");
  const mesEl = document.getElementById("fiscalCompetencia");
  if (!box) return;
  try {
    const est = await getApuracaoEstimativa(mesEl?.value);
    const mei = est.regime === "mei";
    box.innerHTML = `
      <p><strong>Competência ${escapeHtml(est.competencia)}</strong> · regime ${escapeHtml(est.regime)}</p>
      <p>Receita (caixa) no mês: <strong>${money(est.receitaMes)}</strong></p>
      <p>Despesas no mês: ${money(est.despesaMes)} · resultado: ${money(est.resultado)}</p>
      <p>Receita nos últimos 12 meses: ${money(est.receita12)}</p>
      <p>${mei ? "MEI: DAS fixo — confira o valor no PGMEI; não estimamos aqui." : `Estimativa de DAS (alíquota ${est.aliquotaUsada}%): <strong>${money(est.dasEstimado)}</strong>`}</p>
      <p class="view-hint">Estimativa em regime de caixa (o que entrou no Financeiro). Não transmite, não substitui PGDAS DAS-Nacional nem o contador. Alíquota da tabela Anexo III: ${est.aliquotaTabela}% — altere se o escritório mandar outra.</p>
    `;
  } catch (e) {
    box.innerHTML = `<p class="view-hint">${escapeHtml(e.message || "Sem dados para estimar.")}</p>`;
  }
}

async function renderPasta() {
  const el = document.getElementById("fiscalPastaLista");
  if (!el) return;
  try {
    const docs = await listFiscalDocuments();
    const labels = Object.fromEntries(TIPOS_DOC_FISCAL.map((t) => [t.id, t.label]));
    if (!docs.length) {
      el.innerHTML = "<p class=\"view-hint\">Pasta vazia. Guarde o contrato, o DAS e o extrato com link (Drive) — o contador acha tudo aqui.</p>";
      return;
    }
    el.innerHTML = docs
      .map((d) => {
        const link = d.file_url
          ? `<a href="${escapeHtml(d.file_url)}" target="_blank" rel="noopener">abrir</a>`
          : "sem arquivo";
        return `<div class="crm-row"><div><strong>${escapeHtml(labels[d.tipo] || d.tipo)}</strong> — ${escapeHtml(d.titulo)}<br><span class="view-hint">${link}</span></div></div>`;
      })
      .join("");
  } catch (e) {
    el.innerHTML = `<p class="view-hint">${escapeHtml(e.message || "Rode supabase-fiscal-contador.sql")}</p>`;
  }
}
