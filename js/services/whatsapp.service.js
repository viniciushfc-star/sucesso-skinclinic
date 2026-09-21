import { supabase } from "../core/supabase.js";
import { apiFetch } from "../core/api-fetch.js";

/**
 * Tenta envio pela Cloud API; se não estiver configurada, abre o WhatsApp (wa.me).
 * Nunca envia lista: um telefone por chamada.
 */
export async function sendWhatsapp(telefone, mensagem, meta = {}) {
  const tel = String(telefone ?? "").replace(/\D/g, "");
  const msg = String(mensagem ?? "").trim() || "Olá!";
  const origem = String(meta.origem || "").slice(0, 40);

  if (tel.length < 10) {
    console.warn("[WHATSAPP] Número inválido ou curto:", telefone);
    return { success: false };
  }

  const numeroCompleto = tel.length <= 11 ? "55" + tel : tel;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const jwt = sessionData?.session?.access_token;
    if (jwt) {
      const res = await apiFetch("/api/whatsapp-send", {
        method: "POST",
        json: { phone: numeroCompleto, message: msg },
      });
      const json = await res.json().catch(() => ({}));
      if (json.sent) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.from("whatsapp_logs").insert({
            user_id: user?.id ?? null,
            telefone: numeroCompleto,
            mensagem: msg,
            status: origem ? `enviado_api:${origem}` : "enviado_api",
          });
        } catch (_) {}
        return { success: true, via: "api" };
      }
    }
  } catch (err) {
    console.warn("[WHATSAPP] API indisponível, usando wa.me", err);
  }

  if (typeof window !== "undefined" && window.open) {
    const url = `https://wa.me/${numeroCompleto}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("whatsapp_logs").insert({
      user_id: user?.id ?? null,
      telefone: numeroCompleto,
      mensagem: msg,
      status: origem ? `aberto_wa:${origem}` : "aberto_wa",
    });
  } catch (_) {}

  return { success: true, via: "wa" };
}
