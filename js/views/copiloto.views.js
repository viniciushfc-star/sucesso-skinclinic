import { perguntarCopiloto }
from "../services/copiloto.service.js"

import { supabase }
from "../core/supabase.js"

import { getActiveOrg } from "../core/org.js"

try{

btnPerguntar.onclick =
 async ()=>{

 const { data:{ user }} =
  await supabase
 .from("copiloto_chat")
 .insert({
  pergunta,
  resposta:res.resposta,
  user_id:user.id,
  org_id:getActiveOrg()
 })


 resposta.innerText =
  "Pensando..."

 const res =
 await perguntarCopiloto({
  pergunta:pergunta.value,
  user_id:user.id
 })

 resposta.innerText =
  res.resposta
}


}catch(err){
 console.error("[COPILOTO]",err)
 toast("Erro ao consultar IA")
}
