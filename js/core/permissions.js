import { getRole } 
from "../services/permissions.service.js";

import { supabase } 
from "./supabase.js";

import { getActiveOrg } 
from "./org.js";

import { ROLE_PERMISSIONS } 
from "./permissions.map.js";



function log(type, msg, data = null) {
 console[type](`[PERMISSIONS] ${msg}`, data || "");
}


/* =========================
   APLICAR PERMISSÕES UI
========================= */

export async function applyPermissions() {
 try {

  const role = await getRole();

  if (!role) {
   log("warn", "Role não encontrada");
   return;
  }

  log("info", "Aplicando role", role);

  /* REMOVE ÁREA ADMIN */
  if (role !== "admin") {
   document
    .querySelectorAll(".admin-only")
    .forEach(el => el.remove());
  }

  /* VISUALIZADOR */
  if (role === "viewer") {
   document
    .querySelectorAll(
     "button:not(.allow-viewer)"
    )
    .forEach(btn => {
     btn.disabled = true;
     btn.classList.add("disabled");
    });
  }

 } catch (err) {

  log("error", "Erro permissions", err);

 }
}

/* =========================
   SPA HELPER
========================= */

/* =========================
   CheckPermission
========================= */

let skipOverridesTable = false;

export async function checkPermission(permission) {
  // 1️⃣ precisa existir org ativa
  const orgId = getActiveOrg();
  if (!orgId) {
    console.warn("[PERMISSIONS] Org ativa não definida");
    return false;
  }

  // 2️⃣ usuário autenticado
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return false;
  }

  // 3️⃣ override explícito (opcional – tabela pode não existir no projeto)
  let override = null;
  if (!skipOverridesTable) {
    try {
      const { data, error } = await supabase
        .from("organization_user_permissions")
        .select("allowed")
        .eq("user_id", user.id)
        .eq("org_id", orgId)
        .eq("permission", permission)
        .maybeSingle();
      if (error) skipOverridesTable = true;
      else override = data;
      // Compatibilidade: auditoria:view / auditoria:acknowledge aceitam override de logs:view / logs:acknowledge
      if (!override && (permission === "auditoria:view" || permission === "auditoria:acknowledge")) {
        const legacy = permission === "auditoria:view" ? "logs:view" : "logs:acknowledge";
        const { data: legacyData } = await supabase
          .from("organization_user_permissions")
          .select("allowed")
          .eq("user_id", user.id)
          .eq("org_id", orgId)
          .eq("permission", legacy)
          .maybeSingle();
        if (legacyData) override = legacyData;
      }
    } catch (_) {
      skipOverridesTable = true;
    }
  }

  if (override) {
    return override.allowed === true;
  }

  // 4️⃣ role técnico do usuário na org
  const { data: membership, error } = await supabase
    .from("organization_users")
    .select("role")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .single();

  if (error || !membership) {
    return false;
  }

  const role = membership.role;

  // 5️⃣ master tem acesso total
  if (role === "master") {
    return true;
  }

  // 6️⃣ verifica permissões do role
  const allowed = ROLE_PERMISSIONS[role] || [];

  return allowed.includes(permission);
}