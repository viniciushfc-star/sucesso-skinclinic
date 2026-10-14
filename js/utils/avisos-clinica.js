/**
 * Avisos da clínica: fato da operação, com org. Sem WhatsApp em massa. Sem IA.
 */

export const TITULO_AVISO = {
  sem_responsavel: "Agendamentos sem responsável",
  espera: "Pessoas na lista de espera",
};

export function recusarAvisoSemOrg(orgId) {
  return !String(orgId || "").trim();
}

export function deveCriarAviso({ qtd = 0, jaExisteNaoLida = false } = {}) {
  return Number(qtd) > 0 && !jaExisteNaoLida;
}

export function mensagemAviso(tipo, qtd) {
  const n = Math.max(0, Number(qtd) || 0);
  if (tipo === "sem_responsavel") {
    return `${n} horário(s) nos próximos 7 dias ainda sem responsável. Atribua na agenda. O sistema não acusa e não bloqueia.`;
  }
  if (tipo === "espera") {
    return `${n} pessoa(s) na espera. Quando abrir vaga, o encaixe sugere; você confirma. WhatsApp não sai daqui.`;
  }
  return "";
}
