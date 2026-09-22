/**
 * P2-9 — Market Radar: só com fonte completa. Não inventa concorrente. Não define preço.
 */

export const CONF_OK = ["baixa", "media", "alta"];

export function isFonteCompleta(row) {
  if (!row || typeof row !== "object") return false;
  if (!String(row.procedimento || "").trim()) return false;
  if (!String(row.regiao || "").trim()) return false;
  if (!String(row.fonte || "").trim()) return false;
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(row.data_ref || ""))) return false;
  if (!String(row.metodologia || "").trim()) return false;
  if (!CONF_OK.includes(String(row.confianca || "").toLowerCase())) return false;
  const amostra = Number(row.amostra);
  if (!Number.isFinite(amostra) || amostra < 1) return false;
  const min = Number(row.preco_min);
  const max = Number(row.preco_max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) return false;
  return true;
}

export function compararPreco(precoClinica, precoMin, precoMax) {
  const p = Number(precoClinica);
  const min = Number(precoMin);
  const max = Number(precoMax);
  if (!Number.isFinite(p) || p <= 0) return { posicao: "sem_preco_clinica", delta: null };
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { posicao: "sem_faixa", delta: null };
  if (p < min) return { posicao: "abaixo", delta: Math.round((min - p) * 100) / 100 };
  if (p > max) return { posicao: "acima", delta: Math.round((p - max) * 100) / 100 };
  return { posicao: "na_faixa", delta: 0 };
}

export function copyComparacao({ posicao, fonte, regiao, dataRef }) {
  const meta = `${fonte}, ${regiao}, ${dataRef}`;
  if (posicao === "abaixo") {
    return `O preço da clínica está abaixo da referência observada (${meta}). Custo, posicionamento ou mix podem justificar.`;
  }
  if (posicao === "acima") {
    return `O preço da clínica está acima da referência observada (${meta}). Custo, posicionamento ou mix podem justificar.`;
  }
  if (posicao === "na_faixa") {
    return `O preço da clínica está na faixa da referência observada (${meta}).`;
  }
  return "Sem preço da clínica ou sem faixa completa — o radar não compara.";
}
