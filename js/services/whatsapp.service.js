import { supabase } from "../core/supabase.js";
import { apiFetch } from "../core/api-fetch.js";
import { getActiveOrg } from "../core/org.js";
import { getEventsByClient } from "./client-events.service.js";
import { mapaSilencioPorCliente, estaEmSilencio } from "../utils/whatsapp-regua.js";

/**
 * Tenta envio pela Cloud API (só telefone de cliente/espera da org no servidor).
 * Se a API recusar ou não estiver configurada, abre o WhatsApp (wa.me) — envio humano.
 * Nunca envia lista: um telefone por chamada.
 */
export async function sendWhatsapp(telefone, mensagem, meta = {}) {
  const tel = String(telefone ?? "").replace(/\D/g, "");
  const msg = String(mensagem ?? "").trim() || "Olá!";
  const origem = String(meta.origem || "").slice(0, 40);
  const clientId = String(meta.clientId || meta.client_id || "").trim();
  const waitlistId = String(meta.waitlistId || meta.waitlist_id || "").trim();

  if (clientId) {
    try {
      const evs = await getEventsByClient(clientId);
      const hoje = new Date().toISOString().slice(0, 10);
      if (estaEmSilencio(mapaSilencioPorCliente(evs, hoje), clientId)) {
        return { success: false, via: "silencio" };
      }
    } catch (_) {}
  }

  if (tel.length < 10 && !clientId && !waitlistId) {
    console.warn("[WHATSAPP] Número inválido ou curto:", telefone);
    return { success: false };
  }

  const numeroCompleto = tel.length && tel.length <= 11 ? "55" + tel : tel;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const jwt = sessionData?.session?.access_token;
    if (jwt && (clientId || waitlistId)) {
      const res = await apiFetch("/api/whatsapp-send", {
        method: "POST",
        json: {
          message: msg,
          client_id: clientId || undefined,
          waitlist_id: waitlistId || undefined,
        },
      });
      const json = await res.json().catch(() => ({}));
      if (json.reason === "silencio_humano") {
        return { success: false, via: "silencio" };
      }
      if (json.sent) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.from("whatsapp_logs").insert({
            user_id: user?.id ?? null,
            telefone: numeroCompleto || null,
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

  if (typeof window !== "undefined" && window.open && numeroCompleto.length >= 12) {
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

export async function listWhatsappLogs(limit = 40) {
  const orgId = getActiveOrg();
  if (!orgId) return [];
  let q = await supabase
    .from("whatsapp_logs")
    .select("id, telefone, destino, status, created_at, mensagem, detalhe, org_id")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (q.error && /org_id|column|schema cache/i.test(String(q.error.message || ""))) {
    q = await supabase
      .from("whatsapp_logs")
      .select("id, telefone, status, created_at, mensagem")
      .order("created_at", { ascending: false })
      .limit(limit);
  }
  if (q.error) return [];
  return q.data || [];
}
