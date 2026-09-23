/**
 * Auditoria de negócio: identidade e org vêm do JWT + membership, não do body.
 */
import { getAdminClient, requireStaffAccess, sendAuthError } from "../lib/api-auth.js";

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function clip(value, max) {
  const s = String(value ?? "").trim();
  return s ? s.slice(0, max) : null;
}

export default async function auditLog(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  let auth;
  try {
    auth = await requireStaffAccess(req, { permission: "dashboard:view" });
  } catch (e) {
    return sendAuthError(res, e);
  }

  const action = clip(req.body?.action, 160);
  if (!action) return res.status(400).json({ error: "Informe a ação." });

  let metadata = {};
  if (req.body?.metadata && typeof req.body.metadata === "object" && !Array.isArray(req.body.metadata)) {
    const raw = JSON.stringify(req.body.metadata);
    if (raw.length <= 4000) {
      try {
        metadata = JSON.parse(raw);
      } catch {
        metadata = {};
      }
    }
  }

  const row = {
    org_id: auth.orgId,
    user_id: auth.user.id,
    user_email: auth.user.email || null,
    role_technical: auth.membership?.role || null,
    job_title: clip(req.body?.job_title || req.body?.metadata?.job_title, 80),
    action,
    table_name: clip(req.body?.tableName || req.body?.table_name, 80),
    record_id: isUuid(req.body?.recordId || req.body?.record_id)
      ? String(req.body.recordId || req.body.record_id)
      : null,
    permission_used: clip(req.body?.permissionUsed || req.body?.permission_used, 80),
    metadata,
  };

  const { error } = await getAdminClient().from("audit_logs").insert(row);
  if (error) {
    console.error("[audit-log]", error.message);
    return res.status(500).json({ error: "Erro interno" });
  }
  return res.status(200).json({ ok: true });
}
