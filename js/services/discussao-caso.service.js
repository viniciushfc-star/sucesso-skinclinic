import { getApiBase } from "../core/api-base.js";

/**
 * Pedido de opinião da IA sobre um caso — discussão + procedimentos sugeridos + referências para estudo.
 * Não substitui o profissional; prepara para alinhar procedimentos a cada caso.
 */
export async function pedirOpiniaoCaso(caso) {
  const texto = typeof caso === "string" ? caso.trim() : "";
  if (!texto) throw new Error("Descreva o caso para pedir opinião.");

  const res = await fetch(`${getApiBase()}/api/discussao-caso`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caso: texto }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Erro ao pedir opinião da IA.");
  }

  const data = await res.json();
  return data.content || "";
}
