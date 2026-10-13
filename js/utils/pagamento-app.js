/**
 * Cobrança pelo app. Só cobra de verdade com flag + chave da parceria.
 * Não inventa preço. Não lança no caixa sozinho.
 */

export const MSG_PARCERIA =
  "A cobrança pelo app só liga quando houver parceria com as maquininhas. Até lá, registre no caixa como hoje.";

export const METODOS_COBRANCA = ["pix", "credito", "debito"];

/** Passos que a clínica vê. Cobrar de verdade só no passo 2, com parceria. */
export const JORNADA_COBRANCA = [
  {
    id: "valor",
    titulo: "A clínica informa o valor",
    texto: "O preço continua sendo o da tabela de vocês. O app não sugere nem grava sozinho.",
  },
  {
    id: "maquininha",
    titulo: "A maquininha parceira cobra",
    texto: "Ofertas promocionais para quem usa o app. Mercado: 1% por parcela. No SkinClinic a taxa de uso é menor.",
  },
  {
    id: "paciente",
    titulo: "O paciente paga o mesmo",
    texto: "Não paga a mais por usar o app. A vantagem é da clínica, na taxa e nas ofertas da maquininha.",
  },
  {
    id: "caixa",
    titulo: "A equipe confirma no caixa",
    texto: "Quando cair, alguém registra a entrada. Nada entra no financeiro sozinho.",
  },
];

export function montarInteresse(input = {}) {
  const volume = input.volume_mensal != null && input.volume_mensal !== "" ? Number(input.volume_mensal) : null;
  if (volume != null && (!Number.isFinite(volume) || volume < 0)) {
    throw new Error("Volume mensal, se informar, precisa ser um número.");
  }
  return {
    status: "interesse",
    volume_mensal: volume,
    recado: String(input.recado || "").trim().slice(0, 400),
  };
}

export function parceriaPagamentoAtiva(env = {}) {
  const ligar = String(env.PAGAMENTO_APP_ENABLED || "").toLowerCase() === "true";
  const chave = String(env.PAGAMENTO_PARCEIRO_KEY || env.PAGAMENTO_PARCEIRO_SECRET || "").trim();
  return ligar && chave.length >= 8;
}

export function recusarSemParceria(env = {}) {
  if (parceriaPagamentoAtiva(env)) return null;
  return MSG_PARCERIA;
}

/**
 * @param {object} input
 * @returns {{ valor: number, metodo: string, parcelas: number, client_id: string|null, agenda_id: string|null, descricao: string, status: string }}
 */
export function montarCobranca(input = {}, parcelasMax = 12) {
  const valor = Number(input.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error("Informe um valor maior que zero. O app não inventa o preço.");
  }
  const metodo = String(input.metodo || "pix").toLowerCase();
  if (!METODOS_COBRANCA.includes(metodo)) {
    throw new Error("Escolha PIX, crédito ou débito.");
  }
  let parcelas = 1;
  if (metodo === "credito") {
    parcelas = Math.min(Math.max(1, Number(input.parcelas) || 1), parcelasMax);
  }
  return {
    valor: Math.round(valor * 100) / 100,
    metodo,
    parcelas,
    client_id: input.client_id || input.clientId || null,
    agenda_id: input.agenda_id || input.agendaId || null,
    descricao: String(input.descricao || "Cobrança pelo app").slice(0, 200),
    status: "aguardando_parceiro",
  };
}
