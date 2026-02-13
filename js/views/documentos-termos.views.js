/**
 * Documentos e termos jurídicos da organização.
 * Configurações → Documentos e termos.
 */

import { getLegalDocuments, saveLegalDocument, DOC_KEYS, DOC_DEFAULTS, applyOrgPlaceholders } from "../services/documentos-termos.service.js";
import { toast } from "../ui/toast.js";
import { getOrganizationProfile } from "../services/organization-profile.service.js";

export async function init() {
  await render();
  bindEvents();
}

async function render() {
  const container = document.getElementById("documentosTermosLista");
  if (!container) return;

  try {
    const docs = await getLegalDocuments();
    const profile = await getOrganizationProfile().catch(() => ({}));
    const getRows = (key) => (key === "anamnese_referencia" ? 8 : 14);

    container.innerHTML = docs
      .map(
        (d) => `
          <div class="view-card documentos-termos-card" data-doc-key="${escapeAttr(d.key)}">
            <div class="documentos-termos-card-header">
              <h3 class="view-card-title">${escapeHtml(d.label)}</h3>
              ${d.updatedAt ? `<span class="documentos-termos-updated">Atualizado em ${formatDate(d.updatedAt)}</span>` : "<span class=\"documentos-termos-modelo\">Modelo padrão</span>"}
            </div>
            <p class="documentos-termos-placeholder-hint">Substitua os placeholders entre colchetes (ex.: [NOME_DA_CLINICA], [CPF]) pelos dados reais. O sistema preenche automaticamente nome, CNPJ e endereço da empresa quando disponíveis.</p>
            <textarea class="documentos-termos-textarea" data-doc-key="${escapeAttr(d.key)}" rows="${getRows(d.key)}" placeholder="Clique em 'Carregar modelo padrão' para usar o texto base">${escapeHtml(d.content ?? "")}</textarea>
            <div class="documentos-termos-actions">
              <button type="button" class="btn-secondary btn-sm documentos-termos-btn-reset" data-doc-key="${escapeAttr(d.key)}" title="Carrega o modelo no editor para você editar e salvar">Carregar modelo padrão</button>
              <button type="button" class="btn-secondary btn-sm documentos-termos-btn-clear" data-doc-key="${escapeAttr(d.key)}" title="Limpa e usa o modelo do sistema (sem personalização)">Limpar</button>
              <button type="button" class="btn-primary btn-sm documentos-termos-btn-save" data-doc-key="${escapeAttr(d.key)}">Salvar</button>
            </div>
          </div>`
      )
      .join("");
  } catch (err) {
    console.error("[DOCUMENTOS-TERMOS]", err);
    container.innerHTML = `<div class="view-card"><p class="view-hint">Erro ao carregar. Verifique se a tabela <code>organization_legal_documents</code> existe no Supabase. Execute <code>supabase-documentos-termos.sql</code>.</p></div>`;
  }
}

function bindEvents() {
  const container = document.getElementById("documentosTermosLista");
  if (!container) return;

  container.querySelectorAll(".documentos-termos-btn-save").forEach((btn) => {
    btn.addEventListener("click", () => handleSave(btn.dataset.docKey));
  });

  container.querySelectorAll(".documentos-termos-btn-reset").forEach((btn) => {
    btn.addEventListener("click", () => handleLoadDefault(btn.dataset.docKey));
  });

  container.querySelectorAll(".documentos-termos-btn-clear").forEach((btn) => {
    btn.addEventListener("click", () => handleClear(btn.dataset.docKey));
  });
}

async function handleSave(docKey) {
  const textarea = document.querySelector(`.documentos-termos-textarea[data-doc-key="${escapeAttr(docKey)}"]`);
  if (!textarea) return;

  try {
    await saveLegalDocument(docKey, textarea.value);
    toast("Documento salvo.");
    await render();
  } catch (err) {
    toast(err?.message || "Erro ao salvar.");
  }
}

async function handleLoadDefault(docKey) {
  const profile = await getOrganizationProfile().catch(() => ({}));
  const defaultText = DOC_DEFAULTS[docKey] || "";
  const text = applyOrgPlaceholders(defaultText, profile);
  const textarea = document.querySelector(`.documentos-termos-textarea[data-doc-key="${escapeAttr(docKey)}"]`);
  if (textarea) {
    textarea.value = text;
    toast("Modelo carregado. Edite e clique em Salvar para gravar.");
  }
}

async function handleClear(docKey) {
  if (!confirm("Limpar o conteúdo e usar o modelo do sistema (sem personalização)?")) return;
  try {
    await saveLegalDocument(docKey, null);
    const textarea = document.querySelector(`.documentos-termos-textarea[data-doc-key="${escapeAttr(docKey)}"]`);
    if (textarea) textarea.value = "";
    toast("Conteúdo limpo. O modelo padrão será usado.");
    await render();
  } catch (err) {
    toast(err?.message || "Erro ao limpar.");
  }
}

function escapeHtml(s) {
  if (s == null) return "";
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function escapeAttr(s) {
  if (s == null) return "";
  return String(s).replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}
