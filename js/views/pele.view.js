import { analisarPele }
from "../services/pele.service.js"

import { supabase }
from "../core/supabase.js"

btnAnalisar.onclick = async ()=>{

await supabase
.from("analise_pele")
.insert({
 user_id:user.id,
 cliente_id:id,
 fotos: imagens,
 resultado: res
})


 const files =
  document
   .getElementById("fotos")
   .files

 const imagens = []

 for(const f of files){
  imagens.push(
   URL.createObjectURL(f)
  )
 }

 const payload = {
  imagens,
  dados:{
   idade: idade.value,
   queixa: queixa.value,
   fototipo: fototipo.value
  }
 }

 resultado.innerText =
  "Analisando..."

 const res =
  await analisarPele(payload)

 resultado.innerText =
  res.content
}
