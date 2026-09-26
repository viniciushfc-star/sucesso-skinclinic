/**
 * IA Consultora: pergunta sobre agregados reais, com fonte.
 * Não inventa número. Não muda preço. Não dispara WhatsApp.
 */

export const MSG_SEM_FONTE =
  "Não informado: esse número não está nos dados da clínica com fonte. A IA não inventa.";

export function round2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.round(x * 100) / 100;
}

export function normalizarNumeroToken(s) {
  let t = String(s || "").trim();
  if (!t) return null;
  if (t.includes(",") && t.includes(".")) t = t.replace(/\./g, "").replace(",", ".");
  else if (t.includes(",")) t = t.replace(",", ".");
  return round2(t);
}

export function extrairNumeros(texto) {
  const re = /-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|-?\d+(?:[.,]\d+)?/g;
  const out = [];
  for (const m of String(texto || "").matchAll(re)) {
    const n = normalizarNumeroToken(m[0]);
    if (n != null) out.push(n);
  }
  return out;
}

function normPergunta(q) {
  return String(q || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function intentConsultora(pergunta) {
  const s = normPergunta(pergunta);
  if (!s.trim()) return "";
  if (/concorr|mercado externo|preco de mercado|quanto cobrar no mercado/.test(s)) return "fora";
  if (/despesa|saida|gasto/.test(s) && /quant|valor|total|quanto/.test(s)) return "financeiro_saida";
  if (/fatur|receita|entrada|recebido|caixa/.test(s)) return "financeiro_entrada";
  if (/(media|média)/.test(s) && /lanc|financeiro|valor/.test(s)) return "financeiro_media";
  if (/quantos?\s+cliente|numero de cliente|qtd(?:\.|uanta)? de cliente/.test(s)) return "clientes";
  if (/quantos?\s+(horario|agend|atend)/.test(s) || (/agenda/.test(s) && /quant/.test(s))) return "agenda";
  if (/total/.test(s) && /financeiro|lanc/.test(s)) return "financeiro_total";
  return "";
}

function brl(n) {
  const v = round2(n);
  if (v == null) return "não informado";
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

function somaTipo(byType, keys) {
  const map = byType && typeof byType === "object" ? byType : {};
  let acc = null;
  for (const [k, v] of Object.entries(map)) {
    const nk = String(k).toLowerCase();
    if (!keys.some((x) => nk.includes(x))) continue;
    const n = round2(v);
    if (n == null) continue;
    acc = (acc || 0) + n;
  }
  return acc;
}

/**
 * Fatos com origem. Ausência = não entra na lista (não vira 0 inventado).
 */
export function montarFatosConsultora({
  clientesTotal,
  financeiroTotal,
  financeiroCount,
  financeiroMedia,
  financeiroPorTipo,
  agendaTotal,
  amostraClientes = 100,
  amostraFinanceiro = 100,
  amostraAgenda = 100,
} = {}) {
  const fatos = [];
  const push = (id, valor, fonte, fmt = "qtd") => {
    const n = round2(valor);
    if (n == null) return;
    fatos.push({ id, valor: n, fonte, fmt });
  };
  push("clientes", clientesTotal, `cadastro de clientes (até ${amostraClientes} registros)`);
  push("financeiro_total", financeiroTotal, `lançamentos financeiros (até ${amostraFinanceiro} registros)`, "brl");
  push("financeiro_count", financeiroCount, `lançamentos financeiros (até ${amostraFinanceiro} registros)`);
  push("financeiro_media", financeiroMedia, `lançamentos financeiros (até ${amostraFinanceiro} registros)`, "brl");
  const entrada = somaTipo(financeiroPorTipo, ["entrada", "receita", "recebido", "credito", "crédito"]);
  const saida = somaTipo(financeiroPorTipo, ["saida", "saída", "despesa", "gasto", "debito", "débito"]);
  push("financeiro_entrada", entrada, `lançamentos financeiros por tipo (até ${amostraFinanceiro} registros)`, "brl");
  push("financeiro_saida", saida, `lançamentos financeiros por tipo (até ${amostraFinanceiro} registros)`, "brl");
  push("agenda", agendaTotal, `agenda (até ${amostraAgenda} registros)`);
  fatos.push({ id: "amostra_clientes", valor: Number(amostraClientes) || 100, fonte: "limite da consulta", fmt: "qtd" });
  fatos.push({ id: "amostra_financeiro", valor: Number(amostraFinanceiro) || 100, fonte: "limite da consulta", fmt: "qtd" });
  fatos.push({ id: "amostra_agenda", valor: Number(amostraAgenda) || 100, fonte: "limite da consulta", fmt: "qtd" });
  return fatos;
}

export function fatoPorId(fatos, id) {
  return (fatos || []).find((f) => f.id === id && f.valor != null) || null;
}

export function formatarComFonte(texto, fonte) {
  const t = String(texto || "").trim();
  const f = String(fonte || "").trim();
  if (!t) return MSG_SEM_FONTE;
  if (!f) return t;
  if (new RegExp(`fonte:\\s*${f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(t)) return t;
  return `${t} Fonte: ${f}.`;
}

export function responderConsultora(pergunta, fatos) {
  const intent = intentConsultora(pergunta);
  if (!intent) return null;
  if (intent === "fora") {
    return { texto: MSG_SEM_FONTE, fonte: "", valor: null, modo: "sem_dado", intent };
  }
  const fato = fatoPorId(fatos, intent === "financeiro_total" ? "financeiro_total" : intent);
  if (!fato) {
    return { texto: MSG_SEM_FONTE, fonte: "", valor: null, modo: "sem_dado", intent };
  }
  const shown = fato.fmt === "brl" ? brl(fato.valor) : String(fato.valor);
  const label = {
    clientes: "Clientes na amostra",
    agenda: "Horários na amostra da agenda",
    financeiro_entrada: "Entradas na amostra",
    financeiro_saida: "Saídas na amostra",
    financeiro_media: "Média dos lançamentos na amostra",
    financeiro_total: "Total dos lançamentos na amostra",
  }[fato.id] || "Valor";
  const texto = formatarComFonte(`${label}: ${shown}.`, fato.fonte);
  return { texto, fonte: fato.fonte, valor: fato.valor, modo: "fato", intent };
}

export function numerosPermitidos(fatos, pergunta) {
  const set = [];
  for (const f of fatos || []) {
    const n = round2(f.valor);
    if (n != null) set.push(n);
  }
  for (const n of extrairNumeros(pergunta)) set.push(n);
  return set;
}

function permitido(n, lista) {
  const x = round2(n);
  if (x == null) return false;
  return lista.some((p) => Math.abs(p - x) < 0.015);
}

export function respostaInventouNumero(texto, fatos, pergunta) {
  const allow = numerosPermitidos(fatos, pergunta);
  return extrairNumeros(texto).some((n) => !permitido(n, allow));
}

/** Se o texto da IA trouxer número fora dos fatos, descarta. */
export function auditarRespostaConsultora(texto, fatos, pergunta) {
  const t = String(texto || "").trim();
  if (!t) return { ok: false, texto: MSG_SEM_FONTE, fonte: "" };
  if (respostaInventouNumero(t, fatos, pergunta)) {
    return { ok: false, texto: MSG_SEM_FONTE, fonte: "" };
  }
  const principal = (fatos || []).find((f) => f.fonte && !String(f.id).startsWith("amostra"));
  return { ok: true, texto: t, fonte: principal?.fonte || "dados pré-agregados da clínica" };
}
