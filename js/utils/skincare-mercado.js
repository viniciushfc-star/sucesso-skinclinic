/**
 * Destaque de skincare só com fonte. Não é ranking. Não prescreve.
 */

export const CONF_OK = ["baixa", "media", "alta"];

export function isDestaqueFonteCompleta(row) {
  if (!row || typeof row !== "object") return false;
  if (!String(row.marca_produto || "").trim()) return false;
  if (!String(row.porque || "").trim()) return false;
  if (!String(row.fonte || "").trim()) return false;
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(row.data_ref || ""))) return false;
  if (!String(row.metodologia || "").trim()) return false;
  if (!CONF_OK.includes(String(row.confianca || "").toLowerCase())) return false;
  const amostra = Number(row.amostra);
  if (!Number.isFinite(amostra) || amostra < 1) return false;
  return true;
}

export function copyDestaque(row) {
  if (!isDestaqueFonteCompleta(row)) {
    return "Sem fonte completa — o destaque não entra na rotina nem na IA.";
  }
  const data = String(row.data_ref).slice(0, 10);
  return `${String(row.marca_produto).trim()} está em evidência segundo ${String(row.fonte).trim()} (${data}): ${String(row.porque).trim()}`;
}

export function payloadDestaquesParaIa(rows) {
  return (rows || []).filter(isDestaqueFonteCompleta).map((r) => ({
    marca_produto: String(r.marca_produto).trim().slice(0, 160),
    porque: String(r.porque).trim().slice(0, 400),
    fonte: String(r.fonte).trim().slice(0, 200),
    data_ref: String(r.data_ref).slice(0, 10),
    metodologia: String(r.metodologia).trim().slice(0, 200),
    confianca: String(r.confianca).toLowerCase(),
    amostra: Number(r.amostra),
  }));
}

export function fraseIaDestaque() {
  return 'Se citar um destaque, use: "em evidência segundo [fonte] ([data]) porque [porque]". Nunca "o melhor do mercado" nem ranking. A rotina prioriza marcas da casa.';
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

export function htmlDestaquesMercado(rows, { sqlAusente = false } = {}) {
  if (sqlAusente) {
    return `<p class="view-hint">Para cadastrar destaques com fonte, cole no Supabase o SQL <code>supabase-fase0-skincare-mercado-colar.sql</code>. Sem fonte o destaque não entra.</p>`;
  }
  if (!rows.length) {
    return `<p class="view-hint">Nenhum destaque com fonte completa. Cadastre lançamento ou consenso citado — a IA não inventa ranking.</p>`;
  }
  return `<div class="skincare-destaques-list">${rows
    .map((r) => {
      const id = "destaque_" + String(r.id || "").replace(/[^\w-]/g, "");
      return `<label class="skincare-destaque-card" for="${id}">
        <input type="checkbox" id="${id}" data-destaque-id="${escapeHtml(r.id)}" checked>
        <span><strong>${escapeHtml(r.marca_produto)}</strong> — ${escapeHtml(copyDestaque(r))}</span>
      </label>`;
    })
    .join("")}</div>`;
}
