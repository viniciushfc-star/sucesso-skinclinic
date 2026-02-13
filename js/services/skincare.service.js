/**
 * Gera análise de skincare via IA
 * NÃO salva nada
 */
export async function gerarSkincare(payload){

 if(!payload)
  throw new Error("Payload inválido")

 // aqui pode ser:
 // - fetch para API externa
 // - edge function
 // - worker interno

 const { getApiBase } = await import("../core/api-base.js");
 const response =
  await fetch(`${getApiBase()}/api/skincare-ai`,{
   method:"POST",
   headers:{
    "Content-Type":"application/json"
   },
   body:JSON.stringify(payload)
  })

 if(!response.ok)
  throw new Error("Erro na IA")

 const result =
  await response.json()

 return result
}

