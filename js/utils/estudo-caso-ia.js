/**
 * Estudo de caso: aprende com o que a clínica registrou.
 * Artigo só se o profissional colar o texto. Sem DOI inventado.
 */

export const SISTEMA_ESTUDO_CASO = `Você apoia o estudo do profissional. Não substitui julgamento clínico.
REGRAS:
- Use só o caso/anotação enviada. Não invente DOI, autor, ano, revista nem resultado de paper.
- Se o texto do artigo não veio na mensagem, diga que não leu o artigo e sugira termos de busca (PubMed, Scholar).
- Não decida tratamento, não mude preço, não mande WhatsApp.
- Resposta curta, em markdown.`;

export function promptEstudoCasoPergunta({ caso_resumo, pergunta, artigo_contexto, tipo } = {}) {
  const perguntaText = String(pergunta || "").trim();
  const isEsclarecer = tipo === "esclarecer";
  const contextoArtigo = String(artigo_contexto || "").trim();
  if (isEsclarecer) {
    return `O profissional quer esclarecer uma dúvida.
${contextoArtigo ? `Texto ou tema colado por ele:\n${contextoArtigo.slice(0, 1200)}\n\n` : "Nenhum texto de artigo foi colado.\n\n"}
Dúvida:\n${perguntaText}
Não invente paper. Se não colou o artigo, não finja que leu.`;
  }
  const r = caso_resumo && typeof caso_resumo === "object" ? caso_resumo : {};
  const resumo = `Tipo de pele: ${r.tipo_pele || "—"}\nFototipo: ${r.fototipo || "—"}\nQueixa: ${r.queixa_principal || "—"}\nResposta observada na clínica: ${r.resposta_observada || "—"}\nSessões: ${r.n_sessoes ?? "—"}\nObservação: ${r.observacao || "—"}`;
  return `Caso anonimizado registrado nesta clínica:\n---\n${resumo}\n---\nPergunta:\n${perguntaText}\nRelate ao caso. Não invente artigo.`;
}

export function promptEstudoCasoEsclarecer({ tema, duvida } = {}) {
  const t = String(tema || "").trim();
  const d = String(duvida || "").trim();
  return `Dúvida após leitura.
${t ? `Tema ou trecho colado:\n---\n${t.slice(0, 1200)}\n---\n` : "Nenhum artigo foi colado.\n"}
Dúvida:\n---\n${d}\n---
Não invente paper. Se não colou o texto, oriente a busca. Aplicação prática é do profissional.`;
}
