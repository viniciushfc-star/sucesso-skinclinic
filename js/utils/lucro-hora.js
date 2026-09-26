/**
 * P2-7 — lucro/hora estimado. Não altera preço. Sem dado → não informado.
 */

export function lucroHoraEstimado({
  preco,
  durationMinutes,
  custoMaterialEstimado = null,
} = {}) {
  const p = Number(preco);
  const min = Number(durationMinutes);
  if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(min) || min <= 0) return null;
  const matRaw = Number(custoMaterialEstimado);
  const material = Number.isFinite(matRaw) && matRaw > 0 ? matRaw : 0;
  const horas = min / 60;
  return Math.round(((p - material) / horas) * 100) / 100;
}

export function rankLucroHora(procedures) {
  return (procedures || [])
    .map((p) => ({
      id: p.id,
      name: p.name || p.nome || "Procedimento",
      durationMinutes: Number(p.duration_minutes) || 0,
      lucroHora: lucroHoraEstimado({
        preco: p.valor_cobrado,
        durationMinutes: p.duration_minutes,
        custoMaterialEstimado: p.custo_material_estimado,
      }),
    }))
    .filter((p) => p.lucroHora != null)
    .sort((a, b) => b.lucroHora - a.lucroHora || String(a.name).localeCompare(String(b.name)));
}

export function summarizeLucroHora(ranked) {
  const list = ranked || [];
  if (!list.length) {
    return { n: 0, melhor: null, pior: null, copy: "Lucro/hora não informado — falta preço ou duração." };
  }
  const melhor = list[0];
  const pior = list[list.length - 1];
  return {
    n: list.length,
    melhor,
    pior,
    copy: `Estimativa: ${melhor.name} R$ ${fmt(melhor.lucroHora)}/h · menor ${pior.name} R$ ${fmt(pior.lucroHora)}/h. O sistema não altera o preço.`,
  };
}

export function lucroHoraOpportunity(ranked) {
  const list = ranked || [];
  if (list.length < 2) return null;
  const melhor = list[0];
  const pior = list[list.length - 1];
  if (!(melhor.lucroHora > 0)) return null;
  if (pior.lucroHora >= melhor.lucroHora * 0.4) return null;
  return {
    theme: "lucro_hora",
    title: `${pior.name}: lucro/hora baixo frente a ${melhor.name}`,
    causa: "Estimativa com preço, duração e material cadastrado no procedimento.",
    impacto: "O sistema não altera o preço — revise em Procedimentos.",
    fonte: "cadastro de procedimentos",
    reason:
      "Estimativa com preço, duração e material cadastrado. O sistema não altera o preço — revise em Procedimentos.",
    action: "Revisar duração, material e preço (você altera)",
    view: "procedimento",
    urgency: 0.35,
    impact: 0.75,
    actionable: 1,
    count: 1,
  };
}

function fmt(n) {
  return Number(n).toFixed(2).replace(".", ",");
}
