/**
 * P2-8 — OCR/XML sugerem; humano confere. Não fecha verdade fiscal.
 */

export function strOrNull(v) {
  const s = String(v ?? "").trim();
  return s && s !== "null" ? s : null;
}

export function numOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function dateOrNull(v) {
  const s = String(v ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export function normalizeOcrItem(item) {
  const row = item && typeof item === "object" ? item : {};
  const qty = numOrNull(row.quantidade);
  const unit = numOrNull(row.valor_unitario);
  const total = numOrNull(row.valor_total);
  return {
    produto_nome: strOrNull(row.produto_nome || row.xProd || row.nome),
    quantidade: qty != null && qty > 0 ? qty : null,
    valor_unitario: unit,
    valor_total: total,
    lote: strOrNull(row.lote),
  };
}

export function normalizeParsedNota(parsed) {
  const p = parsed && typeof parsed === "object" ? parsed : {};
  const itens = Array.isArray(p.itens) ? p.itens.map(normalizeOcrItem).filter((i) => i.produto_nome) : [];
  return {
    fornecedor: strOrNull(p.fornecedor),
    data: dateOrNull(p.data),
    itens,
  };
}

function xmlTag(src, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i");
  const m = String(src || "").match(re);
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : null;
}

function xmlTags(src, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi");
  const out = [];
  let m;
  const s = String(src || "");
  while ((m = re.exec(s))) out.push(m[1]);
  return out;
}

/** NF-e / NFS-e: extrai emitente, data e itens. Sem inventar produto. */
export function parseNfeXml(xml) {
  const src = String(xml || "");
  const emitBlock = xmlTag(src, "emit") || "";
  const fornecedor = xmlTag(emitBlock, "xNome") || xmlTag(src, "xNome");
  const dh = xmlTag(src, "dhEmi") || xmlTag(src, "dhServico") || xmlTag(src, "dEmi") || "";
  const data = dateOrNull(dh.replace("T", " ").slice(0, 10));
  const dets = xmlTags(src, "det");
  const itens = (dets.length ? dets : xmlTags(src, "prod")).map((block) => {
    const prod = xmlTag(block, "prod") || block;
    const q = numOrNull(xmlTag(prod, "qCom") || xmlTag(prod, "qTrib"));
    const unit = numOrNull(xmlTag(prod, "vUnCom") || xmlTag(prod, "vUnTrib"));
    const total = numOrNull(xmlTag(prod, "vProd"));
    return normalizeOcrItem({
      produto_nome: xmlTag(prod, "xProd"),
      quantidade: q,
      valor_unitario: unit,
      valor_total: total,
    });
  }).filter((i) => i.produto_nome);
  return normalizeParsedNota({ fornecedor, data, itens });
}
