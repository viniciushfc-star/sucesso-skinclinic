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
      prev.action = item.action;
      prev.causa = item.causa;
      prev.impacto = item.impacto;
      prev.fonte = item.fonte;
    }
  }
  return [...byTheme.values()]
    .sort((a, b) => b.score - a.score || String(a.theme).localeCompare(String(b.theme)))
    .slice(0, Math.max(0, limit))
    .map((c) => ({
      ...c,
      action: c.action || "Abrir a tela indicada",
    }));
}

/** Causa → impacto → ação, com fonte. Não inventa número. */
export function montarInsightCausa({
  theme,
  title,
  causa,
  impacto,
  acao,
  fonte,
  view,
  urgency = 0,
  impact = 0,
  actionable = 0,
  count = 1,
} = {}) {
  const action = acao || "Abrir a tela indicada";
  const causaTxt = String(causa || "").trim();
  const impactoTxt = String(impacto || "").trim();
  const fonteTxt = String(fonte || "").trim();
  const reason = [causaTxt, impactoTxt ? `Impacto: ${impactoTxt}` : "", fonteTxt ? `Fonte: ${fonteTxt}` : ""]
    .filter(Boolean)
    .join(" ");
  return {
    theme,
    title,
    causa: causaTxt,
    impacto: impactoTxt,
    fonte: fonteTxt,
    action,
    view: view || "dashboard",
    urgency,
    impact,
    actionable,
    count,
    reason,
    score: scoreInsight({ urgency, impact, actionable }),
  };
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
    out.push(
      montarInsightCausa({
        theme: "atraso",
        title: atrasos === 1 ? "1 atendimento em atraso" : `${atrasos} atendimentos em atraso`,
        causa: "O horário da agenda de hoje já passou e ainda não houve confirmação ou baixa.",
        impacto: "Sala e profissional ficam ociosos; o previsto do dia não vira recebido.",
        acao: "Abrir a agenda de hoje",
        fonte: "agenda de hoje",
        view: "agenda",
        urgency: 1,
        impact: 0.75,
        actionable: 1,
        count: atrasos,
      })
    );
  }
  if (contasVencidas > 0) {
    out.push(
      montarInsightCausa({
        theme: "contas",
        title: contasVencidas === 1 ? "1 conta vencida" : `${contasVencidas} contas vencidas`,
        causa: "Há conta a pagar com vencimento até hoje e status em aberto.",
        impacto: "Saída em atraso. O sistema não paga sozinho.",
        acao: "Abrir contas a pagar",
        fonte: "contas a pagar",
        view: "financeiro",
        urgency: 0.9,
        impact: 0.8,
        actionable: 1,
        count: contasVencidas,
      })
    );
  }
  if (analisesPendentes > 0) {
    out.push(
      montarInsightCausa({
        theme: "pele",
        title:
          analisesPendentes === 1
            ? "1 análise de pele aguardando validação"
            : `${analisesPendentes} análises de pele aguardando validação`,
        causa: "O paciente enviou fotos/respostas no portal e o status ainda é pendente de validação.",
        impacto: "Sem olho clínico, a devolutiva não aparece no portal.",
        acao: "Validar a análise de pele",
        fonte: "análises com status pendente",
        view: "analise-pele",
        urgency: 0.55,
        impact: 0.45,
        actionable: 1,
        count: analisesPendentes,
      })
    );
  }
  if (produtosRisco > 0) {
    out.push(
      montarInsightCausa({
        theme: "margem",
        title:
          produtosRisco === 1
            ? "1 produto com custo em alta"
            : `${produtosRisco} produtos com custo em alta`,
        causa: "Auditoria registrou aumento de custo de insumo nos últimos 30 dias.",
        impacto: "Margem do procedimento aperta. O sistema não altera preço.",
        acao: "Revisar o procedimento",
        fonte: "auditoria estoque.custo_aumentou",
        view: "procedimento",
        urgency: 0.4,
        impact: 0.9,
        actionable: 0.85,
        count: produtosRisco,
      })
    );
  }
  if (inativos > 0) {
    out.push(
      montarInsightCausa({
        theme: "inativos",
        title: inativos === 1 ? "1 pessoa sem retorno recente" : `${inativos} pessoas sem retorno recente`,
        causa: "Cadastro sem visita há 90 dias ou mais.",
        impacto: "Risco de perda de ritmo. Sem disparo automático.",
        acao: "Abrir a fila do CRM (um clique)",
        fonte: "CRM inativos ≥90 dias",
        view: "crm",
        urgency: 0.35,
        impact: 0.5,
        actionable: 0.7,
        count: inativos,
      })
    );
  }
  return prioritizeInsights(out);
}

export function buildOpportunityInsights({ espera = 0, radar = 0, lucroHora = null } = {}) {
  const out = [];
  if (espera > 0) {
    out.push(
      montarInsightCausa({
        theme: "espera",
        title: espera === 1 ? "1 pessoa na lista de espera" : `${espera} pessoas na lista de espera`,
        causa: "Há pedido aberto na lista de espera da clínica.",
        impacto: "Horário vago pode ser oferecido. Intelligence não preenche sozinha.",
        acao: "Encaixar na agenda ou avisar na espera",
        fonte: "lista de espera aberta",
        view: "crm",
        urgency: 0.5,
        impact: 0.65,
        actionable: 1,
        count: espera,
      })
    );
  }
  if (radar > 0) {
    out.push(
      montarInsightCausa({
        theme: "radar",
        title: radar === 1 ? "1 pessoa no radar de retorno" : `${radar} pessoas no radar de retorno`,
        causa: "Pacote, segunda sessão, ritmo ou falta de próximo horário no radar.",
        impacto: "Retorno atrasado. Mensagem só se você clicar.",
        acao: "Abrir a fila do CRM (um clique)",
        fonte: "radar de retorno",
        view: "crm",
        urgency: 0.45,
        impact: 0.7,
        actionable: 1,
        count: radar,
      })
    );
  }
  if (lucroHora && lucroHora.theme) {
    out.push(lucroHora);
  }
  return prioritizeInsights(out.map((i) => ({ ...i, score: Number.isFinite(Number(i.score)) ? Number(i.score) : scoreInsight(i) })));
}
