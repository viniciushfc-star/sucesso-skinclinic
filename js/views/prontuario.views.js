import {
 getRecordsByProtocol,
 createRecord
} from "../services/client-records.service.js"

import { audit }
from "../services/audit.service.js"

import { toast }
from "../ui/toast.js"

import {
 showLoader,
 hideLoader
} from "../ui/loader.js"

let protocolId = null
let clientId = null
let records = []

export async function init(){

 const params =
  new URLSearchParams(
   window.location.search
  )

 protocolId =
  params.get("protocol")

 clientId =
  params.get("client")

 if(!protocolId || !clientId){
  toast("Prontuário inválido")
  return
 }

 await loadRecords()
 bindCreate()
}

/* =========================
   LOAD
========================= */

async function loadRecords(){

 try{

  showLoader()

  records =
   await getRecordsByProtocol(
    protocolId
   )

  renderRecords()

 }catch(err){

  console.error(
   "[PRONTUARIO] load error",
   err
  )

  toast(
   "Erro ao carregar prontuário"
  )

 }finally{

  hideLoader()
 }
}

/* =========================
   RENDER
========================= */

function renderRecords(){

 const container =
  document.getElementById(
   "prontuarioList"
  )

 if(!container) return

 if(!records.length){
  container.innerHTML =
   "<p>Nenhum registro ainda</p>"
  return
 }

 container.innerHTML =
  records.map(r=>`
   <div class="item-card">
    <b>${r.record_type}</b>
    <small>
     (${r.visibility})
    </small><br>

    <pre>
${JSON.stringify(r.content,null,2)}
    </pre>

    <small>
     ${new Date(
      r.created_at
     ).toLocaleString()}
    </small>
   </div>
  `).join("")
}

/* =========================
   CREATE
========================= */

function bindCreate(){

 const form =
  document.getElementById(
   "prontuarioForm"
  )

 if(!form) return

 form.onsubmit =
  async e => {

   e.preventDefault()

   const type =
    form.record_type.value

   const visibility =
    form.visibility.value

   const text =
    form.content.value.trim()

   if(!text){
    toast("Conteúdo obrigatório")
    return
   }

   try{

    showLoader()

    const record =
     await createRecord({
      clientId,
      protocolId,
      recordType: type,
      visibility,
      content: {
       text
      }
     })

    await audit({
     action: "cliente.record.create",
     tableName: "client_records",
     recordId: record.id,
     permissionUsed: "clientes:manage",
     metadata: {
      record_type: type,
      visibility
     }
    })

    form.reset()
    records.unshift(record)
    renderRecords()
    toast("Registro adicionado")

   }catch(err){

    console.error(
     "[PRONTUARIO] create error",
     err
    )

    toast(
     "Erro ao salvar registro"
    )

   }finally{

    hideLoader()
   }
 }
}
