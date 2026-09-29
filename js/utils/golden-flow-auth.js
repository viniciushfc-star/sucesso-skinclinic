/**
 * Leitura do ciclo ouro autenticado. Só SELECT. Não grava, não WhatsApp, não muda preço.
 */

import { GOLDEN_CYCLE } from "./golden-flow.js";

export const GOLDEN_ELOS_EXTRA = [
  { id: "orcamento", table: "orcamentos", optional: true },
  { id: "pacote", table: "client_packages", optional: true },
  { id: "eventos", table: "client_events", optional: true },
];

export function elosGoldenParaLeitura() {
  const core = GOLDEN_CYCLE.filter((s) => s.table).map((s) => ({
    id: s.id,
    table: s.table,
    optional: false,
  }));
  return [...core, ...GOLDEN_ELOS_EXTRA];
}

export function tabelaAusente(error) {
  const code = String(error?.code || "");
  const msg = String(error?.message || "");
  return code === "42P01" || code === "PGRST205" || /does not exist|schema cache/i.test(msg);
}

/**
 * @returns {{ ok: boolean, estado: string, count: number|null, detalhe?: string }}
 */
export function interpretarLeituraElo({ error, count, optional } = {}) {
  if (error) {
    if (optional && tabelaAusente(error)) {
      return { ok: true, estado: "tabela_ausente", count: null, detalhe: String(error.message || "") };
    }
    return { ok: false, estado: "erro", count: null, detalhe: String(error.message || "leitura recusada") };
  }
  const n = Number(count);
  const q = Number.isFinite(n) ? n : 0;
  return { ok: true, estado: q > 0 ? "com_dado" : "vazio", count: q };
}

/**
 * Escolhe a org do JWT com mais pacientes (não a primeira linha).
 * Só SELECT.
 */
export async function escolherOrgComPacientes(user) {
  const { data: memberships, error } = await user.from("organization_users").select("org_id, role");
  if (error) return { ok: false, detalhe: error.message, memberships: [] };
  const list = memberships || [];
  if (!list.length) return { ok: false, detalhe: "sem membership", memberships: [] };
  let melhor = { orgId: list[0].org_id, role: list[0].role, clientes: -1 };
  for (const m of list) {
    const { count, error: cErr } = await user
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("org_id", m.org_id);
    const n = cErr ? -1 : Number(count) || 0;
    if (n > melhor.clientes) melhor = { orgId: m.org_id, role: m.role, clientes: n };
  }
  return { ok: true, ...melhor, memberships: list };
}

export function credenciaisGoldenAuth(env = process.env) {
  const url = String(env.SUPABASE_URL || "").trim();
  const anon = String(env.SUPABASE_ANON_KEY || "").trim();
  const email = String(env.QA_EMAIL_MASTER || "").trim();
  const password = String(env.QA_PASS_MASTER || "").trim();
  return {
    ok: Boolean(url && anon && email && password),
    url,
    anon,
    email,
    password,
  };
}
