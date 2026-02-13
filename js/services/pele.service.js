import { getApiBase } from "../core/api-base.js";

export async function analisarPele(payload){

 return fetch(`${getApiBase()}/api/pele`,{
  method:"POST",
  headers:{
   "Content-Type":"application/json"
  },
  body: JSON.stringify(payload)
 }).then(r=>r.json())
}
