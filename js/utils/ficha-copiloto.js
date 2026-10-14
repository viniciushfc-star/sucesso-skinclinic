/**
 * Contexto da ficha para o Copiloto. Explica o ciclo. Não decide, não grava, sem WhatsApp.
 */

export function contextoFichaCopiloto({
  nome = "",
  proxima = "",
  combinado = "",
  receita = "",
  feito = "",
  avisoMaterial = false,
} = {}) {
  const linhas = [
    proxima ? `Próximo passo humano: ${proxima}` : "",
    combinado ? `Combinado: ${combinado}` : "",
    receita ? `Receita: ${receita}` : "",
    feito ? `Feito: ${feito}` : "",
    avisoMaterial ? "Há registro feito sem produto de estoque." : "",
    "Explique o ciclo desta ficha. Não grave preço, não mande WhatsApp, não decida o tratamento.",
  ].filter(Boolean);
  return {
    origem: "ficha",
    titulo: `Ficha: ${String(nome || "paciente").trim() || "paciente"}`.slice(0, 120),
    mensagem: linhas.join("\n").slice(0, 900),
  };
}
