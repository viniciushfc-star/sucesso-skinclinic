import { gerarPreco }
from "../services/preco.service.js"

import { supabase }
from "../core/supabase.js"

btnGerarPreco.onclick =
 async ()=>{

 const payload = {
  custos:{
   sessao: custoSessao.value,
   produto: custoProduto.value
  },
  protocolo: protocoloAtual,
  mercado:{
   ticket: ticketMedio.value,
   concorrencia: concorrencia.value
  }
 }

 resultadoPreco.innerText =
  "Calculando..."

 const res =
  await gerarPreco(payload)

 resultadoPreco.innerText =
  res.content

 await supabase
  .from("precificacao_ia")
  .insert({
   user_id:user.id,
   protocolo_id:idProtocolo,
   custo: custoSessao.value,
   preco_min:res.preco_min,
   preco_ideal:res.preco_ideal,
   margem:res.margem,
   parcelamento:res.parcelamento
  })
}
