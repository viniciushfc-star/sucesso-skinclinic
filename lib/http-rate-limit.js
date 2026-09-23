/**
 * Teto curto por IP e tipo de rota. Não substitui authz.
 * Em serverless o contador é por instância; ainda reduz rajada no mesmo isolate.
 */

const buckets = new Map();

export const RATE_WINDOWS = {
  ai: { max: 25, windowMs: 60_000 },
  whatsapp: { max: 8, windowMs: 60_000 },
  portal: { max: 12, windowMs: 60_000 },
  invite: { max: 8, windowMs: 60_000 },
  webhook: { max: 60, windowMs: 60_000 },
};

export function clientRateKey(req) {
  const xf = String(req?.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = xf || req?.socket?.remoteAddress || req?.ip || "unknown";
  return ip.slice(0, 64);
}

export function bucketForPath(pathname) {
  const p = String(pathname || "").split("?")[0];
  if (
    /^\/api\/(copiloto|preco|marketing|ocr|estoque|estudo-caso|discussao-caso|protocolo|pele|skincare|calendario-conteudo|analise-pele)(\/|$)/.test(
      p
    )
  ) {
    return "ai";
  }
  if (/^\/api\/(whatsapp-send|lembretes-auto)(\/|$)/.test(p)) return "whatsapp";
  if (/^\/api\/(create-portal-session|analise-pele-portal-list)(\/|$)/.test(p)) return "portal";
  if (/^\/api\/send-invite-email(\/|$)/.test(p)) return "invite";
  if (/webhook/.test(p)) return "webhook";
  return null;
}

export function consumeRateLimit(key, bucket, now = Date.now()) {
  const spec = RATE_WINDOWS[bucket];
  if (!spec || !key) return { ok: true };
  const mapKey = `${bucket}:${key}`;
  let hits = buckets.get(mapKey) || [];
  hits = hits.filter((t) => now - t < spec.windowMs);
  if (hits.length >= spec.max) {
    const retryAfterSec = Math.max(1, Math.ceil((spec.windowMs - (now - hits[0])) / 1000));
    return { ok: false, retryAfterSec };
  }
  hits.push(now);
  buckets.set(mapKey, hits);
  return { ok: true, remaining: spec.max - hits.length };
}

export function resetRateLimitForTests() {
  buckets.clear();
}

function bypassEnabled(req) {
  const secret = process.env.QA_RATE_BYPASS;
  if (!secret) return false;
  const header = String(req?.headers?.["x-qa-bypass"] || "");
  return header === secret;
}

/**
 * @returns {boolean} true se pode seguir
 */
export function enforceHttpRateLimit(req, res) {
  const path = String(req.path || req.url || "").split("?")[0];
  if (path === "/api/health" || path.startsWith("/api/health")) return true;
  if (bypassEnabled(req)) return true;
  const bucket = bucketForPath(path);
  if (!bucket) return true;
  const hit = consumeRateLimit(clientRateKey(req), bucket);
  if (!hit.ok) {
    if (res && !res.headersSent) {
      res.setHeader("Retry-After", String(hit.retryAfterSec));
      res.status(429).json({ error: "Muitas tentativas. Aguarde um momento." });
    }
    return false;
  }
  return true;
}
