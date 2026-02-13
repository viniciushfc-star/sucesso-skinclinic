/**
 * Contas e cartões vinculados — transações em tempo real
 * Open Finance / webhook: vincular cartão ou conta para receber
 * transações automaticamente.
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";
import { getApiBase } from "../core/api-base.js";

function getOrgOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

/**
 * Lista contas/cartões vinculados da organização.
 */
export async function listContasVinculadas() {
  const { data, error } = await withOrg(
    supabase
      .from("contas_vinculadas")
      .select("*")
      .order("created_at", { ascending: false })
  );
  if (error) throw error;
  return data ?? [];
}

/**
 * Cria conta vinculada (para receber transações via webhook em tempo real).
 * Retorna a conta com external_account_id para configurar no conector/agregador.
 */
export async function createContaVinculada({ nomeExibicao, tipo }) {
  const orgId = getOrgOrThrow();
  const externalAccountId = crypto.randomUUID();
  const { data, error } = await supabase
    .from("contas_vinculadas")
    .insert({
      org_id: orgId,
      provider: "webhook",
      external_account_id: externalAccountId,
      nome_exibicao: (nomeExibicao || "").trim() || "Conta vinculada",
      tipo: tipo === "cartao" ? "cartao" : "conta",
      status: "active",
    })
    .select()
    .single();
  if (error) throw error;
  return { ...data, external_account_id: externalAccountId };
}

/**
 * Marca conta como desvinculada (revoked).
 */
export async function desvincularConta(id) {
  const { error } = await withOrg(
    supabase
      .from("contas_vinculadas")
      .update({ status: "revoked" })
      .eq("id", id)
  );
  if (error) throw error;
}

/**
 * Retorna a URL do webhook para transações em tempo real (base da API: em localhost = porta 3000).
 */
export function getWebhookTransacoesUrl() {
  return `${getApiBase()}/api/webhook-transacoes`;
}
