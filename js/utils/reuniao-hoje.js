/**
 * Reunião de hoje: os elos conversam. Número só com fonte. Humano decide.
 * Ciclo: agenda → chegou → feito → baixa → retorno.
 */

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function brl(v) {
  return `R$ ${n(v).toFixed(2).replace(".", ",")}`;
}

function ponto({ titulo, texto, fonte, view = "", elo = "" }) {
  return {
    titulo: String(titulo || "").trim(),
    texto: String(texto || "").trim(),
    fonte: String(fonte || "").trim(),
    view: view || "dashboard",
    elo,
  };
}

/**
 * Gargalo = o elo mais fraco com evidência hoje. Sem evidência, null.
 */
export function gargaloDoCiclo({
  hojeCount = 0,
  atrasos = 0,
  previsto = 0,
  recebido = 0,
  espera = 0,
  inativos = 0,
  analisesPendentes = 0,
  semResponsavel = 0,
} = {}) {
  if (n(atrasos) > 0) {
    return ponto({
      titulo: n(atrasos) === 1 ? "1 horário já passou sem andamento" : `${n(atrasos)} horários já passaram sem andamento`,
      texto: "O gargalo está entre agenda e atendimento: a grade existe, o fluxo na sala não fechou.",
      fonte: "agenda de hoje",
      view: "agenda",
      elo: "chegou",
    });
  }
  if (n(semResponsavel) > 0) {
    return ponto({
      titulo: n(semResponsavel) === 1 ? "1 horário sem responsável" : `${n(semResponsavel)} horários sem responsável`,
      texto: "O gargalo é a atribuição na grade. O sistema não acusa e não bloqueia.",
      fonte: "agenda de hoje",
      view: "agenda",
      elo: "agenda",
    });
  }
  if (n(previsto) > 0 && n(recebido) + 0.009 < n(previsto) * 0.5) {
    return ponto({
      titulo: `Previsto ${brl(previsto)} e recebido ${brl(recebido)}`,
      texto: "O gargalo está na baixa: o dia foi combinado e ainda não virou caixa. O sistema não cobra sozinho.",
      fonte: "previsto da agenda e baixas do financeiro",
      view: "financeiro",
      elo: "baixa",
    });
  }
  if (n(espera) > 0) {
    return ponto({
      titulo: n(espera) === 1 ? "1 pessoa na espera" : `${n(espera)} pessoas na espera`,
      texto: "Há demanda parada. O encaixe sugere; você confirma. WhatsApp não sai daqui.",
      fonte: "lista de espera aberta",
      view: "crm",
      elo: "encaixe",
    });
  }
  if (n(analisesPendentes) > 0) {
    return ponto({
      titulo: n(analisesPendentes) === 1 ? "1 avaliação de pele pendente" : `${n(analisesPendentes)} avaliações de pele pendentes`,
      texto: "O gargalo é a validação clínica: o portal enviou, o olho humano ainda não confirmou.",
      fonte: "análises com status pendente",
      view: "analise-pele",
      elo: "avaliacao",
    });
  }
  if (n(inativos) > 0) {
    return ponto({
      titulo: n(inativos) === 1 ? "1 pessoa sem retorno recente" : `${n(inativos)} pessoas sem retorno recente`,
      texto: "O gargalo é o ciclo depois da sessão. Mensagem só se você clicar.",
      fonte: "CRM inativos ≥90 dias",
      view: "crm",
      elo: "retorno",
    });
  }
  if (n(hojeCount) === 0) {
    return ponto({
      titulo: "Agenda de hoje vazia",
      texto: "Sem horário no dia, não há o que comparar com ontem. O próximo passo é preencher a grade.",
      fonte: "agenda de hoje",
      view: "agenda",
      elo: "agenda",
    });
  }
  return null;
}

