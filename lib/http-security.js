import { createHash, timingSafeEqual } from "node:crypto";

const DEFAULT_ORIGINS = [
  "https://skinclinic-one.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

/** Compara segredos em tempo constante (via hash). */
export function secretsEqual(a, b) {
  const ha = createHash("sha256").update(String(a ?? ""), "utf8").digest();
  const hb = createHash("sha256").update(String(b ?? ""), "utf8").digest();
  return timingSafeEqual(ha, hb);
}

export function allowedOrigins() {
  const extra = String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const fromBase = String(process.env.BASE_URL || "").replace(/\/$/, "");
  const list = [...DEFAULT_ORIGINS, ...extra];
  if (fromBase && /^https?:\/\//i.test(fromBase)) list.push(fromBase);
  return [...new Set(list)];
}

export function corsOriginFor(requestOrigin) {
  if (!requestOrigin) return null;
  return allowedOrigins().includes(requestOrigin) ? requestOrigin : null;
}

const BLOCKED_STATIC = [
  /^\/routes(\/|$)/i,
  /^\/server\.js$/i,
  /^\/api\/index\.js$/i,
  /^\/\.env/i,
  /^\/google-key\.json$/i,
  /^\/package(-lock)?\.json$/i,
  /^\/supabase(\/|$)/i,
  /^\/scripts(\/|$)/i,
  /^\/node_modules(\/|$)/i,
];

export function isBlockedStaticPath(urlPath) {
  const p = String(urlPath || "").split("?")[0];
  return BLOCKED_STATIC.some((re) => re.test(p));
}
