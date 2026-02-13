import { exportarTabela, exportarBackupUnico } from "../services/export.service.js";
import { importarLote, getTemplateHeaders, importarBackupUnico, parseCSV, MAX_IMPORT_ROWS } from "../services/importacao-lote.service.js";
import { getProcedimentosRealizadosPorPeriodo } from "../services/metrics.service.js";
import { listProcedures } from "../services/procedimentos.service.js";
import { getOrgMembers } from "../core/org.js";
import { toCSV } from "../utils/csv.js";
import { toast } from "../ui/toast.js";
import { navigate } from "../core/spa.js";

let pendingImportFile = null;
let pendingImportRowCount = 0;


/* =====================
   SPA INIT
===================== */

export function init(){
 bindUI()
}


/* =====================
   ELEMENTOS
===================== */

/* =====================
   RENDER
===================== */

function bindUI() {
  const btnClientes = document.getElementById("btnExportClientes");
  const btnFinanceiro = document.getElementById("btnExportFinanceiro");
  const btnBackupJson = document.getElementById("btnExportBackupJson");
  if (btnClientes) btnClientes.onclick = () => exportar("clientes");
  if (btnFinanceiro) btnFinanceiro.onclick = () => exportar("financeiro");
  if (btnBackupJson) btnBackupJson.onclick = () => exportarBackupJson();

  const btnDownloadTemplate = document.getElementById("btnDownloadTemplate");
  const importFile = document.getElementById("importFile");
  const btnImportarLote = document.getElementById("btnImportarLote");
  const importResult = document.getElementById("importResult");

  if (btnDownloadTemplate) {
    btnDownloadTemplate.onclick = (e) => {
      e.preventDefault();
      baixarTemplate();
    };
  }
  if (importFile) {
    importFile.onchange = () => mostrarPreviewOuImportar(importFile, importResult);
  }
  if (btnImportarLote) btnImportarLote.onclick = () => confirmarImportacao(importResult);

  const btnBackup = document.getElementById("btnRestaurarBackup");
  const inputBackup = document.getElementById("importBackupFile");
  const resultBackup = document.getElementById("importBackupResult");
  if (btnBackup && inputBackup) {
    btnBackup.onclick = () => inputBackup.click();
    inputBackup.onchange = () => executarRestaurarBackup(inputBackup, resultBackup);
  }

  const btnRelatorioProc = document.getElementById("btnRelatorioProcedimentos");
  if (btnRelatorioProc) btnRelatorioProc.onclick = gerarRelatorioProcedimentos;

  const backupLink = document.querySelector("#view-export .export-import-hint a[data-view=\"backup\"]");
  if (backupLink) backupLink.addEventListener("click", (e) => { e.preventDefault(); navigate("backup"); });
}

let relatorioProcDropdownsPopulated = false;

async function preencherFiltrosRelatorioProc() {
  if (relatorioProcDropdownsPopulated) return;
  const selProf = document.getElementById("relatorioProcProfessional");
  const selProc = document.getElementById("relatorioProcProcedure");
  if (!selProf || !selProc) return;
  try {
    const [members, procedures] = await Promise.all([getOrgMembers(), listProcedures(true)]);
    if (selProf.options.length <= 1) {
      (members || []).forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m.user_id || "";
        opt.textContent = m.role || m.email || (m.user_id || "").slice(0, 8) + "…";
        selProf.appendChild(opt);
      });
    }
    if (selProc.options.length <= 1) {
      (procedures || []).forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = (p.name || "—").replace(/</g, "&lt;");
        selProc.appendChild(opt);
      });
    }
    relatorioProcDropdownsPopulated = true;
  } catch (_) {}
}

