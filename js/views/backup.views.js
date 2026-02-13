import { exportarBackupUnico } from "../services/export.service.js";
import { importarBackupUnico } from "../services/importacao-lote.service.js";
import { toast } from "../ui/toast.js";
import { checkPermission } from "../core/permissions.js";
import { navigate } from "../core/spa.js";

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
  const btnBackup = document.getElementById("btnBackup");
  const btnRestore = document.getElementById("btnRestore");
  const inputRestore = document.getElementById("backupRestoreFile");
  const resultEl = document.getElementById("backupRestoreResult");

  const canView = await checkPermission("backup:view");
  const canRestore = await checkPermission("backup:restore");

  if (btnBackup && canView) {
    btnBackup.onclick = baixarBackup;
  }
  if (btnBackup && !canView) {
    btnBackup.disabled = true;
    btnBackup.title = "Sem permissão para baixar backup";
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

  const exportLink = document.querySelector("#view-backup .backup-export-link a[data-view=\"export\"]");
  if (exportLink) {
    exportLink.addEventListener("click", (e) => {
      e.preventDefault();
      navigate("export");
    });
  }
}

async function baixarBackup() {
  try {
    toast("Gerando backup…");
    const backup = await exportarBackupUnico();
    const json = JSON.stringify(backup, null, 2);
    const nome = "backup_" + new Date().toISOString().slice(0, 10) + ".json";
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Backup baixado!");
  } catch (err) {
    console.error("[BACKUP] baixar", err);
    toast(err?.message || "Erro ao gerar backup.");
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
