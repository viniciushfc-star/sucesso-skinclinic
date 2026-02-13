/**
 * Modelo de pagamento por membro — só master.
 * Sistema registra para análise; não executa pagamento.
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";

function getOrgOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

export async function listTeamPaymentModels() {
  try {
    const { data, error } = await withOrg(
      supabase.from("team_payment_models").select("*").order("created_at", { ascending: false })
    );
    if (error) throw error;
    return data ?? [];
  } catch (_) {
    return [];
  }
}

export async function getTeamPaymentModelByUser(userId) {
  try {
    const orgId = getOrgOrThrow();
    const { data, error } = await supabase
      .from("team_payment_models")
      .select("*")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  } catch (_) {
    return null;
  }
}

export async function upsertTeamPaymentModel({ userId, paymentType, valorFixo, percentualProcedimento, valorDiaria, observacao }) {
  try {
    const orgId = getOrgOrThrow();
    const payload = {
      org_id: orgId,
      user_id: userId,
      payment_type: paymentType || "fixo",
      valor_fixo: valorFixo != null && valorFixo !== "" ? Number(valorFixo) : null,
      percentual_procedimento: percentualProcedimento != null && percentualProcedimento !== "" ? Number(percentualProcedimento) : null,
      valor_diaria: valorDiaria != null && valorDiaria !== "" ? Number(valorDiaria) : null,
      observacao: (observacao || "").trim() || null,
    };
    const { data, error } = await supabase
      .from("team_payment_models")
      .upsert(payload, { onConflict: "org_id,user_id" })
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (e) {
    throw new Error("Tabela team_payment_models não existe ou não está configurada. Crie a tabela no Supabase se for usar modelo de pagamento.");
  }
}
