import { initClientSession, confirmarHorarioByToken }
from "./client-portal.service.js";

import { toast }
from "./ui/toast.client.js";

const routes = {
  "completar-cadastro": {
    view: () => import("./completar-cadastro.client.js")
  },
  "termo-consent": {
    view: () => import("./termo-consent.client.js")
  },
  dashboard: {
    view: () => import("./dashboard.client.js")
  },
  mensagens: {
    view: () => import("./mensagens.client.views.js")
  },
  "analise-pele": {
    view: () => import("./analise-pele.client.js")
  },
  "skincare-rotina": {
    view: () => import("./skincare-rotina.client.js")
  }
};

let currentView = null;

/* =========================
   BOOTSTRAP
========================= */

async function bootstrap() {
  const params = new URLSearchParams(window.location.search);
  const confirmToken = params.get("confirmToken");

  if (confirmToken) {
    try {
      const result = await confirmarHorarioByToken(confirmToken);
      if (result.ok) {
        toast("Horário confirmado! Obrigado.");
      } else {
        toast(result.error || "Link inválido ou já utilizado.", "warn");
      }
    } catch (err) {
      console.error("[CLIENT PORTAL] confirmar horário", err);
      toast("Erro ao confirmar horário.");
    }
    params.delete("confirmToken");
    const cleanSearch = params.toString();
    const cleanUrl = window.location.pathname + (cleanSearch ? "?" + cleanSearch : "") + window.location.hash;
    window.history.replaceState({}, "", cleanUrl);
    document.getElementById("app").innerHTML = `
      <section class="client-header">
        <h2>Confirmação de horário</h2>
        <p>Você pode fechar esta página.</p>
      </section>
    `;
    return;
  }

  const token = params.get("token");
  if (!token) {
    toast("Acesso inválido");
    return;
  }

  try {
    const session = await initClientSession(token);
    try { sessionStorage.setItem("client_portal_token", token); } catch (_) {}

    const modeConsent = params.get("mode") === "consent";
    const hashRoute = window.location.hash.replace("#", "").trim();
    let defaultRoute =
      session.registration_completed_at == null
        ? "completar-cadastro"
        : "dashboard";
    if (modeConsent) defaultRoute = "termo-consent";

    navigate(hashRoute || defaultRoute);
  } catch (err) {
    console.error("[CLIENT PORTAL] bootstrap error", err);
    toast("Sessão expirada ou inválida");
  }
}

/* =========================
   ROUTER
========================= */

async function navigate(route){

 const config =
  routes[route];

 if(!config){
  console.warn(
   "Rota inválida:",
   route
  );
  return;
 }

 if(currentView?.destroy){
  currentView.destroy();
 }

 const module =
  await config.view();

 currentView = module;

 if(module.init){
  module.init();
 }

 window.location.hash =
  `#${route}`;
}

/* =========================
   EVENTS
========================= */

window.addEventListener(
 "hashchange",
 ()=> navigate(
  window.location.hash.replace("#","")
 )
);

/* =========================
   START
========================= */

bootstrap();