export function pontoForteHoje({
  hojeCount = 0,
  confirmados = 0,
  atrasos = 0,
  previsto = 0,
  recebido = 0,
  lucroHora = null,
} = {}) {
  if (n(hojeCount) > 0 && n(confirmados) > 0 && n(atrasos) === 0) {
    return ponto({
      titulo: n(confirmados) === 1 ? "1 horário no ritmo" : `${n(confirmados)} horários no ritmo`,
      texto: "Chegada ou confirmação em dia, sem atraso na grade de hoje.",
      fonte: "agenda de hoje",
      view: "agenda",
      elo: "chegou",
    });
  }
  if (n(previsto) > 0 && n(recebido) + 0.009 >= n(previsto) * 0.9) {
    return ponto({
      titulo: `Recebido ${brl(recebido)} perto do previsto ${brl(previsto)}`,
      texto: "O combinado do dia está virando caixa. Fonte só das baixas, não de mercado.",
      fonte: "previsto da agenda e baixas do financeiro",
      view: "financeiro",
      elo: "baixa",
    });
  }
  if (n(hojeCount) === 0) return null;
  const melhor = lucroHora?.melhor;
  if (melhor?.name && melhor.lucroHora != null) {
    return ponto({
      titulo: `${melhor.name} é o mais forte em lucro/hora no cadastro`,
      texto: `Estimativa ${brl(melhor.lucroHora)}/h com preço, duração e material cadastrados. O sistema não altera o preço.`,
      fonte: "cadastro de procedimentos",
      view: "procedimento",
      elo: "catalogo",
    });
  }
  return null;
}

export function pontoFracoHoje({ atencao = [], oportunidades = [], gargalo = null } = {}) {
  const cards = [...(atencao || []), ...(oportunidades || [])].filter((c) => c && c.title);
  cards.sort((a, b) => n(b.score) - n(a.score));
  const top = cards[0];
  if (top) {
    return ponto({
      titulo: top.title,
      texto: [top.causa, top.impacto].filter(Boolean).join(" "),
      fonte: top.fonte || "",
      view: top.view || "dashboard",
      elo: top.theme || "",
    });
  }
  if (gargalo) return gargalo;
  return null;
}

export function diaCalmoHoje({
  hojeCount = 0,
  atrasos = 0,
  previsto = 0,
  recebido = 0,
} = {}) {
  return n(hojeCount) === 0 && n(atrasos) === 0 && n(previsto) < 0.01 && n(recebido) < 0.01;
}

export function montarReuniaoHoje(input = {}) {
  if (diaCalmoHoje(input)) {
    const espera = n(input.espera);
    return {
      modo: "calmo",
      titulo: "Hoje está calmo",
      lead: espera > 0
        ? "Não tem horário hoje. Tem gente na espera — você decide o encaixe."
        : "Não tem ninguém na agenda hoje.",
      forte: null,
      fraco: null,
      gargalo: null,
      proximo: { acao: "Marcar horário", view: "agenda" },
      fila: { acao: "Ver a fila", view: "crm" },
    };
  }
  const gargalo = gargaloDoCiclo(input);
  const forte = pontoForteHoje(input);
  const fraco = pontoFracoHoje({
    atencao: input.atencao,
    oportunidades: input.oportunidades,
    gargalo,
  });
  const proximo = gargalo || fraco;
  return {
    modo: "rotina",
    titulo: "Reunião de hoje",
    lead: "Sem WhatsApp automático. O preço não muda sozinho.",
    forte,
    fraco: fraco && gargalo && fraco.titulo === gargalo.titulo ? null : fraco && forte && fraco.titulo === forte.titulo ? null : fraco,
    gargalo,
    proximo: proximo
      ? { acao: `Abrir ${proximo.view === "crm" ? "o Relacionamento" : proximo.view === "agenda" ? "a agenda" : "a tela"} e decidir o próximo passo.`, view: proximo.view }
      : { acao: "Nada urgente com fonte. Bom sinal — confira a agenda mesmo assim.", view: "agenda" },
  };
}

export function textoContextoReuniao(reuniao = {}) {
  const r = reuniao || {};
  return [
    r.forte ? `Ponto forte: ${r.forte.titulo}. ${r.forte.texto} Fonte: ${r.forte.fonte}.` : "Ponto forte: não informado nesta amostra.",
    r.fraco ? `Ponto fraco: ${r.fraco.titulo}. ${r.fraco.texto} Fonte: ${r.fraco.fonte}.` : "",
    r.gargalo ? `Gargalo: ${r.gargalo.titulo}. ${r.gargalo.texto} Fonte: ${r.gargalo.fonte}.` : "",
    r.proximo ? `Próximo passo humano: ${r.proximo.acao}` : "",
    "Explique estes elos. Não grave, não mude preço, não mande WhatsApp, não invente número.",
  ]
    .filter(Boolean)
    .join("\n");
}
