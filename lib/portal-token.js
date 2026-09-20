/**
 * Sessão do portal da paciente: token opaco, hash no banco, TTL curto.
 * O valor em claro só existe na URL no momento da criação.
 */

import { createHash } from "node:crypto";

export const PORTAL_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashPortalToken(token) {
  return createHash("sha256").update(String(token || ""), "utf8").digest("hex");
}

/** Só em máquina local. Produção e Preview da Vercel nunca pulam clientes:manage. */
export function isPortalSessionDevBypassEnabled() {
  if (process.env.ALLOW_PORTAL_SESSION_DEV !== "1") return false;
  if (process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview") {
    return false;
  }
  if (process.env.NODE_ENV === "production") return false;
  return true;
}
