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
  membersCache = { orgId, at: now, data: data ?? [] };
  return membersCache.data;
}

/* =========================
   CREATE ORG FLOW
========================= */
export async function createOrgAndSetActive(name) {
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    throw new Error("Usuário não autenticado");
  }

  // cria a clínica (owner_id para RLS)
  const org = await createOrganization(name, user.id);

  // vincula como master
  await linkUserAsMaster(org.id, user.id);

  // define como org ativa
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


