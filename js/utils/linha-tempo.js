/**
 * Linha do tempo do prontuário: clínica (interno) vs o que veio do portal.
 * Não inclui rascunho de IA (ia_preliminar).
 */

import { statusEfetivoOrcamento, statusOrcamentoLabel, idsOrcamentosVistos, contarPacotesPorOrcamento } from "./orcamento.js";
import { mapaVersaoAnamnese } from "./anamnese-versao.js";
import { tituloCombinadoNaLinha } from "./consulta-combinado.js";
import { tituloPlanoFichaNaLinha } from "./plano-ficha.js";
import {
  TIPO_SESSAO_PRONTUARIO,
  aplicadoECritico,
  detalheAplicadoProntuario,
  tituloSessaoNaLinha,
} from "./prontuario-sessao.js";

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
  pacotes = [],
  hoje,
} = {}) {
  const out = [];
  const vistos = idsOrcamentosVistos(events);
  const pkgMap = contarPacotesPorOrcamento(pacotes);
  const agendasAplicadas = new Set((aplicados || []).map((a) => a.agenda_id).filter(Boolean).map(String));

  for (const e of events || []) {
    if (String(e.event_type || "") === "orcamento_visto") continue;
    const agendaEv = e.metadata?.agenda_id != null ? String(e.metadata.agenda_id) : "";
    if (String(e.event_type || "") === TIPO_SESSAO_PRONTUARIO && agendaEv && agendasAplicadas.has(agendaEv)) continue;
    const blob = `${e.event_type || ""} ${e.description || ""}`;
    if (temIaPreliminar(blob)) continue;
    out.push({
      date: dateKey(e.event_date || e.created_at),
      visibilidade: e.created_by_client ? "portal" : "interno",
      fonte: "evento",
      titulo: tituloSessaoNaLinha(e.event_type) || tituloPlanoFichaNaLinha(e.event_type) || tituloCombinadoNaLinha(e.event_type),
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
    const nome = a.protocolos?.nome || String(a.descricao || "").trim().slice(0, 48) || "O que foi aplicado";
    const detalhe = detalheAplicadoProntuario(a).slice(0, 240);
    out.push({
      date: dateKey(a.aplicado_em),
      visibilidade: "interno",
      fonte: "aplicado",
      titulo: nome,
      detalhe,
      critico: aplicadoECritico(a),
    });
  }

  for (const o of orcamentos || []) {
    const st = statusEfetivoOrcamento(o, hoje, {
      visto: vistos.has(o.id),
      packagesCount: pkgMap[o.id] || 0,
    });
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
