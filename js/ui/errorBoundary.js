import { toast }
from "./toast.js"

export function initErrorBoundary(){

 window.onerror = function(
  message,
  source,
  lineno,
  colno,
  error
 ){
  console.error(
   "[GLOBAL ERROR]",
   error || message
  )

  toast(
   "Algo deu errado. Tente novamente.",
   "error",
   5000
  )

  return true
 }

 window.addEventListener(
  "unhandledrejection",
  e=>{
   console.error(
    "[PROMISE ERROR]",
    e.reason
   )

   toast(
    "Erro inesperado.",
    "error",
    5000
   )
  }
 )
}
