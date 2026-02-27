import { supabase } from "../core/supabase.js"
import { getActiveOrg } from "../core/org.js"

// Envia convite via Edge Function dynamic-api e registra na tabela de convites
export async function inviteUser(email, role){
  if (!email) throw new Error("Informe o email")

  const orgId = getActiveOrg()
  if (!orgId) throw new Error("Organização ativa não definida")

  // Chama a função Edge "dynamic-api" no Supabase
  const { data, error } = await supabase.functions.invoke("dynamic-api", {
    body: {
      action: "send-team-invite",
      email,
      role,
      orgId,
    },
  })

  if (error) throw new Error(error.message || "Erro ao enviar convite")

  // Opcional: se a função já registrar o convite, não precisamos mais da tabela convites aqui.
  // Se quiser manter um log local, você pode descomentar o insert abaixo.
  /*
  const { data:{ user } } = await supabase.auth.getUser()
  await supabase
    .from("convites")
    .insert({ email, role, user_id: user?.id || null })
  */

  return data
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
