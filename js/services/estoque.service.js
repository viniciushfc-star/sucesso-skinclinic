import { apiFetch } from "../core/api-fetch.js";

export async function analisarEstoque(payload){
  try {
    return await apiFetch("/api/estoque", { method: "POST", json: payload }).then((r) => r.json());
  } catch (err) {
    console.error("[ESTOQUE_API]", err);
    throw err;
  }
}
