/**
 * Orçamento comercial: totais e texto para WhatsApp.
 * Não altera preço; o valor da linha é o que a clínica digitou.
 */

export function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

export function linhaTotal(item) {
  const qty = Number(item?.qty);
  const price = Number(item?.unit_price);
  const q = Number.isFinite(qty) && qty > 0 ? qty : 0;
  const p = Number.isFinite(price) && price >= 0 ? price : 0;
  return round2(q * p);
}

export function totalOrcamento(items) {
  return round2((items || []).reduce((s, it) => s + linhaTotal(it), 0));
}

export function brl(n) {
  return "R$ " + round2(n).toFixed(2).replace(".", ",");
}

export function hojeOrcamentoIso(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Venceu a validade e ainda não fechou. Não grava status no banco (CHECK atual não tem expirado). */
export function isOrcamentoExpirado(o, hoje = hojeOrcamentoIso()) {
  const s = String(o?.status || "").toLowerCase();
  if (s === "aceito" || s === "recusado" || s === "convertido") return false;
  const v = String(o?.valid_until || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  return v < String(hoje).slice(0, 10);
}

export function statusEfetivoOrcamento(o, hoje = hojeOrcamentoIso()) {
  if (isOrcamentoExpirado(o, hoje)) return "expirado";
  return String(o?.status || "rascunho").toLowerCase() || "rascunho";
}

export function statusOrcamentoLabel(status) {
  const map = {
    rascunho: "Rascunho",
    enviado: "Enviado",
    aceito: "Aceito",
    recusado: "Recusado",
    expirado: "Expirado",
    convertido: "Convertido",
  };
  return map[status] || status || "—";
}

/**
 * Mensagem pronta para wa.me / API. Um paciente por vez.
 */
export function formatOrcamentoMensagem({
  nomeClinica,
  nomeCliente,
  items,
  notes,
  validUntil,
} = {}) {
  const linhas = (items || [])
    .filter((it) => String(it.name || "").trim())
    .map((it) => {
      const qty = Number(it.qty) > 0 ? Number(it.qty) : 1;
      return `• ${String(it.name).trim()} × ${qty} — ${brl(linhaTotal(it))}`;
    });
  const total = totalOrcamento(items);
  const validade = validUntil
    ? `\nValidade: ${String(validUntil).slice(0, 10).split("-").reverse().join("/")}`
    : "";
  const obs = notes && String(notes).trim() ? `\nObs.: ${String(notes).trim()}` : "";
  const quem = nomeCliente ? `${nomeCliente}, segue` : "Segue";
  const clinica = nomeClinica ? `\n${nomeClinica}` : "";
  return `${quem} o orçamento:\n${linhas.join("\n") || "• (itens a combinar)"}\nTotal: ${brl(total)}${validade}${obs}${clinica}`;
}
