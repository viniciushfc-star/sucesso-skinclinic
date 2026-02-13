import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";

function getOrgOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

/**
 * Lista contas a pagar da organização (apenas master).
 */
export async function listContasAPagar() {
  const { data, error } = await withOrg(
    supabase.from("contas_a_pagar").select("*").order("data_vencimento", { ascending: true })
  );
  if (error) throw error;
  return data ?? [];
}

/**
 * Cria conta a pagar.
 */
export async function createContaAPagar({ descricao, valor, dataVencimento, categoria }) {
  const orgId = getOrgOrThrow();
  const { data, error } = await supabase
    .from("contas_a_pagar")
    .insert({
      org_id: orgId,
      descricao: (descricao || "").trim(),
      valor: Number(valor),
      data_vencimento: dataVencimento || null,
      categoria: (categoria || "").trim() || null,
      status: "pendente",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Atualiza conta a pagar (ex.: marcar como pago).
 */
export async function updateContaAPagar(id, { descricao, valor, dataVencimento, dataPago, status, categoria }) {
  const payload = {};
  if (descricao !== undefined) payload.descricao = (descricao || "").trim();
  if (valor !== undefined) payload.valor = Number(valor);
  if (dataVencimento !== undefined) payload.data_vencimento = dataVencimento;
  if (dataPago !== undefined) payload.data_pago = dataPago || null;
  if (status !== undefined) payload.status = status;
  if (categoria !== undefined) payload.categoria = (categoria || "").trim() || null;
  const { data, error } = await withOrg(
    supabase.from("contas_a_pagar").update(payload).eq("id", id).select().single()
  );
  if (error) throw error;
  return data;
}

/**
 * Exclui conta a pagar.
 */
export async function deleteContaAPagar(id) {
  const { error } = await withOrg(supabase.from("contas_a_pagar").delete().eq("id", id));
  if (error) throw error;
}
