/**
 * Status das integrações (sem vazar segredos).
 * GET /api/integracoes-status
 */
import { requireStaffAccess, sendAuthError } from "../lib/api-auth.js";

export default async function integracoesStatus(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Método não permitido" });

  try {
    await requireStaffAccess(req, { orgRequired: false });
  } catch (e) {
    return sendAuthError(res, e);
  }

  return res.status(200).json({
    ok: true,
    cron_secret: Boolean(process.env.CRON_SECRET),
    whatsapp: Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID),
    resend: Boolean(process.env.RESEND_API_KEY),
    supabase_admin: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY),
    base_url: Boolean(process.env.BASE_URL),
  });
}
