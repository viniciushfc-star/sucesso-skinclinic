/**
 * Ritmo e projeção de meta mensal.
 * Copy fixa: projeção, não garantia. Sem XP.
 */

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function parsePeriodoRef(ref, asOf = new Date()) {
  const s = String(ref || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (month >= 1 && month <= 12) return { year, month, inferred: false };
  }
  return {
    year: asOf.getFullYear(),
    month: asOf.getMonth() + 1,
    inferred: true,
  };
}

export function monthBounds(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${pad2(month)}-01`,
    end: `${year}-${pad2(month)}-${pad2(daysInMonth)}`,
    daysInMonth,
  };
}

export function daysElapsedInMonth(year, month, asOf = new Date()) {
  const { daysInMonth } = monthBounds(year, month);
  const y = asOf.getFullYear();
  const mo = asOf.getMonth() + 1;
  const d = asOf.getDate();
  if (y < year || (y === year && mo < month)) return 0;
  if (y > year || (y === year && mo > month)) return daysInMonth;
  return Math.min(daysInMonth, Math.max(1, d));
}

export function realizadoFromLancamentos(tipo, rows, start, end) {
  const list = Array.isArray(rows) ? rows : [];
  const inPeriod = list.filter((r) => {
    const d = String(r.data || "").slice(0, 10);
    return d >= start && d <= end;
  });
  const soma = (kind) =>
    inPeriod
      .filter((r) => String(r.tipo || "").toLowerCase() === kind)
      .reduce((s, r) => s + Number(r.valor_recebido ?? r.valor ?? 0), 0);
  if (tipo === "receita_mensal") return soma("entrada");
  if (tipo === "lucro_mensal") return soma("entrada") - soma("saida");
  return null;
}

/**
 * @returns {object} ritmo da meta
 */
export function explainMetaRitmo({
  tipo,
  valorMeta,
  realizado,
  year,
  month,
  asOf = new Date(),
} = {}) {
  const meta = Number(valorMeta);
  const done = realizado == null ? null : Number(realizado);
  const disclaimer = "Projeção, não garantia.";

  if (!Number.isFinite(meta) || meta < 0) {
    return { ok: false, reason: "Meta inválida.", disclaimer };
  }

  if (tipo === "reserva_emergencia" || tipo === "outro" || done == null || !Number.isFinite(done)) {
    const restante = done == null || !Number.isFinite(done) ? null : Math.max(0, meta - done);
    const pct = done == null || !Number.isFinite(done) || meta === 0 ? null : Math.round((done / meta) * 1000) / 10;
    return {
      ok: true,
      kind: "estoque",
      valorMeta: meta,
      realizado: done,
      restante,
      pct,
      ritmoAtual: null,
      ritmoNecessario: null,
      projetado: done,
      onTrack: done == null ? null : done >= meta,
      copy:
        done == null
          ? `Objetivo R$ ${fmt(meta)}. Sem realizado automático neste tipo. ${disclaimer}`
          : `Realizado R$ ${fmt(done)} de R$ ${fmt(meta)}${pct != null ? ` (${pct}%)` : ""}. ${disclaimer}`,
      disclaimer,
    };
  }

  const elapsed = daysElapsedInMonth(year, month, asOf);
  const { daysInMonth } = monthBounds(year, month);
  const left = Math.max(0, daysInMonth - elapsed);
  const restante = meta - done;
  const pct = meta === 0 ? 0 : Math.round((done / meta) * 1000) / 10;
  const ritmoAtual = elapsed > 0 ? done / elapsed : 0;
  const ritmoNecessario = left > 0 ? Math.max(0, restante) / left : restante > 0 ? restante : 0;
  const projetado = ritmoAtual * daysInMonth;
  const onTrack = projetado + 1e-9 >= meta;

  let copy;
  if (left === 0) {
    copy = onTrack
      ? `Mês encerrado: realizado R$ ${fmt(done)} (${pct}% da meta). ${disclaimer}`
      : `Mês encerrado: R$ ${fmt(done)} vs meta R$ ${fmt(meta)}. ${disclaimer}`;
  } else {
    copy = onTrack
      ? `No ritmo atual (~R$ ${fmt(ritmoAtual)}/dia) a projeção é R$ ${fmt(projetado)} — acima da meta. ${disclaimer}`
      : `Falta R$ ${fmt(Math.max(0, restante))}. Precisa ~R$ ${fmt(ritmoNecessario)}/dia nos ${left} dia(s) restantes. Projeção R$ ${fmt(projetado)}. ${disclaimer}`;
  }

  return {
    ok: true,
    kind: "mensal",
    valorMeta: meta,
    realizado: done,
    restante,
    pct,
    daysElapsed: elapsed,
    daysLeft: left,
    daysInMonth,
    ritmoAtual,
    ritmoNecessario,
    projetado,
    onTrack,
    copy,
    disclaimer,
  };
}

function fmt(n) {
  return Number(n || 0).toFixed(2).replace(".", ",");
}
