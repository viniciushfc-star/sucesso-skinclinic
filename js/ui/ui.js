import { toast }
from "./toast.js"

export function showLoading(
 btn,
 text="Processando..."
){
 btn.disabled = true
 btn.dataset.text =
  btn.innerText
 btn.innerText = text
}

export function resetBtn(btn){
 btn.disabled = false
 btn.innerText =
  btn.dataset.text
}

export function showError(msg){
 toast(msg,"error")
}

export function showSuccess(msg){
 toast(msg,"success")
}

export function loading(show){
 document.body
  .classList
  .toggle("loading",show)
}


/* =====================
   OFFLINE
===================== */

window.addEventListener(
 "offline",()=>{
  toast(
   "Você está offline",
   "error"
  )
 }
)
