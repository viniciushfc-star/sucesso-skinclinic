/**
 * SkinClinic Intelligence (P2-1): prioriza o que merece atenção.
 * IA não dispara WhatsApp nem muda preço. Humano clica e age.
 * Teto anti-spam: 5 cards por coluna.
 */

export const INTEL_MAX_CARDS = 5;

export function scoreInsight({ urgency = 0, impact = 0, actionable = 0 } = {}) {
  const u = clamp01(urgency);
  const i = clamp01(impact);
  const a = clamp01(actionable);
  return Math.round(u * i * a * 1000) / 1000;
}

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

/**
 * Um card por tema (o de maior score). Depois ordena e corta no teto.
 */
export function prioritizeInsights(insights, limit = INTEL_MAX_CARDS) {
  const list = Array.isArray(insights) ? insights : [];
  const byTheme = new Map();
  for (const raw of list) {
    if (!raw) continue;
    const item = {
      ...raw,
      theme: raw.theme || raw.id || "outro",
      count: Number(raw.count) > 0 ? Number(raw.count) : 1,
      score: Number.isFinite(Number(raw.score)) ? Number(raw.score) : scoreInsight(raw),
    };
    const prev = byTheme.get(item.theme);
    if (!prev) {
      byTheme.set(item.theme, item);
      continue;
    }
    prev.count += item.count;
    if (item.score > prev.score) {
      prev.score = item.score;
      prev.title = item.title;
      prev.reason = item.reason;
      prev.view = item.view;
    }
  }
  return [...byTheme.values()]
    .sort((a, b) => b.score - a.score || String(a.theme).localeCompare(String(b.theme)))
    .slice(0, Math.max(0, limit));
}

export function buildAttentionInsights({
  atrasos = 0,
  contasVencidas = 0,
  analisesPendentes = 0,
  inativos = 0,
  produtosRisco = 0,
} = {}) {
  const out = [];
  if (atrasos > 0) {
    out.push({
      theme: "atraso",
      title: atrasos === 1 ? "1 atendimento em atraso" : `${atrasos} atendimentos em atraso`,
      reason: "O horário já passou e ainda não houve confirmação ou baixa. Abrir a agenda agora.",
      view: "agenda",
      urgency: 1,
      impact: 0.75,
      actionable: 1,
      count: atrasos,
    });
  }
  if (contasVencidas > 0) {
    out.push({
      theme: "contas",
      title: contasVencidas === 1 ? "1 conta vencida" : `${contasVencidas} contas vencidas`,
      reason: "Saída em atraso. Conferir no financeiro — o sistema não paga sozinho.",
      view: "financeiro",
      urgency: 0.9,
      impact: 0.8,
      actionable: 1,
      count: contasVencidas,
    });
  }
  if (analisesPendentes > 0) {
    out.push({
      theme: "pele",
      title:
        analisesPendentes === 1
          ? "1 análise de pele aguardando validação"
          : `${analisesPendentes} análises de pele aguardando validação`,
      reason: "Foto/resposta no portal ainda sem olho clínico. Validar ou devolver.",
      view: "analise-pele",
      urgency: 0.55,
      impact: 0.45,
      actionable: 1,
      count: analisesPendentes,
    });
  }
  if (produtosRisco > 0) {
    out.push({
      theme: "margem",
      title:
        produtosRisco === 1
          ? "1 produto com custo em alta"
          : `${produtosRisco} produtos com custo em alta`,
      reason: "Insumo subiu. Revisar margem do procedimento. O sistema não altera preço.",
      view: "procedimento",
      urgency: 0.4,
      impact: 0.9,
      actionable: 0.85,
      count: produtosRisco,
    });
  }
  if (inativos > 0) {
    out.push({
      theme: "inativos",
      title: inativos === 1 ? "1 pessoa sem retorno recente" : `${inativos} pessoas sem retorno recente`,
      reason: "Sem visita há ≥90 dias. Está no CRM — sem disparo automático de WhatsApp.",
      view: "crm",
      urgency: 0.35,
      impact: 0.5,
      actionable: 0.7,
      count: inativos,
    });
  }
  return prioritizeInsights(out.map((i) => ({ ...i, score: scoreInsight(i) })));
}

export function buildOpportunityInsights({ espera = 0, radar = 0, lucroHora = null } = {}) {
  const out = [];
  if (espera > 0) {
    out.push({
      theme: "espera",
      title: espera === 1 ? "1 pessoa na lista de espera" : `${espera} pessoas na lista de espera`,
      reason: "Encaixe manual na agenda. Intelligence não preenche horário sozinha.",
      view: "crm",
      urgency: 0.5,
      impact: 0.65,
      actionable: 1,
      count: espera,
    });
  }
  if (radar > 0) {
    out.push({
      theme: "radar",
      title: radar === 1 ? "1 pessoa no radar de retorno" : `${radar} pessoas no radar de retorno`,
      reason: "Pacote, 2ª sessão, ritmo ou sem próxima. WhatsApp só se você clicar.",
      view: "crm",
      urgency: 0.45,
      impact: 0.7,
      actionable: 1,
      count: radar,
    });
  }
  if (lucroHora && lucroHora.theme) {
    out.push(lucroHora);
  }
  return prioritizeInsights(out.map((i) => ({ ...i, score: scoreInsight(i) })));
}
