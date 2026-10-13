import { initClientSession, confirmarHorarioByToken, loginClientPortal }
from "./client-portal.service.js";

import { toast }
from "./ui/toast.client.js";
import { initPwa } from "../core/pwa-install.js";
import { emailPortalNorm, senhaPortalOk } from "../utils/portal-login.js";

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
  anamnese: {
    view: () => import("./anamnese.client.js")
  },
  agenda: {
    view: () => import("./agenda.client.js")
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

  const appEl = document.getElementById("app");
  let token = params.get("token");
  if (!token) {
    try { token = sessionStorage.getItem("client_portal_token"); } catch (_) { token = null; }
  }
  if (!token) {
    showPortalLogin(appEl, params.get("mode") === "consent");
    return;
  }

  await enterWithPortalToken(token, { modeConsent: params.get("mode") === "consent", appEl });
}

async function enterWithPortalToken(token, { modeConsent = false, appEl } = {}) {
  try {
    const session = await initClientSession(token);
    try { sessionStorage.setItem("client_portal_token", token); } catch (_) {}

    const hashRoute = window.location.hash.replace("#", "").trim();
    let defaultRoute =
      session.registration_completed_at == null
        ? "completar-cadastro"
        : "dashboard";
    if (modeConsent) defaultRoute = "termo-consent";

    navigate(hashRoute || defaultRoute);
  } catch (err) {
    console.error("[CLIENT PORTAL] bootstrap error", err);
    try { sessionStorage.removeItem("client_portal_token"); } catch (_) {}
    toast("Sessão expirada ou inválida");
    showPortalLogin(appEl || document.getElementById("app"), modeConsent);
  }
}

function showPortalLogin(appEl, modeConsent = false) {
  if (!appEl) return;
  appEl.innerHTML = `
    <section class="client-completar-cadastro portal-login">
      <h2>Entrar no portal</h2>
      <p class="client-hint">Use o e-mail e a senha que você criou no cadastro. Ou abra o <strong>link que a clínica enviou</strong> — não é o login da equipe.</p>
      <form id="formPortalLogin">
        <label for="portalLoginEmail">E-mail</label>
        <input type="email" id="portalLoginEmail" required autocomplete="username" placeholder="email@exemplo.com">
        <label for="portalLoginSenha">Senha</label>
        <input type="password" id="portalLoginSenha" required autocomplete="current-password" minlength="8" maxlength="72">
        <button type="submit" class="btn-primary">Entrar</button>
      </form>
    </section>`;
  document.getElementById("formPortalLogin")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = emailPortalNorm(document.getElementById("portalLoginEmail")?.value);
    const senha = document.getElementById("portalLoginSenha")?.value || "";
    if (!email || !email.includes("@")) {
      toast("Informe o e-mail do cadastro.");
      return;
    }
    if (!senhaPortalOk(senha)) {
      toast("Senha precisa ter 8 a 72 caracteres, sem espaço.");
      return;
    }
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      const tok = await loginClientPortal(email, senha);
      await enterWithPortalToken(tok, { modeConsent, appEl });
    } catch (err) {
      toast(err?.message || "Não foi possível entrar.");
      if (btn) btn.disabled = false;
    }
  });
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

initPwa();

/* =========================
   START
========================= */

bootstrap();
