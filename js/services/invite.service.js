import { supabase } from "../core/supabase.js";

/* =========================
   CREATE INVITE
========================= */
export async function createInvite({ orgId, email, role }) {
  const { error } = await supabase
    .from("organization_invites")
    .insert({
      org_id: orgId,
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
    .select("*, organizations(name)")
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (error) {
    console.error("[INVITE-SERVICE] Erro ao buscar convite", error);
    throw error;
  }
  if (!data) return null;
  return {
    ...data,
    org_id: data.org_id ?? data.organization_id,
    organization_name: data.organizations?.name ?? data.organization_name ?? "Clínica",
  };
}
