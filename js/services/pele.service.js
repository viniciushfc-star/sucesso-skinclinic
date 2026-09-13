import { apiFetch } from "../core/api-fetch.js";

export async function analisarPele(payload){
  return apiFetch("/api/pele", { method: "POST", json: payload }).then((r) => r.json());
}
