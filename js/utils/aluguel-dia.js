/**
 * Aluguel de equipamento por dia (ex.: “dia de laser”).
 * Não altera o preço cobrado. A conta é do dia, não rateio automático em cada sessão.
 *
 * Marcador na descrição (sem coluna nova): [[sc-eq:800|8|HIFU]]
 */

function round2(x) {
  return Math.round(Number(x) * 100) / 100;
}

/** Cenário QA: dia de HIFU com aparelho alugado. Não é preço sugerido. */
export const CENARIO_DIA_HIFU = {
  nome: "HIFU facial",
  equip: "HIFU",
  aluguelDia: 800,
  horasDia: 8,
  durationMinutes: 60,
  preco: 450,
  material: 18,
  comissaoPct: 0,
  margemAlvoPct: 40,
};

export const ALUGUEL_USAGE_PREFIX = "aluguel:";
export const ALUGUEL_MARKER_RE = /\[\[sc-eq:([0-9]+(?:\.[0-9]+)?)\|([0-9]+(?:\.[0-9]+)?)(?:\|([^\]]*))?\]\]/;

export function isUsageAluguel(itemRef) {
  return String(itemRef || "")
    .trim()
    .toLowerCase()
    .startsWith(ALUGUEL_USAGE_PREFIX);
}

export function parseAluguelMarker(description) {
  const m = String(description || "").match(ALUGUEL_MARKER_RE);
  if (!m) return null;
  const dia = Number(m[1]);
  const horas = Number(m[2]);
  if (!(dia > 0)) return null;
  return {
    dia: round2(dia),
    horas: Number.isFinite(horas) && horas > 0 ? horas : 8,
    equip: String(m[3] || "").trim(),
  };
}

