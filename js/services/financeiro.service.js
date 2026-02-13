import { supabase } from "../core/supabase.js"
import { withOrg } from "../core/org.js"

/**
 * Lista transações da organização (para resumo, lista e "por procedimento").
 */
export async function getFinanceiro() {
  const { data, error } = await withOrg(
    supabase.from("financeiro").select("*").order("data", { ascending: false })
  )
  if (error) throw error
  return data ?? []
}
