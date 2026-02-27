/**
 * Gera relatório legível do backup para leigos (sem aspas, JSON ou termos técnicos).
 * Usado para exportar em PDF e Word.
 */

function escapeHtml(s) {
  if (s == null || s === "") return "";
  const t = String(s);
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? String(s) : d.toLocaleDateString("pt-BR");
}

/**
 * Retorna { text, html } com o conteúdo do backup em linguagem simples.
 */
export function backupToReadableReport(backup) {
  const lines = [];
  const dataRef = new Date().toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  lines.push("BACKUP – Cópia dos dados da clínica");
  lines.push("Gerado em: " + dataRef);
  lines.push("");

  // Clientes
  const clientes = backup.clientes || [];
  lines.push("────────────────────────────────────────");
  lines.push("CLIENTES (" + clientes.length + " cadastro(s))");
  lines.push("────────────────────────────────────────");
  if (clientes.length === 0) {
    lines.push("Nenhum cliente cadastrado.");
  } else {
    clientes.forEach((c, i) => {
      lines.push("");
      lines.push((i + 1) + ". " + (c.nome || "—"));
      lines.push("   E-mail: " + (c.email || "—"));
      lines.push("   Telefone: " + (c.telefone || "—"));
      lines.push("   CPF: " + (c.cpf || "—"));
      lines.push("   Data de nascimento: " + (c.data_nascimento ? fmtDate(c.data_nascimento) : "—"));
      if (c.observacoes) lines.push("   Observações: " + c.observacoes);
    });
  }
  lines.push("");

  // Procedimentos
  const procedimentos = backup.procedimentos || [];
  lines.push("────────────────────────────────────────");
  lines.push("PROCEDIMENTOS (" + procedimentos.length + " cadastrado(s))");
  lines.push("────────────────────────────────────────");
  if (procedimentos.length === 0) {
    lines.push("Nenhum procedimento cadastrado.");
  } else {
    procedimentos.forEach((p, i) => {
      lines.push("");
      lines.push((i + 1) + ". " + (p.nome || "—"));
      if (p.descricao) lines.push("   Descrição: " + p.descricao);
      lines.push("   Duração: " + (p.duracao_minutos ?? "—") + " min");
      if (p.valor_cobrado !== "" && p.valor_cobrado != null) lines.push("   Valor: R$ " + p.valor_cobrado);
    });
  }
  lines.push("");

  // Financeiro
  const financeiro = backup.financeiro || [];
  lines.push("────────────────────────────────────────");
  lines.push("FINANCEIRO (" + financeiro.length + " lançamento(s))");
  lines.push("────────────────────────────────────────");
  if (financeiro.length === 0) {
    lines.push("Nenhum lançamento financeiro.");
  } else {
    financeiro.forEach((f, i) => {
      const tipo = (f.tipo || "saída") === "entrada" ? "Entrada" : "Saída";
      const valor = f.valor != null ? "R$ " + Number(f.valor).toFixed(2).replace(".", ",") : "—";
      lines.push("");
      lines.push((i + 1) + ". " + fmtDate(f.data) + " · " + tipo + " · " + valor);
      lines.push("   " + (f.descricao || "—"));
      if (f.categoria_saida) lines.push("   Categoria: " + f.categoria_saida);
    });
  }
  lines.push("");

  // Agenda
  const agenda = backup.agenda || [];
  lines.push("────────────────────────────────────────");
  lines.push("AGENDA (" + agenda.length + " agendamento(s))");
  lines.push("────────────────────────────────────────");
  if (agenda.length === 0) {
    lines.push("Nenhum agendamento.");
  } else {
    agenda.forEach((a, i) => {
      lines.push("");
      lines.push((i + 1) + ". " + fmtDate(a.data) + " às " + (a.hora || "—"));
      lines.push("   Cliente: " + (a.cliente || "—"));
      lines.push("   Procedimento: " + (a.procedimento || "—"));
      lines.push("   Duração: " + (a.duracao_minutos ?? "—") + " min");
    });
  }

  const text = lines.join("\n");

  // HTML para Word (limpo, sem JSON)
  const htmlParts = [];
  htmlParts.push("<!DOCTYPE html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><title>Backup - " + escapeHtml(dataRef) + "</title>");
  htmlParts.push("<style>body{font-family:Segoe UI,Calibri,Arial,sans-serif;margin:24px;color:#222;}");
  htmlParts.push("h1{font-size:18px;margin-bottom:4px;} .meta{color:#555;font-size:14px;margin-bottom:20px;}");
  htmlParts.push("h2{font-size:15px;margin-top:24px;margin-bottom:8px;border-bottom:1px solid #ccc;}");
  htmlParts.push("p{margin:4px 0;} .item{margin-bottom:12px;} .label{color:#555;} table{border-collapse:collapse;width:100%;margin-top:8px;}");
  htmlParts.push("th,td{border:1px solid #ddd;padding:6px 10px;text-align:left;} th{background:#f5f5f5;}</style></head><body>");
  htmlParts.push("<h1>Backup – Cópia dos dados da clínica</h1>");
  htmlParts.push("<p class=\"meta\">Gerado em: " + escapeHtml(dataRef) + "</p>");

  htmlParts.push("<h2>Clientes (" + clientes.length + ")</h2>");
  if (clientes.length === 0) {
    htmlParts.push("<p>Nenhum cliente cadastrado.</p>");
  } else {
    htmlParts.push("<table><thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>CPF</th></tr></thead><tbody>");
    clientes.forEach((c) => {
      htmlParts.push("<tr><td>" + escapeHtml(c.nome || "—") + "</td><td>" + escapeHtml(c.email || "—") + "</td><td>" + escapeHtml(c.telefone || "—") + "</td><td>" + escapeHtml(c.cpf || "—") + "</td></tr>");
    });
    htmlParts.push("</tbody></table>");
  }

  htmlParts.push("<h2>Procedimentos (" + procedimentos.length + ")</h2>");
  if (procedimentos.length === 0) {
    htmlParts.push("<p>Nenhum procedimento cadastrado.</p>");
  } else {
    htmlParts.push("<table><thead><tr><th>Nome</th><th>Duração (min)</th><th>Valor</th></tr></thead><tbody>");
    procedimentos.forEach((p) => {
      const valor = p.valor_cobrado !== "" && p.valor_cobrado != null ? "R$ " + p.valor_cobrado : "—";
      htmlParts.push("<tr><td>" + escapeHtml(p.nome || "—") + "</td><td>" + (p.duracao_minutos ?? "—") + "</td><td>" + escapeHtml(valor) + "</td></tr>");
    });
    htmlParts.push("</tbody></table>");
  }

  htmlParts.push("<h2>Financeiro (" + financeiro.length + " lançamentos)</h2>");
  if (financeiro.length === 0) {
    htmlParts.push("<p>Nenhum lançamento financeiro.</p>");
  } else {
    htmlParts.push("<table><thead><tr><th>Data</th><th>Tipo</th><th>Valor</th><th>Descrição</th></tr></thead><tbody>");
    financeiro.forEach((f) => {
      const tipo = (f.tipo || "saída") === "entrada" ? "Entrada" : "Saída";
      const valor = f.valor != null ? "R$ " + Number(f.valor).toFixed(2).replace(".", ",") : "—";
      htmlParts.push("<tr><td>" + escapeHtml(fmtDate(f.data)) + "</td><td>" + tipo + "</td><td>" + valor + "</td><td>" + escapeHtml(f.descricao || "—") + "</td></tr>");
    });
    htmlParts.push("</tbody></table>");
  }

  htmlParts.push("<h2>Agenda (" + agenda.length + " agendamentos)</h2>");
  if (agenda.length === 0) {
    htmlParts.push("<p>Nenhum agendamento.</p>");
  } else {
    htmlParts.push("<table><thead><tr><th>Data</th><th>Hora</th><th>Cliente</th><th>Procedimento</th></tr></thead><tbody>");
    agenda.forEach((a) => {
      htmlParts.push("<tr><td>" + escapeHtml(fmtDate(a.data)) + "</td><td>" + escapeHtml(a.hora || "—") + "</td><td>" + escapeHtml(a.cliente || "—") + "</td><td>" + escapeHtml(a.procedimento || "—") + "</td></tr>");
    });
    htmlParts.push("</tbody></table>");
  }

  htmlParts.push("</body></html>");
  const html = htmlParts.join("");

  return { text, html };
}
