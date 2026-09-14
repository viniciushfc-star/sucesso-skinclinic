/**
 * Envia WhatsApp pela Cloud API (Meta) quando configurada.
 * POST /api/whatsapp-send  { phone, message, org_id }
 */
import { requireStaffAccess, sendAuthError } from "../lib/api-auth.js";

function digitsPhone(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d;
}

export default async function whatsappSend(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  try {
    await requireStaffAccess(req, { permission: "whatsapp:send" });
  } catch (e) {
    return sendAuthError(res, e);
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    return res.status(200).json({ sent: false, fallback: true, reason: "whatsapp_nao_configurado" });
  }

  const phone = digitsPhone(req.body?.phone);
  const message = String(req.body?.message || "").trim();
  if (phone.length < 12 || !message) {
    return res.status(400).json({ error: "Telefone ou mensagem inválidos" });
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
