import { supabase } from "../core/supabase.js"
import { getActiveOrg } from "../core/org.js"

const roleCache = new Map()

function log(type, msg, data = null) {
  console[type](`[PERMISSIONS-SERVICE] ${msg}`, data ?? "")
}

/* =========================
   OVERRIDES POR USUÁRIO (tela de permissões da equipe)
========================= */

/**
 * Lista overrides de permissão de um usuário na org ativa.
 * Usado na tela de edição de permissões do membro da equipe.
 */
export async function getUserPermissionOverrides(userId) {
  const orgId = getActiveOrg();
  if (!orgId) return [];
  const { data, error } = await supabase
    .from("organization_user_permissions")
    .select("permission, allowed")
    .eq("user_id", userId)
    .eq("org_id", orgId);
  if (error) {
    log("error", "getUserPermissionOverrides", error);
    return [];
  }
  return data ?? [];
}

/**
 * Salva um override de permissão para um usuário na org ativa.
 */
export async function saveUserPermissionOverride({ userId, permission, allowed }) {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  const { error } = await supabase
    .from("organization_user_permissions")
    .upsert(
      { org_id: orgId, user_id: userId, permission, allowed },
      { onConflict: "org_id,user_id,permission" }
    );
  if (error) throw error;
  clearRoleCache();
}

/* =========================
   ROLE POR ORGANIZAÇÃO
========================= */

export async function getRole() {
  try {
    const orgId = getActiveOrg()

    if (!orgId) {
      log("warn", "Org ativa não definida — permissões indisponíveis")
      return "__NO_ORG__"
    }

    if (roleCache.has(orgId)) {
      return roleCache.get(orgId)
    }

    const { data: sessionData } = await supabase.auth.getSession()
    const user = sessionData?.session?.user

    if (!user) {
      log("warn", "Usuário não logado")
      return "__NO_USER__"
    }

    const { data, error } = await supabase
      .from("organization_users")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", orgId)
      .maybeSingle()

    if (error) {
      log("error", "Erro ao buscar role", error)
      return "__ERROR__"
    }

    if (!data?.role) {
      log("warn", "Usuário sem role nesta organização", {
        user: user.id,
        org: orgId
      })
      return "__NO_ROLE__"
    }

    roleCache.set(orgId, data.role)

    log("info", "Role carregada", {
      org: orgId,
      role: data.role
    })

    return data.role
  } catch (err) {
    log("error", "Falha inesperada em getRole", err)
    return "__ERROR__"
  }
}

/* =========================
   LIMPAR CACHE
========================= */

export function clearRoleCache() {
  roleCache.clear()
}
