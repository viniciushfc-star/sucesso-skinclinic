/**
 * Gera relatório mastigado para o contador: uma linha por cliente + totais.
 */

function escapeHtml(s) {
  if (s == null || s === "") return "";
  const t = String(s);
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtMoney(v) {
  if (v == null || Number.isNaN(v)) return "R$ 0,00";
  return "R$ " + Number(v).toFixed(2).replace(".", ",");
}

/**
 * @param {Object} rel - { clientes: Array<{nome, cpf, email, atendimentos}>, totais: { entradas, saidas, clientesAtivos }, periodo: { dataInicio, dataFim } }
 * @param {string} nomeClinica - opcional
 */
export function relatorioContadorToReadable(rel, nomeClinica = "") {
  const dataRef = new Date().toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const de = rel.periodo?.dataInicio ? new Date(rel.periodo.dataInicio + "T12:00:00").toLocaleDateString("pt-BR") : "";
  const ate = rel.periodo?.dataFim ? new Date(rel.periodo.dataFim + "T12:00:00").toLocaleDateString("pt-BR") : "";

  const lines = [];
  lines.push("Relatório para contador");
  if (nomeClinica) lines.push(nomeClinica);
  lines.push("Período: " + de + " a " + ate);
  lines.push("Gerado em: " + dataRef);
  lines.push("");
  lines.push("Resumo por cliente (dados mastigados – um bloco por cliente)");
  lines.push("────────────────────────────────────────");

  const clientes = rel.clientes || [];
  if (clientes.length === 0) {
    lines.push("Nenhum cliente com atendimento no período.");
  } else {
    clientes.forEach((c, i) => {
      lines.push("");
      lines.push((i + 1) + ". " + (c.nome || "—"));
      lines.push("   CPF: " + (c.cpf || "—"));
      lines.push("   E-mail: " + (c.email || "—"));
      lines.push("   Atendimentos no período: " + (c.atendimentos ?? 0));
    });
  }

  lines.push("");
  lines.push("────────────────────────────────────────");
  lines.push("Totais do período");
  lines.push("────────────────────────────────────────");
  lines.push("Total de entradas: " + fmtMoney(rel.totais?.entradas));
  lines.push("Total de saídas: " + fmtMoney(rel.totais?.saidas));
  lines.push("Resultado (entradas − saídas): " + fmtMoney((rel.totais?.entradas ?? 0) - (rel.totais?.saidas ?? 0)));
  lines.push("Clientes no relatório: " + (rel.totais?.clientesAtivos ?? 0));

  const text = lines.join("\n");

  const htmlParts = [];
  htmlParts.push("<!DOCTYPE html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><title>Relatório para contador - " + escapeHtml(de) + " a " + escapeHtml(ate) + "</title>");
  htmlParts.push("<style>body{font-family:Segoe UI,Calibri,Arial,sans-serif;margin:24px;color:#222;}");
  htmlParts.push("h1{font-size:18px;} .meta{color:#555;font-size:14px;margin-bottom:16px;}");
  htmlParts.push("h2{font-size:15px;margin-top:20px;border-bottom:1px solid #ccc;}");
  htmlParts.push(".cliente{margin-bottom:14px;padding:10px;background:#f8fafc;border-radius:8px;}");
  htmlParts.push(".cliente-nome{font-weight:600;} .totais{margin-top:20px;padding:12px;background:#f0fdf4;border-radius:8px;}</style></head><body>");
  htmlParts.push("<h1>Relatório para contador</h1>");
  if (nomeClinica) htmlParts.push("<p class=\"meta\">" + escapeHtml(nomeClinica) + "</p>");
  htmlParts.push("<p class=\"meta\">Período: " + escapeHtml(de) + " a " + escapeHtml(ate) + " · Gerado em: " + escapeHtml(dataRef) + "</p>");
  htmlParts.push("<h2>Resumo por cliente</h2>");

  if (clientes.length === 0) {
    htmlParts.push("<p>Nenhum cliente com atendimento no período.</p>");
  } else {
    clientes.forEach((c, i) => {
      htmlParts.push("<div class=\"cliente\">");
      htmlParts.push("<span class=\"cliente-nome\">" + (i + 1) + ". " + escapeHtml(c.nome || "—") + "</span><br>");
      htmlParts.push("CPF: " + escapeHtml(c.cpf || "—") + " · E-mail: " + escapeHtml(c.email || "—") + "<br>");
      htmlParts.push("Atendimentos no período: " + (c.atendimentos ?? 0));
      htmlParts.push("</div>");
    });
  }

  htmlParts.push("<div class=\"totais\"><h2>Totais do período</h2>");
  htmlParts.push("<p>Total de entradas: " + escapeHtml(fmtMoney(rel.totais?.entradas)) + "</p>");
  htmlParts.push("<p>Total de saídas: " + escapeHtml(fmtMoney(rel.totais?.saidas)) + "</p>");
  htmlParts.push("<p><strong>Resultado (entradas − saídas): " + escapeHtml(fmtMoney((rel.totais?.entradas ?? 0) - (rel.totais?.saidas ?? 0))) + "</strong></p>");
  htmlParts.push("<p>Clientes no relatório: " + (rel.totais?.clientesAtivos ?? 0) + "</p></div>");
  htmlParts.push("</body></html>");

  return { text, html: htmlParts.join("") };
}
