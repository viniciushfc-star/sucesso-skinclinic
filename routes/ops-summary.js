/**
 * Resumo operacional da org: 5xx/webhook + custo de IA do mês.
 * GET/POST /api/ops-summary
 */

import { requireStaffAccess, sendAuthError, getAdminClient } from "../lib/api-auth.js";

function monthStartIso() {
  const d = new Date();
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `${ym}-01T00:00:00.000Z`;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  let auth;
  try {
    auth = await requireStaffAccess(req, { permission: "auditoria:view" });
  } catch (e) {
    return sendAuthError(res, e);
  }

  const orgId = auth.orgId;
  const start = monthStartIso();
  let errors = [];
  let aiMonthUsd = 0;
  let byFeature = [];

  try {
    const admin = getAdminClient();
    const { data: errRows } = await admin
      .from("api_error_events")
      .select("id, route, method, status, duration_ms, kind, message, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(30);
    errors = errRows || [];

    const { data: aiRows } = await admin
      .from("ai_usage_events")
      .select("feature, cost_usd")
      .eq("org_id", orgId)
      .gte("created_at", start);
    const map = new Map();
    for (const row of aiRows || []) {
      const feat = String(row.feature || "unknown");
      const usd = Number(row.cost_usd || 0);
      aiMonthUsd += usd;
      map.set(feat, (map.get(feat) || 0) + usd);
    }
    byFeature = [...map.entries()]
      .map(([feature, costUsd]) => ({
        feature,
        costUsd: Math.round(costUsd * 1e6) / 1e6,
      }))
      .sort((a, b) => b.costUsd - a.costUsd);
  } catch (e) {
    console.warn("[OPS-SUMMARY]", e?.message || e);
  }

  return res.json({
    ok: true,
    orgId,
    ai: {
      monthUsd: Math.round(aiMonthUsd * 1e6) / 1e6,
      byFeature,
    },
    errors,
  });
}
