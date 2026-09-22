/**
 * P2-5 — Marketing Intelligence: campanha a partir do radar do CRM.
 * Sem envio automático, sem Market Radar (sem fonte), sem inventar R$ de anúncio.
 */

import { prioridadeSinal } from "./crm-fila.js";

export const MKT_MAX_CAMPANHAS = 3;
export const MKT_MINUTOS_POR_CONTATO = 5;
export const MKT_DISCLAIMER =
  "Sugestão operacional, não garantia de resultado nem orçamento aprovado.";
export const MKT_FRASE =
  "Marketing bom atrai o cliente certo, no momento certo, para algo que a clínica consegue entregar.";

const TEMPLATES = {
  pacote: {
    objetivo: "Concluir sessões já contratadas",
    publico: "Clientes com pacote em aberto e sem próximo horário",
    metrica: "Quantos do sinal pacote passaram a ter sessão futura",
    prazo: "7 dias",
    risco: "Tom promocional vira cobrança. Falar em continuidade do tratamento.",
  },
  espera: {
    objetivo: "Encaixar quem já pediu horário",
    publico: "Lista de espera com data desejada",
    metrica: "Saídas da espera com agendamento criado",
    prazo: "7 dias",
    risco: "Oferecer horário que a clínica não tem. Conferir grade antes.",
  },
  nova_sem_2: {
    objetivo: "Convidar ao 2º atendimento",
    publico: "Veio 1 vez e não tem retorno marcado",
    metrica: "2º horário criado / pessoas neste sinal",
    prazo: "14 dias",
    risco: "Oferta genérica. Usar o que foi feito na 1ª sessão.",
  },
  atrasada: {
    objetivo: "Retomar o ritmo pessoal",
    publico: "Já vinha com intervalo estável e atrasou",
    metrica: "Retornos agendados neste sinal",
    prazo: "14 dias",
    risco: "Tratar como inativa. O motivo é o ritmo dela, não uma promoção.",
  },
  sem_proxima: {
    objetivo: "Marcar a próxima sessão de quem já veio",
    publico: "Histórico de visita sem data futura",
    metrica: "Novos horários neste sinal",
    prazo: "14 dias",
    risco: "Campanha de aquisição. Aqui é retenção, não anúncio novo.",
  },
  inativa: {
    objetivo: "Reabrir conversa com quem parou",
    publico: "Sem visita no limiar configurado no CRM",
    metrica: "Respostas e, se fizer sentido, 1 horário",
    prazo: "30 dias",
    risco: "Disparo em massa. A fila do CRM é um clique por pessoa.",
  },
  fidelidade: {
    objetivo: "Reconhecer quem já completou o ciclo de visitas",
    publico: "Clientes no marco de fidelidade",
    metrica: "Contatos feitos / pessoas no marco",
    prazo: "7 dias",
    risco: "Prometer brinde que a clínica não tem. Conferir a política.",
  },
  aniversario: {
    objetivo: "Parabenizar no mês",
    publico: "Aniversariantes do período",
    metrica: "Mensagens enviadas no clique (não automático)",
    prazo: "neste mês",
    risco: "Campanha comercial no aniversário. Pode soar interesseiro.",
  },
};

export function countSinais(rows) {
  const counts = {};
  for (const r of rows || []) {
    const s = r.sinal;
    if (!s) continue;
    counts[s] = (counts[s] || 0) + 1;
  }
  return counts;
}

export function custoContatoTexto(pessoas, minutos = MKT_MINUTOS_POR_CONTATO) {
  const n = Math.max(0, Number(pessoas) || 0);
  if (!n) return "não informado";
  const min = Math.max(1, Number(minutos) || MKT_MINUTOS_POR_CONTATO);
  return `cerca de ${n * min} min de contato (${n} pessoas × ${min} min). Sem verba de anúncio inventada.`;
}

export function buildMarketingCampaigns({
  counts = {},
  espera = 0,
  horariosProximos7d = null,
  limit = MKT_MAX_CAMPANHAS,
} = {}) {
  const merged = { ...counts };
  const esperaN = Math.max(0, Number(espera) || 0);
  if (esperaN > 0) merged.espera = (merged.espera || 0) + esperaN;

  const keys = Object.keys(merged).filter((k) => merged[k] > 0 && TEMPLATES[k]);
  keys.sort(
    (a, b) => prioridadeSinal(b) - prioridadeSinal(a) || merged[b] - merged[a]
  );

  const agendaNota =
    Number.isFinite(Number(horariosProximos7d)) && Number(horariosProximos7d) >= 0
      ? `Já há ${Number(horariosProximos7d)} horário(s) nos próximos 7 dias — não puxar demanda se a grade não couber.`
      : null;

  return keys.slice(0, Math.max(0, limit)).map((sinal) => {
    const t = TEMPLATES[sinal];
    const n = merged[sinal];
    return {
      id: `mkt-${sinal}`,
      sinal,
      objetivo: t.objetivo,
      publico: t.publico,
      tamanhoPublico: n,
      custoEstimado: custoContatoTexto(n),
      metrica: t.metrica,
      prazo: t.prazo,
      risco: agendaNota ? `${t.risco} ${agendaNota}` : t.risco,
      comoMedir: t.metrica,
      canal: "WhatsApp só no clique na fila do CRM. Sem disparo da lista.",
      disclaimer: MKT_DISCLAIMER,
    };
  });
}
