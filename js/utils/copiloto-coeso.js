/**
 * Copiloto barato e coeso: fato da clínica primeiro; modelo só se faltar.
 * Não inventa artigo. Não decide. Não grava.
 */

export const MAX_PERGUNTA_COPILOTO = 280;

export function truncarPerguntaCopiloto(s) {
  const t = String(s || "").trim().replace(/\s+/g, " ");
  if (t.length <= MAX_PERGUNTA_COPILOTO) return t;
  return t.slice(0, MAX_PERGUNTA_COPILOTO);
}

export function explicarFichaLocal(mensagem = "") {
  const linhas = String(mensagem || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/não grave preço/i.test(l));
  const corpo = linhas.length ? linhas.join("\n") : "Esta ficha ainda não tem combinado, receita nem feito registrados.";
  return `${corpo}\n\nIsso é o registro da clínica, não um artigo. O próximo passo é humano. Pergunte um campo se quiser — sem inventar número nem paper.`;
}

export function respostaLocalCopiloto({ pergunta = "", contexto = {} } = {}) {
  const q = String(pergunta || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (contexto.origem === "ficha" && (q.includes("expli") || q.includes("resumo") || q.includes("ciclo"))) {
    return explicarFichaLocal(contexto.mensagem);
  }
  if (contexto.origem === "reuniao" && (q.includes("expli") || q.includes("gargalo") || q.includes("forte") || q.includes("fraco"))) {
    return explicarFichaLocal(contexto.mensagem);
  }
  return null;
}

export function deveChamarModeloCopiloto({ consultora = null, origemFicha = false, local = null } = {}) {
  if (local) return false;
  if (consultora && !origemFicha) return false;
  return true;
}
