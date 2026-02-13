import {
  getSharedRecords,
  getActiveProtocol,
  reportClientEvent,
  getSkincareRotinaByToken,
} from "./client-portal.service.js";
import { toast } from "./ui/toast.client.js";

const app =
 document.getElementById("app");

/* =========================
   INIT
========================= */

export async function init(){

 try{

  app.innerHTML =
   "<p>Carregando...</p>";

  const [protocol, records, skincareRotina] = await Promise.all([
    safeGetProtocol(),
    getSharedRecords(),
    getSkincareRotinaByToken().catch(() => null),
  ]);

  renderDashboard(protocol, records, !!skincareRotina);

 }catch(err){

  console.error(
   "[CLIENT DASHBOARD]",
   err
  );

  toast(
   "Erro ao carregar informações"
  );
 }
}

/* =========================
   HELPERS
========================= */

async function safeGetProtocol(){
 try{
  return await getActiveProtocol();
 }catch{
  return null;
 }
}

/* =========================
   RENDER
========================= */

function renderDashboard(
  protocol,
  records,
  hasSkincareRotina = false
) {
  app.innerHTML = `
  <section class="client-header">
   <h2>Seu tratamento</h2>
   <p>
    ${
     protocol
      ? "Acompanhamento ativo"
      : "Nenhum tratamento ativo no momento"
    }
   </p>
  </section>

  <section class="client-records">
   <h3>Orientações recentes</h3>

   ${
    records.length
     ? records.map(renderRecord).join("")
     : "<p>Nenhuma orientação disponível.</p>"
   }
  </section>

  <section class="client-actions">
   <button id="btnAnalisePele" class="btn-analise-pele">
    Análise de pele
   </button>
   <p class="client-action-hint">Pré-anamnese: organize suas queixas e prepare o cuidado com um profissional. Não é diagnóstico; o profissional valida.</p>
   ${hasSkincareRotina ? `
   <button id="btnSkincareRotina" class="btn-skincare-rotina">
    Minha rotina de skincare
   </button>
   <p class="client-action-hint">Rotina liberada pela clínica para você acompanhar em casa.</p>
   ` : ""}
   <button id="btnEvolucao">
    Ver evolução
   </button>
   <button id="btnRelatarEvento">
    Relatar evento
   </button>
   <button id="btnMensagem">
    Relatar reação ou dúvida
   </button>
  </section>

  <section class="client-relato-form hidden" id="relatoEventoForm">
   <h3>Relatar evento</h3>
   <p class="client-hint">Conte o que aconteceu (sintoma, reação, dúvida). O profissional verá na sua linha do tempo.</p>
   <input type="text" id="relatoEventoTipo" placeholder="Ex: Reação na pele, Dúvida sobre produto">
   <textarea id="relatoEventoDesc" rows="3" placeholder="Descreva (opcional)"></textarea>
   <button id="btnEnviarRelato">Enviar</button>
   <button type="button" id="btnCancelarRelato" class="btn-secondary">Cancelar</button>
  </section>
 `;

 bindActions();
}

/* =========================
   RECORD ITEM
========================= */

function renderRecord(r){

 return `
  <div class="record-card">
   <small>
    ${
     new Date(
      r.created_at
     ).toLocaleDateString()
    }
   </small>

   <p>
    ${formatContent(r)}
   </p>
  </div>
 `;
}

function formatContent(r){
 if(typeof r.content === "string")
  return r.content;

 if(r.content?.text)
  return r.content.text;

 return "Atualização do tratamento";
}

/* =========================
   ACTIONS
========================= */

function bindActions() {
  document.getElementById("btnAnalisePele")?.addEventListener("click", () => {
    window.location.hash = "#analise-pele";
  });
  document.getElementById("btnSkincareRotina")?.addEventListener("click", () => {
    window.location.hash = "#skincare-rotina";
  });
  document.getElementById("btnEvolucao").onclick = () => {
    window.location.hash = "#evolucao";
  };

  document.getElementById("btnRelatarEvento").onclick = () => {
    const form = document.getElementById("relatoEventoForm");
    if (form) form.classList.remove("hidden");
  };

  document.getElementById("btnCancelarRelato")?.addEventListener("click", () => {
    const form = document.getElementById("relatoEventoForm");
    if (form) form.classList.add("hidden");
    document.getElementById("relatoEventoTipo").value = "";
    document.getElementById("relatoEventoDesc").value = "";
  });

  document.getElementById("btnEnviarRelato")?.addEventListener("click", async () => {
    const tipo = document.getElementById("relatoEventoTipo")?.value?.trim();
    const desc = document.getElementById("relatoEventoDesc")?.value?.trim();
    if (!tipo) {
      toast("Informe o tipo do evento");
      return;
    }
    try {
      await reportClientEvent(tipo, desc || null);
      toast("Evento enviado. O profissional verá na sua ficha.");
      document.getElementById("relatoEventoForm")?.classList.add("hidden");
      document.getElementById("relatoEventoTipo").value = "";
      document.getElementById("relatoEventoDesc").value = "";
    } catch (err) {
      console.error(err);
      toast(err?.message || "Erro ao enviar");
    }
  });

  document.getElementById("btnMensagem").onclick = () => {
    window.location.hash = "#mensagens";
  };
}
