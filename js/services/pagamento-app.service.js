import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";
import { PAGAMENTO_APP_ENABLED } from "../core/feature-flags.js";
import { PARCELAS_MAXIMAS } from "../core/pagamento-regras.js";
import { MSG_PARCERIA, montarCobranca, montarInteresse } from "../utils/pagamento-app.js";
import { createLancamento } from "./financeiro.service.js";
import { apiFetch } from "../core/api-fetch.js";
import { userFacingError } from "../core/errors.js";

export const SQL_COBRANCAS_APP = "supabase-fase0-cobrancas-app-colar.sql";

export function missingCobrancasTable(error) {
  const msg = String(error?.message || "");
  const code = String(error?.code || "");
  return code === "42P01" || code === "PGRST205" || /cobrancas_app|pagamento_adesao|does not exist|schema cache/i.test(msg);
}

function chaveAdesaoLocal(orgId) {
  return `sc_pagamento_adesao_${orgId}`;
}

export async function lerAdesaoPagamento() {
  const orgId = getActiveOrg();
  if (!orgId) return null;
  const { data, error } = await supabase.from("pagamento_adesao").select("*").eq("org_id", orgId).maybeSingle();
  if (!error && data) return { ...data, via: "banco" };
  if (error && !missingCobrancasTable(error)) throw error;
  try {
    const raw = localStorage.getItem(chaveAdesaoLocal(orgId));
    if (!raw) return null;
    return { ...JSON.parse(raw), via: "local" };
  } catch {
    return null;
  }
}

/** Anota interesse. Não cobra. */
export async function registrarInteresseAdesao(input) {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  const row = montarInteresse(input);
  const payload = { org_id: orgId, ...row, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from("pagamento_adesao")
    .upsert(payload, { onConflict: "org_id" })
    .select("*")
    .maybeSingle();
  if (!error && data) return { ...data, via: "banco" };
  if (error && !missingCobrancasTable(error)) throw error;
  localStorage.setItem(chaveAdesaoLocal(orgId), JSON.stringify({ ...payload, status: "interesse" }));
  return { ...payload, status: "interesse", via: "local" };
}

function bloqueioLocal() {
  if (!PAGAMENTO_APP_ENABLED) return MSG_PARCERIA;
  return null;
}

export async function statusCobrancaApp() {
  const bloq = bloqueioLocal();
  if (bloq) return { ativa: false, motivo: bloq };
  try {
    const res = await apiFetch("/api/pagamento-app");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ativa: false, motivo: userFacingError({ status: res.status, message: data.error }) };
    }
    return { ativa: !!data.ativa, motivo: data.motivo || (data.ativa ? "" : MSG_PARCERIA) };
  } catch {
    return { ativa: false, motivo: MSG_PARCERIA };
  }
}

export async function listarCobrancasApp() {
  const bloq = bloqueioLocal();
  if (bloq) return [];
  const { data, error } = await withOrg(
    supabase.from("cobrancas_app").select("*").order("created_at", { ascending: false }).limit(40)
  );
  if (error) {
    if (missingCobrancasTable(error)) return [];
    throw error;
  }
  return data ?? [];
}

/**
 * Só grava se a parceria estiver ativa no servidor. Sem parceria: recusa em português.
 */
export async function criarCobrancaApp(input) {
  const bloq = bloqueioLocal();
  if (bloq) {
    const e = new Error(bloq);
    e.code = "PARCERIA";
    throw e;
  }
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  montarCobranca(input, PARCELAS_MAXIMAS);
  const res = await apiFetch("/api/pagamento-app", {
    method: "POST",
    json: { acao: "cobrar", ...input, org_id: orgId },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(userFacingError({ status: res.status, message: data.error || data.message }));
  }
  return data;
}

/**
 * Humano confirma: lança no caixa. O app não grava preço sozinho.
 */
export async function lancarCobrancaNoCaixa(cobranca) {
  const bloq = bloqueioLocal();
  if (bloq) {
    const e = new Error(bloq);
    e.code = "PARCERIA";
    throw e;
  }
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  const valor = Number(cobranca?.valor);
  if (!Number.isFinite(valor) || valor <= 0) throw new Error("Valor inválido para o caixa.");
  const lanc = await createLancamento({
    org_id: orgId,
    tipo: "entrada",
    valor,
    data: new Date().toISOString().slice(0, 10),
    descricao: cobranca.descricao || "Pagamento pelo app",
    forma_pagamento: cobranca.metodo === "pix" ? "pix" : cobranca.metodo === "debito" ? "debito" : "credito",
    agenda_id: cobranca.agenda_id || null,
  });
  if (cobranca.id) {
    await withOrg(
      supabase
        .from("cobrancas_app")
        .update({ status: "pago", financeiro_id: lanc?.id || null })
        .eq("id", cobranca.id)
    );
  }
  return lanc;
}
