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
  /^\/lib(\/|$)/i,
  /^\/ai(\/|$)/i,
  /^\/server\.js$/i,
  /^\/api\/index\.js$/i,
  /^\/\.env/i,
  /^\/google-key\.json$/i,
  /^\/package(-lock)?\.json$/i,
  /^\/vercel\.json$/i,
  /^\/supabase(\/|$)/i,
  /^\/scripts(\/|$)/i,
  /^\/node_modules(\/|$)/i,
  /^\/\.git(\/|$)/i,
];

export function isBlockedStaticPath(urlPath) {
  const p = String(urlPath || "").split("?")[0];
  return BLOCKED_STATIC.some((re) => re.test(p));
}

const HTML_NO_STORE = new Set([
  "/",
  "/dashboard",
  "/onboarding",
  "/agendar",
  "/reset",
  "/select-org",
  "/accept-invite",
  "/portal",
]);

/** HTML da SPA não deve ficar em cache de CDN/browser após o deploy. */
export function shouldNoStoreHtml(urlPath) {
  const p = String(urlPath || "").split("?")[0] || "/";
  if (/\.html$/i.test(p)) return true;
  return HTML_NO_STORE.has(p);
}

export function applyBrowserSecurityHeaders(res, req) {
  if (!res?.setHeader) return;
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (req && shouldNoStoreHtml(req.path || req.url)) {
    res.setHeader("Cache-Control", "no-store");
  }
}
