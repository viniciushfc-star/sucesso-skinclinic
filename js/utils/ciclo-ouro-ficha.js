/**
 * Ficha: plano (combinado) ≠ protocolo (receita) ≠ aplicado (feito).
 * Não altera preço e não trava atendimento.
 */

import { sugerirProximaAcaoNaBaixa } from "./ciclo-ouro.js";
import { previstoVsRealizado } from "./comissao-apuracao.js";

function nome(s) {
  return String(s || "").trim();
}

function uniqueNomes(list) {
  const seen = new Set();
  const out = [];
  for (const n of list) {
    const t = nome(n);
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function sessoesRestantesPacote(p) {
  if (p?.sessoes_restantes != null) return Math.max(0, Number(p.sessoes_restantes) || 0);
  return Math.max(0, (Number(p?.total_sessoes) || 0) - (Number(p?.sessoes_utilizadas) || 0));
}

function pacotePagoAdiantado(p) {
  const v = Number(p?.valor_pago);
  return Number.isFinite(v) && v > 0;
}

function produtosDoAplicado(a) {
  return Array.isArray(a?.produtos_usados)
    ? a.produtos_usados.map((p) => nome(p?.produto_nome)).filter(Boolean)
    : [];
}

/**
 * @returns {{ colunas: Array<{ id: string, titulo: string, itens: string[], vazio: string }> }}
 */
export function slotPendenteDoPlano(planosCliente = [], aplicados = []) {
  const feitos = new Set((aplicados || []).map((a) => a.agenda_id).filter(Boolean));
  const slots = (planosCliente || []).flatMap((p) => p.sessoes || []).filter((s) => s?.id);
  const pendente = slots.filter((s) => !feitos.has(s.id));
  if (!pendente.length) return null;
  return [...pendente].sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")))[0];
}

export function rotuloPacoteCombinado(p) {
  const n = nome(p?.nome_pacote || p?.procedure_name || p?.nome);
  if (!n) return "";
  const rest = sessoesRestantesPacote(p);
  const total = Number(p?.total_sessoes) || 0;
  if (total > 0) {
    return rest > 0 ? `Pacote: ${n} (${rest} restante${rest === 1 ? "" : "s"})` : `Pacote: ${n} (encerrado)`;
  }
  return `Pacote: ${n}`;
}

export function aplicadoSemMaterial(aplicados = []) {
  return (aplicados || []).some((a) => {
    if (!(nome(a?.descricao) || a?.protocolo_id)) return false;
    return produtosDoAplicado(a).length === 0;
  });
}

export function sinaisInicioCiclo({ anamnese = [], analises = [] } = {}) {
  const temAnamnese = (anamnese || []).length > 0;
  const list = analises || [];
  const peleOk = list.some((a) => String(a?.status || "").toLowerCase() === "validated" || nome(a?.texto_validado));
  const pelePend = list.some((a) => /pending/i.test(String(a?.status || "")));
  return {
    anamnese: temAnamnese ? "Anamnese ok" : "Anamnese pendente",
    anamneseOk: temAnamnese,
    pele: peleOk ? "Avaliação ok" : pelePend ? "Avaliação pendente" : "Sem avaliação",
    peleOk,
  };
}

/**
 * Um passo: registrar feito, conferir baixa, ou oferecer próximo horário.
 * Pacote pago adiantado não pede cobrar por sessão.
 */
export function proximaAcaoCicloFicha({
  planosCliente = [],
  pacotes = [],
  aplicados = [],
  lancamentos = [],
  temAgendaFutura = false,
  today = "",
} = {}) {
  const slot = slotPendenteDoPlano(planosCliente, aplicados);
  if (slot?.id) {
    return { tipo: "registrar", agendaId: slot.id, data: slot.data, hora: slot.hora };
  }

  const byAgenda = new Map();
  for (const l of lancamentos || []) {
    if (l?.agenda_id) byAgenda.set(l.agenda_id, l);
  }
  const temPacotePago = (pacotes || []).some(pacotePagoAdiantado);

  for (const a of aplicados || []) {
    const aid = a?.agenda_id;
    if (!aid) continue;
    const lanc = byAgenda.get(aid);
    if (lanc) {
      const aberto = previstoVsRealizado({ valor: lanc.valor, valorRecebido: lanc.valor_recebido });
      if (aberto.emAberto) {
        return { tipo: "baixa", agendaId: aid, aberto: aberto.aberto };
      }
      continue;
    }
    if (!temPacotePago) {
      return { tipo: "baixa", agendaId: aid };
    }
  }

  const aberto = (pacotes || []).find((p) => sessoesRestantesPacote(p) > 0);
  if (aberto) {
    const sug = sugerirProximaAcaoNaBaixa({
      sessoesRestantes: sessoesRestantesPacote(aberto),
      temAgendaFutura,
      dataAtual: today,
    });
    if (sug.oferecer) {
      return {
        tipo: "proxima",
        titulo: sug.titulo,
        dataSugerida: sug.dataSugerida,
        pacoteId: aberto.id,
      };
    }
  }

  return { tipo: null };
}

export function resumoCicloOuroFicha({ planosCliente = [], protocolos = [], aplicados = [], pacotes = [] } = {}) {
  const planos = uniqueNomes([
    ...(planosCliente || []).map((p) => p.nome || p.name),
    ...(pacotes || []).map(rotuloPacoteCombinado),
  ]);
  const receitas = uniqueNomes([
    ...(planosCliente || []).flatMap((p) => (p.sessoes || []).map((s) => s.procedimento)),
    ...(pacotes || []).map((p) => p.procedure_name),
    ...(aplicados || []).map((a) => a?.protocolos?.nome),
    ...(protocolos || []).filter((p) => (aplicados || []).some((a) => a.protocolo_id && a.protocolo_id === p.id)).map((p) => p.nome),
  ]);
  const feitos = uniqueNomes(
    (aplicados || []).flatMap((a) => {
      const proto = a?.protocolos?.nome;
      const desc = nome(a?.descricao).slice(0, 80);
      return [proto || desc, ...produtosDoAplicado(a)];
    })
  );
  return {
    colunas: [
      {
        id: "plano",
        titulo: "Plano — combinado",
        itens: planos,
        vazio: "Nenhum plano terapêutico nem pacote combinado nesta ficha.",
      },
      {
        id: "protocolo",
        titulo: "Protocolo — receita",
        itens: receitas,
        vazio: "Nenhuma receita neste plano (procedimento da sessão ou protocolo cadastrado).",
      },
      {
        id: "aplicado",
        titulo: "Aplicado — feito",
        itens: feitos,
        vazio: "Ainda não há registro do que foi feito.",
      },
    ],
  };
}

function trechoColuna(col) {
  const itens = col?.itens || [];
  if (!itens.length) return "—";
  if (itens.length === 1) return itens[0];
  return `${itens[0]} (+${itens.length - 1})`;
}

/** Uma linha no cabeçalho do perfil. Não substitui as três colunas. */
export function linhaCicloOuroCabecalho(resumo) {
  const cols = resumo?.colunas || [];
  const byId = Object.fromEntries(cols.map((c) => [c.id, c]));
  return {
    combinado: trechoColuna(byId.plano),
    receita: trechoColuna(byId.protocolo),
    feito: trechoColuna(byId.aplicado),
  };
}
