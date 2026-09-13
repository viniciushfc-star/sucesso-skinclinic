import { apiFetch } from "../core/api-fetch.js";

export async function gerarPreco(payload){
  return apiFetch("/api/preco", { method: "POST", json: payload }).then((r) => r.json());
}
