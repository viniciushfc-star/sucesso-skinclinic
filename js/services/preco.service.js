import { getApiBase } from "../core/api-base.js";

export async function gerarPreco(payload){

 return fetch(`${getApiBase()}/api/preco`,{
  method:"POST",
  headers:{
   "Content-Type":"application/json"
  },
  body: JSON.stringify(payload)
 }).then(r=>r.json())
}
