/**
 * Linha do tempo do prontuário: clínica (interno) vs o que veio do portal.
 * Não inclui rascunho de IA (ia_preliminar).
 */

import { statusEfetivoOrcamento, statusOrcamentoLabel } from "./orcamento.js";
import { mapaVersaoAnamnese } from "./anamnese-versao.js";
import { tituloCombinadoNaLinha } from "./consulta-combinado.js";

function dateKey(d) {
  if (!d) return "";
  const s = typeof d === "string" ? d : d.toISOString ? d.toISOString() : String(d);
  return s.slice(0, 10);
}

function temIaPreliminar(s) {
  return /ia_preliminar/i.test(String(s || ""));
}

export function visibilidadeAnamnese(origem) {
  return String(origem || "clinica").toLowerCase() === "portal" ? "portal" : "interno";
}

/**
 * @returns {Array<{ date: string, visibilidade: string, fonte: string, titulo: string, detalhe: string, critico: boolean }>}
 */
export function montarLinhaDoTempo({
  events = [],
  anamnese = [],
  aplicados = [],
  orcamentos = [],
  hoje,
} = {}) {
  const out = [];

  for (const e of events || []) {
    const blob = `${e.event_type || ""} ${e.description || ""}`;
    if (temIaPreliminar(blob)) continue;
    out.push({
      date: dateKey(e.event_date || e.created_at),
      visibilidade: e.created_by_client ? "portal" : "interno",
      fonte: "evento",
      titulo: tituloCombinadoNaLinha(e.event_type),
      detalhe: String(e.description || "").trim(),
      critico: !!e.is_critical,
    });
  }

  const versoesAnamnese = mapaVersaoAnamnese(anamnese);

  for (const r of anamnese || []) {
    if (temIaPreliminar(r.conteudo) || temIaPreliminar(r.resultado_resumo)) continue;
    const nome = r.anamnesis_funcoes?.nome || "Anamnese";
    const resumo = String(r.conteudo || r.resultado_resumo || "").trim().slice(0, 80);
    const versao = versoesAnamnese[r.id];
    out.push({
      date: dateKey(r.created_at),
      visibilidade: visibilidadeAnamnese(r.origem),
      fonte: "anamnese",
      titulo: versao?.n ? `${nome} · v${versao.n}` : nome,
      detalhe: resumo,
      critico: false,
    });
  }

  for (const a of aplicados || []) {
    const nome = a.protocolos?.nome || "Protocolo aplicado";
    const desc = String(a.descricao || "").trim().slice(0, 80);
    out.push({
      date: dateKey(a.aplicado_em),
      visibilidade: "interno",
      fonte: "aplicado",
      titulo: nome,
      detalhe: desc,
      critico: false,
    });
  }

  for (const o of orcamentos || []) {
    const st = statusEfetivoOrcamento(o, hoje);
    const when = o.accepted_at || o.sent_at || o.created_at;
    out.push({
      date: dateKey(when),
      visibilidade: "interno",
      fonte: "orcamento",
      titulo: `Orçamento · ${statusOrcamentoLabel(st)}`,
      detalhe: "",
      critico: false,
    });
  }

  return out
    .filter((x) => x.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.titulo).localeCompare(String(b.titulo), "pt"));
}
