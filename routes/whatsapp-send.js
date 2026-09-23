/**
 * Envia WhatsApp pela Cloud API (Meta) quando configurada.
 * POST /api/whatsapp-send  { phone, message, org_id }
 * Destino tem de ser telefone de clients ou agenda_waitlist da org.
 * wa.me no frontend continua livre se a API recusar.
 */
import { getAdminClient, requireStaffAccess, sendAuthError } from "../lib/api-auth.js";
import { canonicalPhoneDigits, orgOwnsWhatsappDestination } from "../lib/phone-match.js";

export default async function whatsappSend(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  let auth;
  try {
    auth = await requireStaffAccess(req, { permission: "whatsapp:send" });
  } catch (e) {
    return sendAuthError(res, e);
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    return res.status(200).json({ sent: false, fallback: true, reason: "whatsapp_nao_configurado" });
  }

  const phone = canonicalPhoneDigits(req.body?.phone);
  const message = String(req.body?.message || "").trim();
  if (phone.length < 12 || !message) {
    return res.status(400).json({ error: "Telefone ou mensagem inválidos" });
  }

  let owned = false;
  try {
    owned = await orgOwnsWhatsappDestination(getAdminClient(), auth.orgId, phone);
  } catch (e) {
    console.error("[whatsapp-send] ownership", e?.message || e);
    return res.status(500).json({ error: "Erro interno" });
  }
  if (!owned) {
    return res.status(403).json({ error: "Sem permissão", reason: "telefone_fora_da_org" });
  }

  const apiUrl = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { preview_url: true, body: message }
    })
  });
  const detail = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("[whatsapp-send] Meta API", response.status);
    return res.status(200).json({ sent: false, fallback: true, reason: "api_erro" });
  }
  return res.status(200).json({ sent: true, id: detail.messages?.[0]?.id });
}
