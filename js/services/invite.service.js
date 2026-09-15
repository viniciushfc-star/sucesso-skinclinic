import { supabase } from "../core/supabase.js";

export async function createInvite({ orgId, email, role }) {
  const { error } = await supabase
    .from("organization_invites")
    .insert({
      org_id: orgId,
      email: String(email || "").trim().toLowerCase(),
      role,
      status: "pending"
    });

  if (error) {
    console.error("[INVITE-SERVICE] Erro ao criar convite", error);
    throw new Error(error.message || "Não foi possível criar o convite.");
  }
}

/**
 * Convite pendente do e-mail. Sem embed organizations() (exige FK no schema cache).
 */
export async function getInviteByEmail(email) {
  const needle = String(email || "").trim();
  if (!needle) return null;

  const { data, error } = await supabase
    .from("organization_invites")
    .select("id, org_id, email, role, status, created_at")
    .eq("status", "pending")
    .ilike("email", needle)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[INVITE-SERVICE] Erro ao buscar convite", error);
    throw new Error(error.message || "Não foi possível buscar o convite.");
  }
  if (!data) return null;

  let organization_name = "Clínica";
  if (data.org_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", data.org_id)
      .maybeSingle();
    if (org?.name) organization_name = org.name;
  }

  return {
    ...data,
    organization_name,
  };
}
