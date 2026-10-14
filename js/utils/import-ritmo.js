/**
 * Ritual do import: mapa e prévia antes de gravar.
 * Atalhos da Agenda/Financeiro/Procedimentos caem na mesma tela.
 * WhatsApp não sai. Sem desfazer automático.
 */

const ROTULO = {
  clientes: "clientes",
  procedimentos: "procedimentos",
  financeiro: "lançamentos",
  custo_fixo: "custo fixo",
  agenda: "horários",
};

export function rotuloTipoImportacao(tipo) {
  return ROTULO[String(tipo || "")] || "linhas";
}

export function irParaImportacaoComPrevia(tipo, navigate) {
  const t = String(tipo || "clientes").trim() || "clientes";
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem("importTipoPrefill", t);
  }
  if (typeof navigate === "function") navigate("export");
}

export function textoConfirmarImportacao({ tipo = "clientes", total = 0, okEstimado = 0 } = {}) {
  const n = Number(okEstimado) || 0;
  const t = Number(total) || 0;
  return `Vai gravar cerca de ${n} de ${t} linha(s) de ${rotuloTipoImportacao(tipo)}. Duplicado entra só se você pediu. WhatsApp não sai. Sem desfazer automático.`;
}

export function textoErroPlanilha(err) {
  const t = String(err?.message || err || "").toLowerCase();
  if ((t.includes(".xls") || t.includes("xls antigo")) && !t.includes("xlsx")) {
    return "Arquivo .xls antigo. No Excel: Salvar como .xlsx ou CSV. Nada foi gravado.";
  }
  if (/zip|sheet|xlsx|deflate|corrupt|não deu para ler este excel/.test(t)) {
    return "Não deu para ler este Excel. Salve como .xlsx ou CSV. Nada foi gravado.";
  }
  if (/nenhuma linha|empty|sem cabeçalho/.test(t)) {
    return "Nenhuma linha válida na planilha. Nada foi gravado.";
  }
  return "Não deu para ler a planilha. Nada foi gravado.";
}
