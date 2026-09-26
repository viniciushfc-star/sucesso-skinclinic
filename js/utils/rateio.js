/**
 * Rateio de custo fixo. Padrão: não ratear. Sem denominador → não informado.
 * Não altera preço.
 */

export const RATEIO_METODOS = [
  { id: "nao_ratear", label: "Não ratear (fica só no DRE da clínica)" },
  { id: "hora", label: "Por hora disponível" },
  { id: "atendimento", label: "Por atendimento realizado no mês" },
  { id: "sala", label: "Por hora de sala (salas × horas)" },
  { id: "capacidade", label: "Por capacidade teórica do mês" },
];

function n(v) {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? x : null;
}

function n0(v) {
  if (v == null || v === "") return 0;
  const x = Number(v);
  return Number.isFinite(x) && x >= 0 ? x : 0;
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

export function labelRateio(metodo) {
  return RATEIO_METODOS.find((m) => m.id === metodo)?.label || "não informado";
}

export function horasDoProcedimento(durationMinutes) {
  return Math.max(0.05, (Number(durationMinutes) || 60) / 60);
}

/**
 * Ocupação do período. Só calcula se o denominador existir. Cancelados não entram na agenda.
 */
export function ocupacaoRateio({ metodo, minutosAgenda, nAtendimentos, horasMes, nSalas, capacidadeMes } = {}) {
  const min = n0(minutosAgenda);
  const at = n0(nAtendimentos);
  if (metodo === "hora") {
    const h = n(horasMes);
    if (!h) return { pct: null, detalhe: "Informe as horas disponíveis no mês." };
    const usadas = min / 60;
    return { pct: round2((usadas / h) * 100), detalhe: `${usadas.toFixed(1)} h agendadas ÷ ${h} h disponíveis.` };
  }
  if (metodo === "sala") {
    const h = n(horasMes);
    const salas = n(nSalas);
    if (!h || !salas) return { pct: null, detalhe: "Informe horas do mês e cadastre salas." };
    const denom = salas * h;
    const usadas = min / 60;
    return { pct: round2((usadas / denom) * 100), detalhe: `${usadas.toFixed(1)} h ÷ (${salas} salas × ${h} h).` };
  }
  if (metodo === "capacidade") {
    const cap = n(capacidadeMes);
    if (!cap) return { pct: null, detalhe: "Informe a capacidade teórica do mês." };
    return { pct: round2((at / cap) * 100), detalhe: `${at} atendimento(s) ÷ ${cap} sessões teóricas.` };
  }
  if (metodo === "atendimento") {
    return { pct: null, detalhe: "Este método divide o fixo igualmente por sessão realizada. Sem % de ocupação." };
  }
  return { pct: null, detalhe: "Fixo fica no DRE, sem rateio no procedimento." };
}

/**
 * Custo estrutural de uma sessão. valor null = não informado (não inventa).
 */
export function calcularRateio({
  metodo,
  fixoMes,
  durationMinutes = 60,
  horasMes,
  nAtendimentos,
  nSalas,
  capacidadeMes,
} = {}) {
  const metodoId = RATEIO_METODOS.some((m) => m.id === metodo) ? metodo : "nao_ratear";
  const metodoLabel = labelRateio(metodoId);
  if (metodoId === "nao_ratear") {
    return {
      valor: null,
      metodo: metodoId,
      metodoLabel,
      detalhe: "A clínica escolheu não ratear fixo no procedimento. O valor aparece no DRE.",
    };
  }
  const fixo = n(fixoMes);
  if (!fixo) {
    return {
      valor: null,
      metodo: metodoId,
      metodoLabel,
      detalhe: "Não há lançamentos de custo fixo neste período. Sem isso o rateio fica não informado.",
    };
  }
  const horasProc = horasDoProcedimento(durationMinutes);

  if (metodoId === "hora") {
    const horas = n(horasMes);
    if (!horas) {
      return { valor: null, metodo: metodoId, metodoLabel, detalhe: "Informe as horas disponíveis no mês." };
    }
    return {
      valor: round2((fixo / horas) * horasProc),
      metodo: metodoId,
      metodoLabel,
      detalhe: `R$ ${fixo.toFixed(2)} ÷ ${horas} h × ${horasProc.toFixed(2)} h deste procedimento.`,
    };
  }

  if (metodoId === "atendimento") {
    const nAt = n(nAtendimentos);
    if (!nAt) {
      return {
        valor: null,
        metodo: metodoId,
        metodoLabel,
        detalhe: "Não há agendamentos ativos neste período para ratear (cancelados não entram).",
      };
    }
    return {
      valor: round2(fixo / nAt),
      metodo: metodoId,
      metodoLabel,
      detalhe: `R$ ${fixo.toFixed(2)} ÷ ${nAt} atendimento(s) ativos (mesmo valor por sessão, independente da duração).`,
    };
  }

  if (metodoId === "sala") {
    const horas = n(horasMes);
    if (!horas) {
      return {
        valor: null,
        metodo: metodoId,
        metodoLabel,
        detalhe: "Informe as horas disponíveis no mês (base da hora de sala).",
      };
    }
    const salas = n(nSalas);
    if (!salas) {
      return { valor: null, metodo: metodoId, metodoLabel, detalhe: "Cadastre ao menos uma sala para ratear por hora de sala." };
    }
    const denom = salas * horas;
    return {
      valor: round2((fixo / denom) * horasProc),
      metodo: metodoId,
      metodoLabel,
      detalhe: `R$ ${fixo.toFixed(2)} ÷ (${salas} salas × ${horas} h) × ${horasProc.toFixed(2)} h.`,
    };
  }

  if (metodoId === "capacidade") {
    const cap = n(capacidadeMes);
    if (!cap) {
      return {
        valor: null,
        metodo: metodoId,
        metodoLabel,
        detalhe: "Informe a capacidade teórica (sessões possíveis no mês).",
      };
    }
    return {
      valor: round2(fixo / cap),
      metodo: metodoId,
      metodoLabel,
      detalhe: `R$ ${fixo.toFixed(2)} ÷ ${cap} sessões teóricas.`,
    };
  }

  return { valor: null, metodo: metodoId, metodoLabel, detalhe: "Método não informado." };
}

/** Simula os métodos com os mesmos dados. Não escolhe preço. */
export function simularMetodosRateio(base = {}) {
  return RATEIO_METODOS.map((m) => calcularRateio({ ...base, metodo: m.id }));
}
