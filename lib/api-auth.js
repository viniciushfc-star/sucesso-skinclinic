/**
 * Autenticação/autorização central das APIs (P0-01).
 * Identidade = JWT Supabase. org_id do cliente é contexto, não prova.
 */

import { createClient } from "@supabase/supabase-js";
import { ROLE_PERMISSIONS, normalizeRole } from "../js/core/permissions.map.js";
import { secretsEqual } from "./http-security.js";

export class ApiAuthError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

let anonClient;
let adminClient;

export function getAnonAuthClient() {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new ApiAuthError(500, "Erro interno");
  }
  if (!anonClient) {
    anonClient = createClient(url, anon, { auth: { persistSession: false } });
  }
  return anonClient;
}

export function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new ApiAuthError(500, "Erro interno");
  }
  if (!adminClient) {
    adminClient = createClient(url, key, { auth: { persistSession: false } });
  }
  return adminClient;
}

export function extractBearer(req) {
  const raw = String(req.headers?.authorization || "");
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

export function getRequestedOrgId(req) {
  const b = req.body || {};
  const q = req.query || {};
  return String(
    b.org_id || b.orgId || b.org || q.org_id || q.orgId || q.org || ""
  ).trim();
}

export function isCronAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers["x-cron-secret"] || extractBearer(req);
  if (!header) return false;
  return secretsEqual(header, secret);
}

export function sendAuthError(res, err) {
  const status = err?.status === 403 ? 403 : err?.status === 401 ? 401 : err?.status === 400 ? 400 : 500;
  if (status === 401) return res.status(401).json({ error: "Não autenticado" });
  if (status === 403) return res.status(403).json({ error: "Sem permissão" });
  if (status === 400) return res.status(400).json({ error: err.message || "Requisição inválida" });
  console.error("[API-AUTH]", err?.message || err);
  return res.status(500).json({ error: "Erro interno" });
}

export async function authenticateRequest(req) {
  const token = extractBearer(req);
  if (!token) throw new ApiAuthError(401, "Não autenticado");
  const { data, error } = await getAnonAuthClient().auth.getUser(token);
  if (error || !data?.user) throw new ApiAuthError(401, "Não autenticado");
  return { user: data.user, token };
}

export async function requireOrganizationMember(userId, orgId) {
  if (!orgId) throw new ApiAuthError(400, "Informe a organização.");
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("organization_users")
    .select("org_id, role")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) {
    console.error("[API-AUTH] membership", error.message);
    throw new ApiAuthError(500, "Erro interno");
  }
  if (!data) throw new ApiAuthError(403, "Sem permissão");
  return data;
}

function permissionAllowedByRole(role, permission) {
  const r = normalizeRole(role);
  if (r === "master") return true;
  const allowed = ROLE_PERMISSIONS[r] || [];
  if (allowed.includes("*")) return true;
  if (allowed.includes(permission)) return true;
  if (permission === "auditoria:view" && allowed.includes("logs:view")) return true;
  if (permission === "auditoria:acknowledge" && allowed.includes("logs:acknowledge")) return true;
  return false;
}

/** Tabela de override ainda não existe no projeto: usa só a role, sem 500. */
export function isMissingPermissionCatalog(error) {
  const code = String(error?.code || "");
  const msg = String(error?.message || "");
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /does not exist|could not find the table|schema cache/i.test(msg)
  );
}

/** Produção/preview Vercel: catálogo ausente = negar (não cair na role). */
export function isDeployedRuntime() {
  const vercel = process.env.VERCEL_ENV;
  if (vercel === "production" || vercel === "preview") return true;
  return process.env.NODE_ENV === "production";
}

/**
 * Override no banco ganha da role. Erro na consulta = FAIL-CLOSED (não cai no default da role).
 */
