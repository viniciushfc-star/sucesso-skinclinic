import { supabase } from "../core/supabase.js";

/* =========================
   CREATE INVITE
========================= */
export async function createInvite({ orgId, email, role }) {
  const { error } = await supabase
    .from("organization_invites")
    .insert({
      organization_id: orgId,
      email,
      role,
      status: "pending"
    });

  if (error) {
    console.error("[INVITE-SERVICE] Erro ao criar convite", error);
    throw error;
  }
}

/* =========================
   GET INVITE BY EMAIL
========================= */
export async function getInviteByEmail(email) {
  const { data, error } = await supabase
    .from("organization_invites")
    .select("*")
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (error) {
    console.error("[INVITE-SERVICE] Erro ao buscar convite", error);
    throw error;
  }

  return data;
}
