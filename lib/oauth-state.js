/**
 * State OAuth assinado (HMAC-SHA256).
 * Impede forjar userId/orgId no callback do Google Calendar.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TTL_MS = 15 * 60 * 1000;

export function getOAuthStateSecret() {
  return (
    process.env.GOOGLE_OAUTH_STATE_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    ""
  );
}

function sign(payloadB64, secret) {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * @param {{ userId: string, orgId: string }} claims
 * @param {string} [secret]
 */
export function createSignedOAuthState(claims, secret = getOAuthStateSecret()) {
  if (!secret) throw new Error("oauth_state_secret_missing");
  const userId = String(claims.userId || "").trim();
  const orgId = String(claims.orgId || "").trim();
  if (!userId || !orgId) throw new Error("oauth_state_claims_invalid");
  const payload = {
    userId,
    orgId,
    exp: Date.now() + TTL_MS,
    n: randomBytes(16).toString("hex"),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

/**
 * @returns {{ userId: string, orgId: string } | null}
 */
export function verifySignedOAuthState(stateRaw, secret = getOAuthStateSecret()) {
  if (!secret || !stateRaw || typeof stateRaw !== "string") return null;
  const parts = stateRaw.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;
  const expected = sign(payloadB64, secret);
  if (!safeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (!payload?.userId || !payload?.orgId) return null;
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
    return { userId: String(payload.userId), orgId: String(payload.orgId) };
  } catch {
    return null;
  }
}
