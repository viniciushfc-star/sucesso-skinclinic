/**
 * Marcas da casa a partir do portfólio. A IA só cita o que a clínica vende.
 * Sem ranking de mercado. Sem concorrente inventado.
 */

export function inferirMarca(produto) {
  const direta = String(produto?.marca || "").trim();
  if (direta) return direta;
  const nome = String(produto?.nome || "").trim();
  if (!nome) return "";
  const spaced = nome.split(/\s+[-–—|/]\s+/);
  if (spaced.length > 1) return spaced[0].trim().slice(0, 40);
  const words = nome.split(/\s+/);
  if (words[0] && words[0].length <= 3 && words[1]) {
    return `${words[0]} ${words[1]}`.replace(/[,:].*$/, "").slice(0, 40);
  }
  return (words[0] || nome).slice(0, 40);
}

export function agruparMarcasCasa(produtos) {
  const map = new Map();
  for (const p of produtos || []) {
    const marca = inferirMarca(p);
    if (!marca) continue;
    if (!map.has(marca)) map.set(marca, { marca, produtos: [] });
    const nome = String(p.nome || "").trim();
    if (nome) map.get(marca).produtos.push({ id: p.id || null, nome });
  }
  return [...map.values()].sort((a, b) => a.marca.localeCompare(b.marca, "pt"));
}

export function filtrarMarcasSelecionadas(grupos, nomesMarcados) {
  const want = new Set((nomesMarcados || []).map((m) => String(m || "").trim()).filter(Boolean));
  return (grupos || []).filter((g) => want.has(g.marca));
}

export function payloadMarcasParaIa(gruposSelecionados) {
  const marcas = [];
  const produtos = [];
  for (const g of gruposSelecionados || []) {
    const marca = String(g.marca || "").trim();
    if (!marca) continue;
    marcas.push(marca);
    for (const p of g.produtos || []) {
      const nome = String(p.nome || "").trim();
      if (nome) produtos.push({ marca, nome: nome.slice(0, 120) });
    }
  }
  return { marcas, produtos };
}

export function htmlMarcasCasa(grupos, selecionadas) {
  const sel = new Set(selecionadas || grupos.map((g) => g.marca));
  if (!grupos.length) {
    return `<p class="view-hint" id="skincareMarcasCasaVazio">Cadastre produtos no Estoque (portfólio) para a rotina usar marcas da casa. Sem lista, a IA não cita marca de mercado.</p>`;
  }
  const chips = grupos
    .map((g) => {
      const n = g.produtos.length;
      const checked = sel.has(g.marca) ? " checked" : "";
      const id = "marcaCasa_" + String(g.marca).replace(/[^\w]+/g, "_").slice(0, 40);
      return `<label class="skincare-marca-chip" for="${id}">
        <input type="checkbox" id="${id}" data-marca="${escapeAttr(g.marca)}"${checked}>
        <span>${escapeHtml(g.marca)}</span>
        <small>${n} item(ns)</small>
      </label>`;
    })
    .join("");
  return `<p class="view-hint">Marcas da casa. A IA só pode nomear o que estiver marcado. Sem “melhor do mercado”.</p>
    <div class="skincare-marcas-chips">${chips}</div>`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
