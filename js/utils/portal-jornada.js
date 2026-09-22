/**
 * P2-6 — Minha jornada no portal. Só o validado; nunca ia_preliminar.
 */

export function buildPortalJornada({
  today = "",
  cadastroCompleto = false,
  anamneses = [],
  analises = [],
  sessoes = [],
  hasSkincare = false,
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
    const plano =
      proxima.sessao_plano && proxima.sessoes_plano
        ? ` (sessão ${proxima.sessao_plano} de ${proxima.sessoes_plano})`
        : "";
    sessaoDetalhe = `Próxima: ${String(proxima.data).slice(0, 10)} ${hora} — ${proc}${plano}`;
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

  steps.push({
    id: "proximo",
    titulo: "Próximo passo",
    estado: proxima ? "feito" : "pendente",
    detalhe: proxima
      ? `Comparecer em ${String(proxima.data).slice(0, 10)} às ${String(proxima.hora || "").slice(0, 5)}.`
      : "Agende um horário ou fale com a clínica.",
    hash: "agenda",
  });

  return steps;
}

export function jornadaJsonProibido(steps) {
  return /ia_preliminar/i.test(JSON.stringify(steps || []));
}
