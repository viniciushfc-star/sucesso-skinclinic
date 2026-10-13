import { supabase }
 from "./supabase.js";

import { createOrganization, linkUserAsMaster, linkUserToOrganization, markInviteAsAccepted } from "../services/org.service.js";

import { createInvite} 
from "../services/invite.service.js";



const ORG_KEY = "active_org_id";
const MEMBERS_TTL_MS = 45_000;
let membersCache = { orgId: null, at: 0, data: null };

export function invalidateOrgMembersCache() {
  membersCache = { orgId: null, at: 0, data: null };
}

export function setActiveOrg(orgId) {
  const prev = localStorage.getItem(ORG_KEY);
  if (prev !== orgId) invalidateOrgMembersCache();
  localStorage.setItem(ORG_KEY, orgId);
}

export function getActiveOrg() {
  return localStorage.getItem(ORG_KEY);
}

/**
 * Aplica filtro org_id ao query builder (tabelas por org).
 * Uso: await withOrg(supabase.from('tabela').select('*'))
 */
export function withOrg(queryBuilder) {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return queryBuilder.eq("org_id", orgId);
}

export function clearActiveOrg() {
  invalidateOrgMembersCache();
  localStorage.removeItem(ORG_KEY);
}

export async function loadUserOrganizations() {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;

  if (!user) {
    console.warn("[ORG] Usuário não autenticado");
    return [];
  }

  const { data, error } = await supabase
    .from("organization_users")
    .select("org_id, role")
    .eq("user_id", user.id);

  if (error) {
    console.warn("[ORG] Erro ao carregar organizações", error);
    return [];
  }

  return data ?? [];
}

/**
 * Lista membros da organização ativa (para agenda: escolher profissional).
 */
export async function getOrgMembers() {
  const orgId = getActiveOrg();
  if (!orgId) return [];
  const now = Date.now();
  if (membersCache.orgId === orgId && membersCache.data && now - membersCache.at < MEMBERS_TTL_MS) {
    return membersCache.data;
  }
  const { data, error } = await supabase
    .from("organization_users")
    .select("user_id, role")
    .eq("org_id", orgId);
  if (error) {
    console.warn("[ORG] Erro ao carregar membros", error);
    return membersCache.data && membersCache.orgId === orgId ? membersCache.data : [];
  }
  const rows = data ?? [];
  const ids = rows.map((r) => r.user_id).filter(Boolean);
  const names = {};
  if (ids.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, nome").in("id", ids);
    for (const p of profiles || []) {
      const n = String(p?.nome || "").trim();
      if (p?.id && n) names[p.id] = n;
    }
  }
  const enriched = rows.map((r) => ({
    ...r,
    display_name: names[r.user_id] || null,
  }));
  membersCache = { orgId, at: now, data: enriched };
  return membersCache.data;
}

/* =========================
   CREATE ORG FLOW
========================= */
function isMissingCreateClinicRpc(error) {
  const code = String(error?.code || "");
  const msg = String(error?.message || "");
  return (
    code === "PGRST202" ||
    /could not find the function/i.test(msg) ||
    /schema cache/i.test(msg)
  );
}

export async function createOrgAndSetActive(name) {
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    throw new Error("Usuário não autenticado");
  }

  const trimmed = String(name || "").trim();
  if (!trimmed) {
    throw new Error("Informe o nome da clínica.");
  }

  const { data: rpcOrg, error: rpcErr } = await supabase.rpc("create_clinic", {
    p_name: trimmed,
  });

  if (!rpcErr) {
    const org = Array.isArray(rpcOrg) ? rpcOrg[0] : rpcOrg;
    if (org?.id) {
      setActiveOrg(org.id);
      return org;
    }
  }

  if (rpcErr && !isMissingCreateClinicRpc(rpcErr)) {
    console.error("[ORG] create_clinic", rpcErr);
    throw new Error(rpcErr.message || "Não foi possível criar a clínica.");
  }

  if (rpcErr) {
    console.warn("[ORG] create_clinic indisponível, insert direto", rpcErr);
  }

  const org = await createOrganization(trimmed, user.id);
  await linkUserAsMaster(org.id, user.id);
  setActiveOrg(org.id);
  return org;
}


/* =========================
   INVITE USER FLOW
========================= */
export async function inviteUser({ email, role }) {
  const orgId = getActiveOrg();

  if (!orgId) {
    throw new Error("Organização ativa não definida");
  }

  if (!email || !role) {
    throw new Error("Dados inválidos para convite");
  }

  await createInvite({
    orgId,
    email,
    role
  });
  invalidateOrgMembersCache();
}


export async function removeUserFromOrg(userId) {
  const orgId = getActiveOrg();

  if (!orgId) {
    throw new Error("Organização ativa não definida");
  }

  if (!userId) {
    throw new Error("Usuário inválido");
  }

  const { error } = await supabase
    .from("organization_users")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
  invalidateOrgMembersCache();
}

/* =========================
   CONVITE CLIENTE
========================= */

export async function acceptInviteAndSetActive(invite) {
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    throw new Error("Usuário não autenticado");
  }

  await linkUserToOrganization({
    orgId: invite.org_id,
    userId: user.id,
    role: invite.role
  });

  setActiveOrg(invite.org_id);

  await markInviteAsAccepted(invite.id);
}


