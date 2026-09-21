import { supabase } from "../core/supabase.js"
import { getActiveOrg } from "../core/org.js"

/**
 * @deprecated Use `createInvite` em invite.service.js (org.js já faz isso).
 * Não chama mais a Edge `dynamic-api` nem a tabela `convites`.
 */
export async function inviteUser() {
  throw new Error("Use o fluxo de convite da equipe (organization_invites).");
}

/** Lista membros da organização (equipe). Para nomes/e-mail o front pode usar profiles ou outra fonte. */
export async function getTeam() {
  const orgId = getActiveOrg();
  if (!orgId) return { data: [], error: null };
  const { data, error } = await supabase
    .from("organization_users")
    .select("user_id, role")
    .eq("org_id", orgId);
  if (error) return { data: [], error };
  const rows = (data || []).map((r) => ({ id: r.user_id, user_id: r.user_id, role: r.role, email: null }));
  return { data: rows, error: null };
}
