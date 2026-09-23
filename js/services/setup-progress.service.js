/**
 * Checklist de setup da clínica (P1-6).
 * Calculado dos dados reais — não é um tutorial de marketing.
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg, getOrgMembers } from "../core/org.js";
import { getOrganizationProfile } from "./organization-profile.service.js";
import { listProcedures } from "./procedimentos.service.js";

function headCount(table, extra = (q) => q) {
  const orgId = getActiveOrg();
  if (!orgId) return Promise.resolve(0);
  return extra(withOrg(supabase.from(table).select("id", { count: "exact", head: true }))).then(
    ({ count, error }) => (error ? 0 : count || 0)
  );
}

export async function getSetupProgress() {
  const orgId = getActiveOrg();
  if (!orgId) {
    return { pct: 0, done: 0, total: 10, steps: [], aha: false };
  }

  const [
    profile,
    members,
    procedures,
    nClientes,
    nAgenda,
    nEstoque,
    nAplicados,
    nAnamnese,
    nPlanos,
    nFinanceiro,
  ] = await Promise.all([
    getOrganizationProfile().catch(() => null),
    getOrgMembers().catch(() => []),
    listProcedures(false).catch(() => []),
    headCount("clients"),
    headCount("agenda"),
    headCount("estoque_entradas"),
    headCount("protocolos_aplicados"),
    headCount("anamnesis_registros"),
    headCount("planos_terapeuticos"),
    headCount("financeiro"),
  ]);

  const procs = procedures || [];
  const temProcPreco = procs.some(
    (p) => Number(p.duration_minutes) > 0 && Number(p.valor_cobrado) > 0
  );
  const temCusto =
    nEstoque > 0 || procs.some((p) => Number(p.custo_material_estimado) > 0);

  const steps = [
    {
      id: "empresa",
      ok: !!(profile?.name && String(profile.name).trim() && profile?.cidade),
      view: "empresa",
      label: "Empresa com nome e cidade",
    },
    {
      id: "equipe",
      ok: (members || []).length >= 1,
      view: "team",
      label: "Pelo menos 1 profissional",
    },
    {
      id: "procedimento",
      ok: temProcPreco,
      view: "procedimento",
      label: "1 procedimento com duração e preço",
    },
    {
      id: "custo",
      ok: temCusto,
      view: "estoque",
      label: "Custo material ou item de estoque",
    },
    {
      id: "cliente",
      ok: nClientes > 0,
      view: "clientes",
      label: "1 cliente (cadastro ou CSV)",
    },
    {
      id: "agenda",
      ok: nAgenda > 0,
      view: "agenda",
      label: "1 horário na agenda",
    },
    {
      id: "anamnese",
      ok: nAnamnese > 0,
      view: "anamnese",
      label: "1 anamnese (primeiro atendimento)",
    },
    {
      id: "plano",
      ok: nPlanos > 0,
      view: "planos",
      label: "1 plano terapêutico",
    },
    {
      id: "aplicado",
      ok: nAplicados > 0,
      view: "agenda",
      label: "1 protocolo aplicado (consome estoque)",
    },
    {
      id: "financeiro",
      ok: nFinanceiro > 0,
      view: "financeiro",
      label: "1 lançamento financeiro",
    },
  ];

  const done = steps.filter((s) => s.ok).length;
  const total = steps.length;
  const pct = Math.round((done / total) * 100);
  return {
    pct,
    done,
    total,
    steps,
    aha: nAplicados > 0,
  };
}
