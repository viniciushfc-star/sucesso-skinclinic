import { supabase } from "../core/supabase.js"

export async function getUserOrganizations() {
  const { data, error } = await supabase
    .from("organization_users")
    .select("organization:organization_id(*)")
    .eq("status", "ativo")

  if (error) throw error
  return data.map(r => r.organization)
}

export async function createOrganization(payload) {
  const { data, error } = await supabase
    .from("organizations")
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function requestOrgAccess(orgId, role) {
  const { error } = await supabase
    .from("organization_access_requests")
    .insert({
      organization_id: orgId,
      requested_role: role
    })

  if (error) throw error
}