export function stripAluguelMarker(description) {
  return String(description || "")
    .replace(ALUGUEL_MARKER_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function encodeAluguelMarker({ dia, horas = 8, equip = "" } = {}) {
  const d = Number(dia);
  if (!(d > 0)) return "";
  const h = Number(horas);
  const hrs = Number.isFinite(h) && h > 0 ? h : 8;
  const nome = String(equip || "")
    .replace(/[\]|]/g, "")
    .slice(0, 40);
  return `[[sc-eq:${round2(d)}|${hrs}|${nome}]]`;
}

export function withAluguelMarker(description, cfg) {
  const base = stripAluguelMarker(description);
  const mark = encodeAluguelMarker(cfg || {});
  if (!mark) return base || null;
  return base ? `${base}\n\n${mark}` : mark;
}

export function parseAluguelCadastro(procedure = {}) {
  const colDia = Number(procedure.aluguel_equipamento_dia);
  const colHoras = Number(procedure.aluguel_horas_dia);
  const fromDesc = parseAluguelMarker(procedure.description);
  const dia = Number.isFinite(colDia) && colDia > 0 ? colDia : fromDesc?.dia;
  if (!(Number(dia) > 0)) return null;
  const horas =
    Number.isFinite(colHoras) && colHoras > 0 ? colHoras : fromDesc?.horas || 8;
  const equip = String(procedure.aluguel_equipamento_nome || fromDesc?.equip || "").trim();
  return { dia: round2(dia), horas, equip };
}

export function capacidadeNoDia({ durationMinutes, horasDia = 8 } = {}) {
  const d = Number(durationMinutes);
  const h = Number(horasDia);
  if (!(d > 0) || !(h > 0)) return null;
  return Math.floor((h * 60) / d);
}

/**
 * Quantos deste procedimento no dia pagam o aluguel e ainda sobram (margem alvo).
 */
export function contaDiaEquipamento({
  aluguelDia,
  preco,
  material = 0,
  comissaoPct = 0,
  taxaPct = 0,
  durationMinutes = 60,
  horasDia = 8,
  margemAlvoPct = null,
} = {}) {
  const aluguel = Number(aluguelDia);
  const p = Number(preco);
  const mat = Number(material);
  const matN = Number.isFinite(mat) && mat > 0 ? mat : 0;
  const comPct = Number(comissaoPct) || 0;
  const txPct = Number(taxaPct) || 0;
  const incompleto = !(aluguel > 0) || !(p > 0);
  const com = !incompleto ? round2((p * comPct) / 100) : 0;
  const tx = !incompleto ? round2((p * txPct) / 100) : 0;
  const contribuicao = !incompleto ? round2(p - matN - com - tx) : null;
  const cap = capacidadeNoDia({ durationMinutes, horasDia });
  const contribInsuficiente = contribuicao != null && contribuicao <= 0;

  let nPagar = null;
  let nSobra = null;
  if (contribuicao != null && contribuicao > 0 && aluguel > 0) {
    nPagar = Math.ceil(aluguel / contribuicao - 1e-9);
    const m = Number(margemAlvoPct);
    if (Number.isFinite(m) && m > 0) {
      const denom = contribuicao - p * (m / 100);
      nSobra = denom > 0.009 ? Math.ceil(aluguel / denom - 1e-9) : null;
    } else {
      nSobra = nPagar + 1;
    }
  }

  function simular(n) {
    if (!n || n < 1 || incompleto) return null;
    const rec = round2(n * p);
    const variavel = round2(n * (matN + com + tx));
    return { n, receita: rec, variavel, aluguel: round2(aluguel), lucro: round2(rec - variavel - aluguel) };
  }

  return {
    aluguel: aluguel > 0 ? round2(aluguel) : null,
    preco: p > 0 ? round2(p) : null,
    material: matN,
    comissao: com,
    taxa: tx,
    contribuicao,
    contribInsuficiente,
    nPagar,
    nSobra,
    capacidade: cap,
    pagaNoDia: cap != null && nPagar != null && cap >= nPagar,
    sobraNoDia: cap != null && nSobra != null && cap >= nSobra,
    lotado: simular(cap),
    noEquilibrio: simular(nPagar),
    incompleto,
  };
}

function brl(n) {
  return `R$ ${Number(n).toFixed(2).replace(".", ",")}`;
}

export function resumoAluguelNaAgenda(appointments = [], procedures = []) {
  const byId = {};
  for (const p of procedures || []) byId[p.id] = p;
  const groups = new Map();
  for (const a of appointments || []) {
    if (a.item_type === "event" || a.is_retorno) continue;
    const p = a.procedure_id ? byId[a.procedure_id] : null;
    const cfg = parseAluguelCadastro(p);
    if (!cfg) continue;
    const cur = groups.get(p.id) || {
      procedure_id: p.id,
      nome: p.name || "Procedimento",
      n: 0,
      cfg,
      durationMinutes: p.duration_minutes,
      preco: p.valor_cobrado,
      material: p.custo_material_estimado,
      comissaoPct: p.comissao_profissional_pct,
      margemAlvoPct: p.margem_minima_desejada,
    };
    cur.n += 1;
    groups.set(p.id, cur);
  }
  return [...groups.values()].map((g) => {
    const conta = contaDiaEquipamento({
      aluguelDia: g.cfg.dia,
      preco: g.preco,
      material: g.material,
      comissaoPct: g.comissaoPct,
      durationMinutes: g.durationMinutes,
      horasDia: g.cfg.horas,
      margemAlvoPct: g.margemAlvoPct,
    });
    const faltaPagar = conta.nPagar != null ? Math.max(0, conta.nPagar - g.n) : null;
    return { ...g, conta, faltaPagar };
  });
}

export function textoAluguelNaAgenda(rows = []) {
  if (!rows.length) return "";
  return rows
    .map((r) => {
      const aluguel = brl(r.cfg.dia);
      if (r.conta.incompleto) {
        return `${r.nome}: aluguel ${aluguel} neste dia · ${r.n} na agenda (informe o valor cobrado para ver o ponto de equilíbrio).`;
      }
      const eq = r.conta.nPagar;
      if (r.faltaPagar > 0) {
        return `${r.nome}: ${r.n} na agenda · ${eq} pagam o aluguel de ${aluguel} · faltam ${r.faltaPagar}.`;
      }
      return `${r.nome}: ${r.n} na agenda · o aluguel de ${aluguel} já se paga (${eq} no ponto de equilíbrio).`;
    })
    .join(" ");
}

export function textoContaDia(c, { nomeProc = "este procedimento" } = {}) {
  if (!c || c.incompleto) {
    return "Informe o aluguel do dia e o valor cobrado para ver quantos atendimentos pagam o equipamento. O preço do catálogo não muda.";
  }
  if (c.contribInsuficiente) {
    return `Cada ${nomeProc} não cobre material/comissão/taxa (${brl(c.contribuicao)} de contribuição). Com este preço o aluguel do dia não se paga. O sistema não altera o preço.`;
  }
  const cap = c.capacidade != null ? ` Cabem ${c.capacidade} neste dia (duração × horas com o aparelho).` : "";
  const pagar = `Para pagar o aluguel de ${brl(c.aluguel)}: ${c.nPagar} ${c.nPagar === 1 ? "atendimento" : "atendimentos"}.`;
  let sobra;
  if (c.nSobra == null) {
    sobra = " Com a margem alvo, este preço não deixa sobra depois do aluguel.";
  } else {
    sobra = ` Para pagar e ainda sobrar na margem: ${c.nSobra} ${c.nSobra === 1 ? "atendimento" : "atendimentos"}.`;
  }
  let dia = "";
  if (c.lotado) {
    const sinal = c.lotado.lucro >= 0 ? "sobra" : "falta";
    dia = ` Se lotar o dia (${c.lotado.n}): receita ${brl(c.lotado.receita)}, ${sinal} ${brl(Math.abs(c.lotado.lucro))} depois do aluguel.`;
  }
  const avisoCap =
    c.capacidade != null && c.nPagar != null && !c.pagaNoDia
      ? " Mesmo lotando, o aluguel não se paga — aumente as horas, reduza a duração ou revise o valor (você decide)."
      : "";
  return `${pagar}${sobra}${cap}${dia}${avisoCap} Não altera o preço.`;
}
