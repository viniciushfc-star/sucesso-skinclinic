import { apiFetch } from "../core/api-fetch.js";

export async function gerarProtocolo(payload){
  return apiFetch("/api/protocolo", { method: "POST", json: payload }).then((r) => r.json());
}
