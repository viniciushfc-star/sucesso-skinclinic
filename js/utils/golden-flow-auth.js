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
