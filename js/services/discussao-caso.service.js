import { apiFetch } from "../core/api-fetch.js";

/**
 * Pedido de opinião da IA sobre um caso.
 */
export async function pedirOpiniaoCaso(caso) {
  const texto = typeof caso === "string" ? caso.trim() : "";
  if (!texto) throw new Error("Descreva o caso para pedir opinião.");

  const res = await apiFetch("/api/discussao-caso", {
    method: "POST",
    json: { caso: texto },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Erro ao pedir opinião da IA.");
  }

  const data = await res.json();
  return data.content || "";
}