async function gerarRelatorioProcedimentos() {
  const startEl = document.getElementById("relatorioProcStart");
  const endEl = document.getElementById("relatorioProcEnd");
  const resultEl = document.getElementById("relatorioProcedimentosResult");
  const selProf = document.getElementById("relatorioProcProfessional");
  const selProc = document.getElementById("relatorioProcProcedure");
  if (!startEl || !endEl || !resultEl) return;
  const start = startEl.value?.trim();
  const end = endEl.value?.trim();
  if (!start || !end) {
    toast("Informe as datas inicial e final.");
    return;
  }
  if (start > end) {
    toast("Data inicial deve ser anterior à data final.");
    return;
  }
  await preencherFiltrosRelatorioProc();
  const opts = {};
  if (selProf?.value) opts.professionalId = selProf.value;
  if (selProc?.value) opts.procedureId = selProc.value;
  try {
    const rows = await getProcedimentosRealizadosPorPeriodo(start, end, opts);
    resultEl.classList.remove("hidden");
    if (rows.length === 0) {
      resultEl.innerHTML = "<p class=\"relatorio-procedimentos-empty\">Nenhum procedimento realizado no período.</p>";
      return;
    }
    const tableRows = rows.map((r) => `<tr><td>${String(r.procedure_name).replace(/</g, "&lt;")}</td><td>${r.total}</td></tr>`).join("");
    resultEl.innerHTML = `<table class="relatorio-procedimentos-table"><thead><tr><th>Procedimento</th><th>Quantidade</th></tr></thead><tbody>${tableRows}</tbody></table>`;
  } catch (e) {
    console.error("[RELATORIO-PROC]", e);
    resultEl.classList.remove("hidden");
    resultEl.innerHTML = "<p class=\"import-result-err\">" + (e.message || "Erro ao gerar relatório.").replace(/</g, "&lt;") + "</p>";
  }
}

function getTipoSelecionado() {
  const sel = document.getElementById("importTipo");
  return (sel && sel.value) || "clientes";
}

function baixarTemplate() {
  const tipo = getTipoSelecionado();
  const headers = getTemplateHeaders(tipo);
  const sep = ";";
  const line = headers.join(sep);
  const nome = tipo === "custo_fixo" ? "custo_fixo" : tipo;
  baixar(line + "\n", `modelo_${nome}.csv`);
  toast("Modelo baixado! Preencha e importe.");
}

function mostrarPreviewOuImportar(fileInput, resultEl) {
  const file = fileInput?.files?.[0];
  if (!file || !resultEl) return;
  pendingImportFile = file;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = reader.result;
      const rows = parseCSV(text);
      if (rows.length === 0) {
        resultEl.innerHTML = "<p class=\"import-result-err\">Nenhuma linha válida no CSV.</p>";
        resultEl.classList.remove("hidden");
        pendingImportFile = null;
        return;
      }
      const preview = rows.slice(0, 5);
      const headers = Object.keys(preview[0] || {});
      const tableRows = preview.map((r) => "<tr>" + headers.map((h) => "<td>" + String(r[h] ?? "").replace(/</g, "&lt;").slice(0, 30) + "</td>").join("") + "</tr>").join("");
      resultEl.innerHTML = "<p><strong>" + rows.length + " linha(s)</strong> no arquivo. Primeiras 5:</p><div class=\"import-preview-wrap\"><table class=\"import-preview-table\"><thead><tr>" + headers.map((h) => "<th>" + String(h).replace(/</g, "&lt;") + "</th>").join("") + "</tr></thead><tbody>" + tableRows + "</tbody></table></div><p>Clique em <strong>Importar</strong> para confirmar.</p>";
      resultEl.classList.remove("hidden");
    } catch (e) {
      resultEl.innerHTML = "<p class=\"import-result-err\">" + (e.message || String(e)).replace(/</g, "&lt;") + "</p>";
      resultEl.classList.remove("hidden");
      pendingImportFile = null;
    }
  };
  reader.readAsText(file, "UTF-8");
}

