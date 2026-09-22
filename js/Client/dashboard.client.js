import {
  getSharedRecords,
  getActiveProtocol,
  reportClientEvent,
  getSkincareRotinaByToken,
  getAnalisesPeleByToken,
  listAnamnesePortalByToken,
  getClientByToken,
} from "./client-portal.service.js";
import { listPortalJornadaAgenda, listPortalAppointments } from "./agenda-portal.service.js";
import { toast } from "./ui/toast.client.js";
import { buildPortalJornada } from "../utils/portal-jornada.js";

const app =
 document.getElementById("app");

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function token() {
  try { return sessionStorage.getItem("client_portal_token"); } catch { return null; }
}

export async function init(){

 try{

  app.innerHTML =
   "<p>Carregando...</p>";

  const t = token();
  const [protocol, records, skincareRotina, cliente, anamneses, analises, sessoes] = await Promise.all([
    safeGetProtocol(),
    getSharedRecords().catch(() => []),
    getSkincareRotinaByToken().catch(() => null),
    t ? getClientByToken(t).catch(() => null) : Promise.resolve(null),
    listAnamnesePortalByToken().catch(() => []),
    getAnalisesPeleByToken().catch(() => []),
    listPortalJornadaAgenda().catch(() => listPortalAppointments().catch(() => [])),
  ]);

  const jornada = buildPortalJornada({
    today: todayLocal(),
    cadastroCompleto: !!(cliente?.registration_completed_at),
    anamneses: anamneses || [],
    analises: analises || [],
    sessoes: sessoes || [],
    hasSkincare: !!skincareRotina,
  });

  renderDashboard(protocol, records || [], !!skincareRotina, jornada);

 }catch(err){

  console.error(
   "[CLIENT DASHBOARD]",
   err
  );

  toast(
   "Erro ao carregar informações"
  );
  app.innerHTML =
   "<p>Não foi possível carregar o portal. Tente o link de novo ou peça um novo à clínica.</p>";
 }
}

async function safeGetProtocol(){
 try{
  return await getActiveProtocol();
 }catch{
  return null;
 }
}

function renderDashboard(
  protocol,
  records,
  hasSkincareRotina = false,
  jornada = []
) {
  const stepsHtml = (jornada || []).map((s) => `
    <li class="portal-jornada-item portal-jornada-item--${s.estado}">
      <button type="button" class="portal-jornada-btn" data-hash="${s.hash}">
        <span class="portal-jornada-titulo">${escapeHtml(s.titulo)}</span>
        <span class="portal-jornada-estado">${labelEstado(s.estado)}</span>
        <span class="portal-jornada-detalhe">${escapeHtml(s.detalhe)}</span>
      </button>
    </li>
  `).join("");

  app.innerHTML = `
  <section class="client-header">
   <h2>Minha jornada</h2>
   <p>
    ${
     protocol
      ? "Acompanhamento ativo com a clínica"
      : "O que já aconteceu e o próximo passo — só o que a clínica validou"
    }
   </p>
  </section>

  <section class="portal-jornada">
   <ol class="portal-jornada-list">${stepsHtml}</ol>
  </section>

  <section class="client-records">
   <h3>Orientações recentes</h3>

   ${
    records.length
     ? records.map(renderRecord).join("")
     : "<p>Nenhuma orientação compartilhada no momento.</p>"
   }
  </section>

  <section class="client-actions">
   <button id="btnAgendaPortal" class="btn-agenda-portal">
    Agendar ou remarcar
   </button>
   <p class="client-action-hint">Escolha um horário livre. A clínica vê na agenda.</p>
   <button id="btnAnamnesePortal" class="btn-anamnese-portal">
    Anamnese à distância
   </button>
   <p class="client-action-hint">Ficha de saúde para a clínica receber antes da consulta. O profissional confirma no atendimento.</p>
   <button id="btnAnalisePele" class="btn-analise-pele">
    Análise de pele
   </button>
   <p class="client-action-hint">Pré-anamnese com fotos: organize suas queixas. Não é diagnóstico; o profissional valida.</p>
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

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function labelEstado(estado) {
  if (estado === "feito") return "Feito";
  if (estado === "aguardando") return "Aguardando";
  if (estado === "pendente") return "Pendente";
  return "Disponível";
}

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

function bindActions() {
  document.querySelectorAll(".portal-jornada-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const hash = btn.getAttribute("data-hash");
      if (hash) window.location.hash = `#${hash}`;
    });
  });
  document.getElementById("btnAgendaPortal")?.addEventListener("click", () => {
    window.location.hash = "#agenda";
  });
  document.getElementById("btnAnamnesePortal")?.addEventListener("click", () => {
    window.location.hash = "#anamnese";
  });
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
