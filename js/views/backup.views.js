import { exportarBackupUnico } from "../services/export.service.js";
import { importarBackupUnico } from "../services/importacao-lote.service.js";
import { backupToReadableReport } from "../utils/backup-report.js";
import { toast } from "../ui/toast.js";
import { checkPermission } from "../core/permissions.js";

const DATA_NOME = () => "backup_" + new Date().toISOString().slice(0, 10);

/* =====================
   SPA INIT
===================== */

export async function init() {
  await bindUI();
}

/* =====================
   UI
===================== */

async function bindUI() {
  const btnBackupJson = document.getElementById("btnBackupJson");
  const btnBackupPdf = document.getElementById("btnBackupPdf");
  const btnBackupWord = document.getElementById("btnBackupWord");
  const btnRestore = document.getElementById("btnRestore");
  const inputRestore = document.getElementById("backupRestoreFile");
  const resultEl = document.getElementById("backupRestoreResult");

  const canView = await checkPermission("backup:view");
  const canRestore = await checkPermission("backup:restore");

  if (canView) {
    if (btnBackupJson) btnBackupJson.onclick = baixarBackupJson;
    if (btnBackupPdf) btnBackupPdf.onclick = baixarBackupPdf;
    if (btnBackupWord) btnBackupWord.onclick = baixarBackupWord;
  } else {
    if (btnBackupJson) { btnBackupJson.disabled = true; btnBackupJson.title = "Sem permissão para baixar backup"; }
    if (btnBackupPdf) { btnBackupPdf.disabled = true; btnBackupPdf.title = "Sem permissão para baixar backup"; }
    if (btnBackupWord) { btnBackupWord.disabled = true; btnBackupWord.title = "Sem permissão para baixar backup"; }
  }

  if (btnRestore && inputRestore && resultEl) {
    if (canRestore) {
      btnRestore.onclick = () => inputRestore.click();
      inputRestore.onchange = () => executarRestaurar(inputRestore, resultEl);
    } else {
      btnRestore.disabled = true;
      btnRestore.title = "Sem permissão para restaurar backup";
    }
  }

  /* Link "Exportar e importar" (data-view="export") é tratado pelo SPA (bindMenu com delegação) */
}

async function baixarBackupJson() {
  try {
    toast("Gerando backup…");
    const backup = await exportarBackupUnico();
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = DATA_NOME() + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Backup (JSON) baixado!");
  } catch (err) {
    console.error("[BACKUP] json", err);
    toast(err?.message || "Erro ao gerar backup.");
  }
}

function gerarPdfDoRelatorio(text) {
  const { jsPDF } = window.jspdf;
  if (!jsPDF) {
    throw new Error("Biblioteca de PDF não carregada. Recarregue a página.");
  }
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - margin * 2;
  let y = margin;
  const lineHeight = 5;
  const pageH = doc.internal.pageSize.getHeight();

  doc.setFontSize(11);
  const linhas = text.split("\n");
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const split = doc.splitTextToSize(linha || " ", maxW);
    for (let j = 0; j < split.length; j++) {
      if (y + lineHeight > pageH - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(split[j], margin, y);
      y += lineHeight;
    }
  }
  return doc;
}

async function baixarBackupPdf() {
  try {
    toast("Gerando relatório em PDF…");
    const backup = await exportarBackupUnico();
    const { text } = backupToReadableReport(backup);
    const doc = gerarPdfDoRelatorio(text);
    doc.save(DATA_NOME() + ".pdf");
    toast("PDF baixado!");
  } catch (err) {
    console.error("[BACKUP] pdf", err);
    toast(err?.message || "Erro ao gerar PDF.");
  }
}

async function baixarBackupWord() {
  try {
    toast("Gerando relatório em Word…");
    const backup = await exportarBackupUnico();
    const { html } = backupToReadableReport(backup);
    const blob = new Blob(
      ["\ufeff" + html],
      { type: "application/msword" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = DATA_NOME() + ".doc";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Word baixado!");
  } catch (err) {
    console.error("[BACKUP] word", err);
    toast(err?.message || "Erro ao gerar Word.");
  }
}

async function executarRestaurar(fileInput, resultEl) {
  if (!fileInput?.files?.length || !resultEl) return;
  const file = fileInput.files[0];
  fileInput.value = "";
  try {
    resultEl.classList.remove("hidden");
    resultEl.innerHTML = "<p>Restaurando backup…</p>";
    const out = await importarBackupUnico(file);
    const parts = [];
    if (out.clientes) parts.push("Clientes: " + (out.clientes.inseridos || 0) + " inseridos");
    if (out.procedimentos) parts.push("Procedimentos: " + (out.procedimentos.inseridos || 0));
    if (out.financeiro) parts.push("Financeiro: " + (out.financeiro.inseridos || 0));
    if (out.custo_fixo) parts.push("Custo fixo: " + (out.custo_fixo.inseridos || 0));
    if (out.agenda) parts.push("Agenda: " + (out.agenda.inseridos || 0));
    resultEl.innerHTML =
      "<p class=\"backup-result-ok\">" +
      (parts.length ? parts.join("; ") : "Nenhuma seção encontrada no JSON.").replace(/</g, "&lt;") +
      "</p>";
    toast("Backup restaurado.");
  } catch (err) {
    resultEl.innerHTML =
      "<p class=\"backup-result-err\">" + (err?.message || String(err)).replace(/</g, "&lt;") + "</p>";
    toast("Erro ao restaurar backup.");
  }
}