export function applyPermissionDecision(overrideRow, queryError, membershipRole, permission) {
  if (queryError) throw new ApiAuthError(500, "Erro interno");
  if (overrideRow) {
    if (overrideRow.allowed === true) return true;
    throw new ApiAuthError(403, "Sem permissão");
  }
  if (!permissionAllowedByRole(membershipRole, permission)) {
    throw new ApiAuthError(403, "Sem permissão");
  }
  return true;
}

export async function requirePermission(userId, orgId, permission, membershipRole) {
  if (!permission) return true;
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("organization_user_permissions")
    .select("allowed")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("permission", permission)
    .maybeSingle();
  if (error && !isMissingPermissionCatalog(error)) {
    console.error("[API-AUTH] permission", error.message);
    throw new ApiAuthError(500, "Erro interno");
  }
  if (error && isMissingPermissionCatalog(error) && isDeployedRuntime()) {
    console.error("[API-AUTH] permission catalog ausente em runtime implantado");
    throw new ApiAuthError(500, "Erro interno");
  }
  let override = error ? null : data;
  if (!override && (permission === "auditoria:view" || permission === "auditoria:acknowledge")) {
    const legacy = permission === "auditoria:view" ? "logs:view" : "logs:acknowledge";
    const { data: legacyData, error: legacyErr } = await admin
      .from("organization_user_permissions")
      .select("allowed")
      .eq("user_id", userId)
      .eq("org_id", orgId)
      .eq("permission", legacy)
      .maybeSingle();
    if (legacyErr && !isMissingPermissionCatalog(legacyErr)) {
      console.error("[API-AUTH] permission-legacy", legacyErr.message);
      throw new ApiAuthError(500, "Erro interno");
    }
    if (legacyErr && isMissingPermissionCatalog(legacyErr) && isDeployedRuntime()) {
      console.error("[API-AUTH] permission catalog ausente em runtime implantado");
      throw new ApiAuthError(500, "Erro interno");
    }
    override = legacyErr ? null : legacyData;
  }
  return applyPermissionDecision(override, null, membershipRole, permission);
}

export async function requireAnyMembership(userId) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("organization_users")
    .select("org_id, role")
    .eq("user_id", userId)
    .limit(1);
  if (error) {
    console.error("[API-AUTH] any-membership", error.message);
    throw new ApiAuthError(500, "Erro interno");
  }
  if (!data?.length) throw new ApiAuthError(403, "Sem permissão");
  return data[0];
}

/**
 * JWT + (opcional) org + membership + permission.
 * org_id do body/query é contexto. user_id do body é ignorado.
 */
export async function requireStaffAccess(req, { permission, orgRequired = true } = {}) {
  const { user } = await authenticateRequest(req);
  const bodyUserId = req.body?.user_id || req.body?.userId || req.query?.userId;
  if (bodyUserId && String(bodyUserId) !== String(user.id)) {
    console.warn("[API-AUTH] user_id do cliente ignorado; usando JWT", { jwtUser: user.id });
  }
  const orgId = getRequestedOrgId(req);
  if (orgRequired) {
    if (!orgId) throw new ApiAuthError(400, "Informe a organização.");
    const membership = await requireOrganizationMember(user.id, orgId);
    if (permission) await requirePermission(user.id, orgId, permission, membership.role);
    return { user, orgId, membership };
  }
  await requireAnyMembership(user.id);
  let membership = null;
  if (orgId) {
    membership = await requireOrganizationMember(user.id, orgId);
    if (permission) await requirePermission(user.id, orgId, permission, membership.role);
  }
  return { user, orgId: orgId || null, membership };
}

export function guardStaffApi(handler, options = {}) {
  return async function guarded(req, res) {
    try {
      req.auth = await requireStaffAccess(req, options);
      return await handler(req, res);
    } catch (err) {
      if (err instanceof ApiAuthError || err?.status === 401 || err?.status === 403 || err?.status === 400) {
        return sendAuthError(res, err);
      }
      throw err;
    }
  };
}

/** Testes unitários: mesma regra de role do frontend. */
export function permissionAllowedByRoleForTest(role, permission) {
  return permissionAllowedByRole(role, permission);
}
