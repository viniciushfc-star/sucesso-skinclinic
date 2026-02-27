import { supabase } from "../core/supabase.js";

/* =========================
   CREATE ORGANIZATION
========================= */
export async function createOrganization(name, ownerId) {
  const { data, error } = await supabase
    .from("organizations")
    .insert({ name, owner_id: ownerId })
    .select()
    .single();

  if (error) {
    console.error("[ORG-SERVICE] Erro ao criar organização", error);
    throw error;
  }

  return data;
}

/* =========================
   LINK USER AS MASTER
========================= */
export async function linkUserAsMaster(orgId, userId) {
  const { error } = await supabase
    .from("organization_users")
    .insert({
      org_id: orgId,
      user_id: userId,
      role: "master"
    });

  if (error) {
    console.error("[ORG-SERVICE] Erro ao vincular usuário", error);
    throw error;
  }
}

/* =========================
   CONVITE: vincular usuário à org com a role do convite
========================= */
export async function linkUserToOrganization({ orgId, userId, role }) {
  const { error } = await supabase
    .from("organization_users")
    .insert({
      org_id: orgId,
      user_id: userId,
      role: role || "staff"
    });
  if (error) throw error;
}

/* =========================
   CONVITE: marcar convite como aceito (organization_invites)
========================= */
export async function markInviteAsAccepted(inviteId) {
  if (!inviteId) return;
  const { error } = await supabase
    .from("organization_invites")
    .update({ status: "accepted" })
    .eq("id", inviteId);
  if (error) throw error;
}
