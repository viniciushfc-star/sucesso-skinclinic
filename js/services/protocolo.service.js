import { getApiBase } from "../core/api-base.js";

export async function gerarProtocolo(payload){

 return fetch(`${getApiBase()}/api/protocolo`,{
  method:"POST",
  headers:{
   "Content-Type":"application/json"
  },
  body: JSON.stringify(payload)
 }).then(r=>r.json())
}
