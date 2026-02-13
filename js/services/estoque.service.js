export async function analisarEstoque(payload){

 try{

  const { getApiBase } = await import("../core/api-base.js");
  return await fetch(`${getApiBase()}/api/estoque`,{
   method:"POST",
   headers:{
    "Content-Type":"application/json"
   },
   body: JSON.stringify(payload)
  }).then(r=>r.json())

 }catch(err){
  console.error("[ESTOQUE_API]",err)
  throw err
 }
}
