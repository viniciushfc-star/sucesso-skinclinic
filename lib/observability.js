/**
 * Observabilidade mínima P1-9: 5xx, latência lenta, falha de webhook.
 * Não grava body, token nem chave. Persistência via service role.
 */

import { getAdminClient, getRequestedOrgId } from "./api-auth.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return UUID_RE.test(String(value || ""));
}

export function sanitizeObsMessage(raw, max = 180) {
  let s = String(raw || "")
    .replace(/\s+/g, " ")
    .trim();
  s = s.replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
  s = s.replace(/sk-[a-zA-Z0-9_-]+/g, "[key]");
  s = s.replace(/eyJ[a-zA-Z0-9_-]{20,}/g, "[jwt]");
  return s.slice(0, max);
}

export function routeName(req) {
  const raw = String(req?.originalUrl || req?.url || req?.path || "").split("?")[0];
  return raw.slice(0, 120) || "/";
}

export function shouldPersistApiEvent(status, kind) {
  if (kind === "webhook_fail") return true;
  return Number(status) >= 500;
}

function orgFromReq(req) {
  const fromAuth = req?.auth?.orgId;
  if (isUuid(fromAuth)) return fromAuth;
  if (isUuid(req?.webhookOrgId)) return req.webhookOrgId;
  const ctx = getRequestedOrgId(req);
  return isUuid(ctx) ? ctx : null;
}

export function persistApiEvent(row) {
  const payload = {
    org_id: isUuid(row.orgId) ? row.orgId : null,
    route: String(row.route || "").slice(0, 160) || null,
    method: String(row.method || "").slice(0, 12) || null,
    status: Number(row.status) || 0,
    duration_ms: Number.isFinite(Number(row.durationMs)) ? Number(row.durationMs) : null,
    kind: String(row.kind || "api_5xx").slice(0, 40),
    message: sanitizeObsMessage(row.message || ""),
    request_id: String(row.requestId || "").slice(0, 64) || null,
  };
  if (!shouldPersistApiEvent(payload.status, payload.kind)) return Promise.resolve();
  return Promise.resolve()
    .then(() => getAdminClient())
    .then((admin) => admin.from("api_error_events").insert(payload))
    .then(({ error }) => {
      if (error) console.warn("[OBS] persist", error.message);
    })
    .catch((e) => {
      console.warn("[OBS] persist skip", e?.message || e);
    });
}

/**
 * Anexa finish/close. 5xx vai ao banco; ≥4s só no log.
 */
export function startApiObservation(req, res) {
  const started = Date.now();
  const requestId =
    (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
    `r${Date.now()}`;
  const finish = () => {
    res.off("finish", finish);
    res.off("close", finish);
    const path = routeName(req);
    if (!path.startsWith("/api") || path === "/api/health") return;
    const status = res.statusCode || 0;
    const durationMs = Date.now() - started;
    const line = {
      ts: new Date().toISOString(),
      requestId,
      method: req.method,
      route: path,
      status,
      durationMs,
    };
    if (status >= 500) {
      console.error("[API_5XX]", JSON.stringify(line));
      const kind = path.includes("webhook-transacoes") ? "webhook_fail" : "api_5xx";
      persistApiEvent({
        ...line,
        kind,
        orgId: orgFromReq(req),
        message: res.locals?.obsMessage || "",
      });
    } else if (durationMs >= 4000) {
      console.warn("[API_SLOW]", JSON.stringify(line));
    }
  };
  res.on("finish", finish);
  res.on("close", finish);
  return {
    noteError(err) {
      res.locals = res.locals || {};
      res.locals.obsMessage = sanitizeObsMessage(err?.message || err);
    },
  };
}

export function recordWebhookFailure({ orgId, status, message, durationMs } = {}) {
  const line = {
    ts: new Date().toISOString(),
    route: "/api/webhook-transacoes",
    method: "POST",
    status: Number(status) || 500,
    kind: "webhook_fail",
    orgId: orgId || null,
    message: sanitizeObsMessage(message),
    durationMs,
  };
  console.error("[WEBHOOK_FAIL]", JSON.stringify({ ...line, orgId: isUuid(line.orgId) ? line.orgId : null }));
  return persistApiEvent(line);
}
