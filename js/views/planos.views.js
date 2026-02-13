import {
 getPlanos,
 createAssinatura
} from "../services/payments.service.js"

import { toast }
from "../ui/toast.js"

/* =====================
   SPA INIT
===================== */

export function init(){
 renderPlanos()
}


/* =====================
   ELEMENTOS
===================== */

const listaPlanos =
 document.getElementById("listaPlanos")


/* =====================
   RENDER
===================== */

export async function renderPlanos(){

 try{

  const { data, error } =
   await getPlanos()

  if(error){
   toast(error.message)
   return
  }

  listaPlanos.innerHTML =
   data.map(p=>`
    <div
     class="item-card"
     data-id="${p.id}">

     <b>${p.nome}</b><br>
     R$ ${p.preco}<br>

     <button
      class="btn-primary btn-assinar">
      Assinar
     </button>
    </div>
   `).join("")

  bindActions()

 }catch(err){

  console.error(
   "[PLANOS] erro render",
   err
  )

  toast("Erro ao carregar planos")
 }
}


/* =====================
   ACTIONS
===================== */

function bindActions(){

 document
  .querySelectorAll(".btn-assinar")
  .forEach(btn=>{
   btn.onclick = ()=>{
    const id =
     btn.parentElement
      .dataset.id

    assinar(id)
   }
  })
}


async function assinar(id){

 try{

  await createAssinatura(id)
  toast("Plano ativado!")

 }catch(err){

  console.error(
   "[PLANOS] erro assinar",
   err
  )

  toast("Erro ao ativar plano")
 }
}
