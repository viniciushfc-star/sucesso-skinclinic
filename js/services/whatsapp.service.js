import { supabase } from "../core/supabase.js"

/**
 * Abre o WhatsApp (Web ou app) com o número do cliente e a mensagem pronta — melhor canal para aproximar clínica e cliente.
 * A mensagem pode conter link de confirmação de horário (portal.html?confirmToken=xxx).
 * Em ambiente com janela (navegador), abre wa.me; opcionalmente grava em whatsapp_logs para histórico.
 * Para envio automático (sem abrir janela), use uma API (Meta Cloud API ou BSP) e chame-a a partir de um backend/Edge Function.
 */
export async function sendWhatsapp(telefone, mensagem) {
  const tel = String(telefone ?? "").replace(/\D/g, "");
  const msg = String(mensagem ?? "").trim() || "Olá!";

  if (tel.length < 10) {
    console.warn("[WHATSAPP] Número inválido ou curto:", telefone);
    return { success: false };
  }

  // Brasil: 55 + DDD + 8 ou 9 dígitos
  const numeroCompleto = tel.length <= 11 ? "55" + tel : tel;

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
      status: "aberto_wa",
    });
  } catch (err) {
    console.warn("[WHATSAPP] insert log falhou (tabela whatsapp_logs pode não existir)", err);
  }

  return { success: true };
}