function confirmarImportacao(resultEl) {
  if (!pendingImportFile) {
    toast("Selecione um arquivo CSV primeiro.");
    return;
  }
  if (pendingImportRowCount > MAX_IMPORT_ROWS) {
    toast("Arquivo muito grande. Máximo " + MAX_IMPORT_ROWS + " linhas por vez.");
    return;
  }
  executarImportacao(pendingImportFile, resultEl);
  pendingImportFile = null;
  pendingImportRowCount = 0;
  document.getElementById("importFile").value = "";
}

async function executarImportacao(fileOrFromInput, resultEl) {
  const fileInput = document.getElementById("importFile");
  const file = fileOrFromInput && (fileOrFromInput instanceof File) ? fileOrFromInput : fileInput?.files?.[0];
  resultEl = resultEl || document.getElementById("importResult");
  if (!file || !resultEl) {
    toast("Selecione um arquivo CSV.");
    return;
  }
    const tipo = getTipoSelecionado();
  const pularDuplicados = document.querySelector("input[name=importDuplicados][value=pular]")?.checked !== false;
  try {
    resultEl.classList.remove("hidden");
    resultEl.innerHTML = "<p>Importando…</p>";
    const result = await importarLote(tipo, file, { pularDuplicados });
    let msg = "Inseridos: " + result.inseridos + ".";
    if (result.ignorados_duplicados > 0) msg += " Ignorados (duplicados): " + result.ignorados_duplicados + ".";
    if (result.erros && result.erros.length > 0) {
      msg += " Erros (" + result.erros.length + "): " + result.erros.slice(0, 5).map((e) => "Linha " + e.linha + ": " + e.msg).join("; ");
      if (result.erros.length > 5) msg += " … e mais " + (result.erros.length - 5) + ".";
    }
    resultEl.innerHTML = "<p class=\"import-result-ok\">" + msg.replace(/</g, "&lt;") + "</p>";
    resultEl.classList.remove("hidden");
    toast(result.inseridos > 0 ? "Importação concluída." : "Nenhum registro inserido; verifique erros.");
  } catch (err) {
    console.error("[IMPORT]", err);
    resultEl.innerHTML = "<p class=\"import-result-err\">" + (err.message || String(err)).replace(/</g, "&lt;") + "</p>";
    resultEl.classList.remove("hidden");
    toast("Erro ao importar.");
  }
}

async function exportarBackupJson() {
  try {
    toast("Gerando backup…");
    const backup = await exportarBackupUnico();
    const json = JSON.stringify(backup, null, 2);
    const nome = "backup_" + new Date().toISOString().slice(0, 10) + ".json";
    baixar(json, nome);
    toast("Backup (JSON) baixado!");
  } catch (err) {
    console.error("[EXPORT backup]", err);
    toast("Erro ao gerar backup.");
  }
}

async function executarRestaurarBackup(fileInput, resultEl) {
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
    resultEl.innerHTML = "<p class=\"import-result-ok\">" + (parts.length ? parts.join("; ") : "Nenhuma seção encontrada no JSON.").replace(/</g, "&lt;") + "</p>";
    resultEl.classList.remove("hidden");
    toast("Backup restaurado.");
  } catch (err) {
    resultEl.innerHTML = "<p class=\"import-result-err\">" + (err.message || String(err)).replace(/</g, "&lt;") + "</p>";
    resultEl.classList.remove("hidden");
    toast("Erro ao restaurar backup.");
  }
}

/* =====================
   ACTION
===================== */

async function exportar(tabela){

 try{

  const data =
   await exportarTabela(tabela)

  if(!data || data.length===0){
   toast("Nada para exportar")
   return
  }

  baixar(
   toCSV(data),
   `${tabela}.csv`
  )

  toast("Arquivo gerado!")

 }catch(err){

  console.error(
   "[EXPORT] erro",
   err
  )

  toast("Erro ao exportar")
 }
}


/* =====================
   DOWNLOAD
===================== */

function baixar(text,nome){

 const file =
  new Blob([text])

 const a =
  document.createElement("a")

 a.href =
  URL.createObjectURL(file)

 a.download = nome

 a.click()
}

