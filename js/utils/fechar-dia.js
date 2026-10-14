/**
 * Fechar o dia: previsto da agenda vs recebido das baixas vs atraso.
 * Humano confirma. Não lança financeiro. WhatsApp não sai daqui.
 */

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function round2(v) {
  return Math.round(n(v) * 100) / 100;
}

export function amanhaIso(hoje) {
  const d = new Date(`${String(hoje || "").slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function pendentesLembrete(appointments = []) {
  return (appointments || []).filter((a) => {
    if (!a || a.item_type === "event" || a.cancelled_at) return false;
    if (a.confirmed_at) return false;
    if (a.reminder_sent_at) return false;
    return true;
  });
}

export function montarFecharDia({
  data = "",
  hojeCount = 0,
  previsto = 0,
  recebido = 0,
  atrasos = 0,
} = {}) {
  const prev = round2(previsto);
  const rec = round2(recebido);
  const gap = round2(prev - rec);
  let status = "vazio";
  if (n(hojeCount) > 0 || prev > 0.009 || rec > 0.009) status = "ok";
  if (n(atrasos) > 0 || gap > 0.009) status = "aberto";
  const linhas = [
    { id: "horarios", label: "Horários hoje", valor: String(n(hojeCount)), fonte: "agenda de hoje" },
    { id: "previsto", label: "Previsto", valor: prev, fonte: "cadastro de procedimentos na agenda", fmt: "brl" },
    { id: "recebido", label: "Recebido", valor: rec, fonte: "baixas do financeiro ligadas à agenda", fmt: "brl" },
    { id: "atrasos", label: "Atrasos", valor: String(n(atrasos)), fonte: "agenda de hoje" },
  ];
  if (gap > 0.009) {
    linhas.push({
      id: "gap",
      label: "Ainda não baixado",
      valor: gap,
      fonte: "previsto menos recebido",
      fmt: "brl",
    });
  }
  return {
    data: String(data || "").slice(0, 10),
    status,
    previsto: prev,
    recebido: rec,
    atrasos: n(atrasos),
    hojeCount: n(hojeCount),
    gap,
    linhas,
    lead:
      status === "vazio"
        ? "Sem horário nem baixa hoje. Não há o que fechar."
        : status === "aberto"
          ? "O dia ainda tem furo: atraso ou previsto que não virou recebido. Confirmar não lança caixa."
          : "Previsto e recebido se encontram. Confirmar só grava auditoria.",
  };
}

export function payloadAuditoriaFecharDia(resumo) {
  return {
    data: resumo?.data || null,
    previsto: resumo?.previsto ?? 0,
    recebido: resumo?.recebido ?? 0,
    atrasos: resumo?.atrasos ?? 0,
    hojeCount: resumo?.hojeCount ?? 0,
    gap: resumo?.gap ?? 0,
    status: resumo?.status || "",
  };
}

export function chaveSessaoFecharDia(iso) {
  return `sc-fechar-dia:${String(iso || "").slice(0, 10)}`;
}
