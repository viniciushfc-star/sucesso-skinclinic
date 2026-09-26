/**
 * Lembrete de confirmação: 1ª vez ou 2ª se não respondeu.
 * Envio sempre no clique; nunca sozinho.
 */

export function rotuloLembrete({ reminder_sent_at, confirmed_at } = {}) {
  if (confirmed_at) {
    return { n: 0, enviar: false, label: "ok", title: "Presença confirmada" };
  }
  if (reminder_sent_at) {
    return {
      n: 2,
      enviar: true,
      label: "2ª",
      title: "Não respondeu — segunda tentativa (você envia)",
    };
  }
  return {
    n: 1,
    enviar: true,
    label: "1ª",
    title: "Lembrete e pedido de confirmação",
  };
}

export function origemLembreteWhatsapp(n) {
  return Number(n) >= 2 ? "agenda_lembrete_2" : "agenda_lembrete";
}
