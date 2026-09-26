/**
 * P2-6 — Minha jornada no portal. Só o validado; nunca ia_preliminar.
 */

export function nomePlanoPortal(protocol) {
  if (!protocol || typeof protocol !== "object") return "";
  const n = String(protocol.nome || protocol.name || protocol.title || "").trim();
  if (!n || /ia_preliminar/i.test(n)) return "";
  return n.slice(0, 120);
}

export function proximoPassoJornada({
  today = "",
  cadastroCompleto = false,
  anamneses = [],
  analises = [],
  sessoes = [],
} = {}) {
  const hoje = String(today || "").slice(0, 10);
  const lista = [...(sessoes || [])].filter((s) => s && s.data);
  const futuras = lista
    .filter((s) => String(s.data).slice(0, 10) >= hoje)
    .sort((a, b) => String(a.data).localeCompare(String(b.data)) || String(a.hora || "").localeCompare(String(b.hora || "")));
  const proxima = futuras[0];
  if (proxima) {
    const hora = String(proxima.hora || "").slice(0, 5);
    return {
      estado: "feito",
      detalhe: `Comparecer em ${String(proxima.data).slice(0, 10)} às ${hora}.`,
      hash: "agenda",
    };
  }
  if (!cadastroCompleto) {
    return { estado: "pendente", detalhe: "Complete o cadastro.", hash: "completar-cadastro" };
  }
  if (!(anamneses || []).length) {
    return { estado: "pendente", detalhe: "Preencha a anamnese à distância.", hash: "anamnese" };
  }
  const limpas = (analises || []).map((a) => ({
    status: a?.status || "",
    texto_validado: a?.texto_validado || null,
  }));
  const validadas = limpas.filter((a) => a.texto_validado);
  const aguardando = limpas.filter((a) => a.status === "pending_validation");
  if (aguardando.length && !validadas.length) {
    return {
      estado: "aguardando",
      detalhe: "A clínica está validando sua análise de pele.",
      hash: "analise-pele",
    };
  }
  return {
    estado: "pendente",
    detalhe: "Fale com a clínica para marcar o próximo horário.",
    hash: "agenda",
  };
}

export function buildPortalJornada({
  today = "",
  cadastroCompleto = false,
  anamneses = [],
  analises = [],
  sessoes = [],
  hasSkincare = false,
  protocol = null,
  records = [],
} = {}) {
  const hoje = String(today || "").slice(0, 10);
  const steps = [];

  steps.push({
    id: "cadastro",
    titulo: "Cadastro",
    estado: cadastroCompleto ? "feito" : "pendente",
    detalhe: cadastroCompleto ? "Seus dados estão com a clínica." : "Complete o cadastro pelo link que você recebeu.",
    hash: "completar-cadastro",
  });

  steps.push({
    id: "anamnese",
    titulo: "Anamnese",
    estado: (anamneses || []).length ? "feito" : "disponivel",
    detalhe: (anamneses || []).length
      ? `${anamneses.length} ficha(s) enviada(s).`
      : "Ficha de saúde para a clínica receber antes da consulta.",
    hash: "anamnese",
  });

  const limpas = (analises || []).map((a) => ({
    status: a?.status || "",
    texto_validado: a?.texto_validado || null,
  }));
  const validadas = limpas.filter((a) => a.texto_validado);
  const aguardando = limpas.filter((a) => a.status === "pending_validation");
  let peleEstado = "disponivel";
  let peleDetalhe = "Pré-análise com fotos. Não é diagnóstico; o profissional valida.";
  if (validadas.length) {
    peleEstado = "feito";
    peleDetalhe = "Devolutiva validada pela clínica.";
  } else if (aguardando.length) {
    peleEstado = "aguardando";
    peleDetalhe = "Aguardando validação da clínica.";
  }
  steps.push({
    id: "pele",
    titulo: "Análise de pele",
    estado: peleEstado,
    detalhe: peleDetalhe,
    hash: "analise-pele",
  });

  const nomePlano = nomePlanoPortal(protocol);
  if (nomePlano) {
    steps.push({
      id: "plano",
      titulo: "Plano de tratamento",
      estado: "feito",
      detalhe: nomePlano,
      hash: "evolucao",
    });
  }

  const nRec = (records || []).length;
  steps.push({
    id: "tratamentos",
    titulo: "Orientações",
    estado: nRec ? "feito" : "disponivel",
    detalhe: nRec ? `${nRec} orientação(ões) compartilhada(s) pela clínica.` : "Ainda sem orientação no portal.",
    hash: "",
  });

  const lista = [...(sessoes || [])].filter((s) => s && s.data);
  const futuras = lista
    .filter((s) => String(s.data).slice(0, 10) >= hoje)
    .sort((a, b) => String(a.data).localeCompare(String(b.data)) || String(a.hora || "").localeCompare(String(b.hora || "")));
  const passadas = lista.filter((s) => String(s.data).slice(0, 10) < hoje);
  const proxima = futuras[0];
  let sessaoDetalhe = "Ainda sem horário marcado.";
  if (proxima) {
    const hora = String(proxima.hora || "").slice(0, 5);
    const proc = proxima.procedimento || proxima.name || "sessão";
    const planoTxt =
      proxima.sessao_plano && proxima.sessoes_plano
        ? ` (sessão ${proxima.sessao_plano} de ${proxima.sessoes_plano})`
        : "";
    sessaoDetalhe = `Próxima: ${String(proxima.data).slice(0, 10)} ${hora} — ${proc}${planoTxt}`;
  } else if (passadas.length) {
    sessaoDetalhe = `${passadas.length} sessão(ões) já realizadas.`;
  }
  steps.push({
    id: "sessoes",
    titulo: "Sessões",
    estado: proxima || passadas.length ? "feito" : "disponivel",
    detalhe: sessaoDetalhe,
    hash: "agenda",
  });

  if (hasSkincare) {
    steps.push({
      id: "skincare",
      titulo: "Skincare em casa",
      estado: "feito",
      detalhe: "Rotina liberada pela clínica.",
      hash: "skincare-rotina",
    });
  }

  const prox = proximoPassoJornada({
    today: hoje,
    cadastroCompleto,
    anamneses,
    analises,
    sessoes,
  });
  steps.push({
    id: "proximo",
    titulo: "Próximo passo",
    estado: prox.estado,
    detalhe: prox.detalhe,
    hash: prox.hash,
  });

  return steps;
}

export function jornadaJsonProibido(steps) {
  return /ia_preliminar/i.test(JSON.stringify(steps || []));
}
