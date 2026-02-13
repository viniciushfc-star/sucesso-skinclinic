import { sendClientMessage } from "./client-portal.service.js";
import { toast } from "./ui/toast.client.js";

const app =
 document.getElementById("app");

/* =========================
   INIT
========================= */

export function init(){

 render();
 bind();
}

/* =========================
   RENDER
========================= */

function render(){

 app.innerHTML = `
  <section class="client-header">
   <h2>Fale com sua clínica</h2>
   <p>
    Relate qualquer reação,
    desconforto ou dúvida.
   </p>
  </section>

  <section class="client-form">
   <textarea
    id="msg"
    rows="5"
    placeholder="Escreva aqui..."
   ></textarea>

   <button id="btnSend">
    Enviar mensagem
   </button>

   <button id="btnBack">
    Voltar
   </button>
  </section>
 `;
}

/* =========================
   EVENTS
========================= */

function bind(){

 document
  .getElementById(
   "btnSend"
  )
  .onclick = send;

 document
  .getElementById(
   "btnBack"
  )
  .onclick =
   ()=> window.location.hash =
    "#dashboard";
}

/* =========================
   ACTION
========================= */

async function send(){

 const textarea =
  document.getElementById("msg");

 const message =
  textarea.value.trim();

 if(!message){
  toast("Escreva uma mensagem");
  return;
 }

 try{

  await sendClientMessage(message);

  toast(
   "Mensagem enviada. A clínica irá analisar."
  );

  textarea.value = "";

 }catch(err){

  console.error(
   "[CLIENT MESSAGE]",
   err
  );

  toast(
   "Erro ao enviar mensagem"
  );
 }
}
