import { withOrg } from "../core/org.js";
import { supabase } from "../core/supabase.js";
import { agruparComissoes } from "../utils/comissao-apuracao.js";
import { getOrganizationProfile } from "./organization-profile.service.js";
import { listProcedures } from "./procedimentos.service.js";

function valorEntrada(e) {
  if (e.valor_recebido != null && e.valor_recebido !== "") return Number(e.valor_recebido) || 0;
  return Number(e.valor) || 0;
}

/**
 * Comissão sugerida no período, a partir de baixas com agenda.
 * Não cria lançamento e não paga.
 */
export async function listComissoesPeriodo(startDate, endDate) {
  const { data: entradas, error } = await withOrg(
    supabase
      .from("financeiro")
      .select("id, valor, valor_recebido, data, agenda_id, procedure_id")
      .eq("tipo", "entrada")
      .not("agenda_id", "is", null)
      .gte("data", startDate)
      .lte("data", endDate)
  );
  if (error) throw error;
  const rows = entradas || [];
  if (!rows.length) return { porProfissional: [], padraoPct: 0 };

  const agendaIds = [...new Set(rows.map((e) => e.agenda_id).filter(Boolean))];
  const { data: agendas, error: errAg } = await withOrg(
    supabase.from("agenda").select("id, user_id, professional_id, procedure_id").in("id", agendaIds)
  );
  let agendaRows = agendas;
  if (errAg && /professional_id|schema cache|column/i.test(errAg.message || "")) {
    const fallback = await withOrg(
      supabase.from("agenda").select("id, user_id, procedure_id").in("id", agendaIds)
    );
    if (fallback.error) throw fallback.error;
    agendaRows = fallback.data;
  } else if (errAg) {
    throw errAg;
  }
  const agendaById = (agendaRows || []).reduce((acc, a) => {
    acc[a.id] = a;
    return acc;
  }, {});

  const [procedures, profile] = await Promise.all([
    listProcedures(false).catch(() => []),
    getOrganizationProfile().catch(() => null),
  ]);
  const procById = (procedures || []).reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {});
  const padraoPct = profile?.comissao_profissional_padrao_pct != null
    ? Number(profile.comissao_profissional_padrao_pct)
    : 0;

  const linhas = [];
  for (const e of rows) {
    const ag = agendaById[e.agenda_id];
    const userId = ag?.user_id || ag?.professional_id;
    if (!userId) continue;
    const procId = e.procedure_id || ag?.procedure_id;
    const proc = procId ? procById[procId] : null;
    const pct =
      proc?.comissao_profissional_pct != null && proc.comissao_profissional_pct !== ""
        ? Number(proc.comissao_profissional_pct)
        : padraoPct;
    linhas.push({ userId, receita: valorEntrada(e), pct });
  }

  return { porProfissional: agruparComissoes(linhas), padraoPct };
}
