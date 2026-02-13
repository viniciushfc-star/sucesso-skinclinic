import { openModal, closeModal, openConfirmModal } from "../ui/modal.js";
import { checkPermission } from "./permissions.js";
import { protectPage, logout, getSession } from "./auth.js";
import { loadTheme, toggleTheme } from "../services/theme.service.js";

/** Títulos exibidos no header ao trocar de view */
const VIEW_TITLES = {
  dashboard: "Dashboard",
  agenda: "Agenda",
  procedimento: "Procedimentos",
  clientes: "Clientes",
  "cliente-perfil": "Perfil do cliente",
  financeiro: "Financeiro",
  "precificacao-taxas": "Taxas da maquininha",
  notificacoes: "Notificações",
  team: "Equipe",
  planos: "Planos",
  empresa: "Empresa",
  auditoria: "Auditoria",
  backup: "Backup",
  export: "Exportar e importar",
  master: "Configurações",
  copiloto: "Copiloto",
  marketing: "Marketing",
  "calendario-conteudo": "Calendário de conteúdo",
  estoque: "Estoque",
  ocr: "Notas fiscais",
  skincare: "Skincare",
  protocolo: "Protocolo",
  "estudo-caso": "Estudo de caso",
  anamnese: "Anamnese",
  "analise-pele": "Análises de pele",
  pagamento: "Pagamento pelo app",
  "documentos-termos": "Documentos e termos",
  "para-clinicas": "Para clínicas",
};

/* =========================
   SPA ROUTER
========================= */

const routes = {
  
  bootstrap: {
    view: null,
    permission: null,
  },
  dashboard: {
    view: "dashboard.views.js",
    permission: "dashboard:view",
  },
  agenda: {
    view: "agenda.views.js",
    permission: "agenda:view",
  },
  procedimento: {
    view: "procedimento.views.js",
    permission: "dashboard:view",
  },
  clientes: {
    view: "clientes.views.js",
    permission: "clientes:view",
  },
  "cliente-perfil": {
    view: "cliente-perfil.views.js",
    permission: "clientes:view",
  },
  financeiro: {
    view: "financeiro.views.js",
    permission: "financeiro:view",
  },
  "precificacao-taxas": {
    view: "precificacao-taxas.views.js",
    permission: "financeiro:view",
  },
  notificacoes: {
    view: "notificacoes.views.js",
    permission: "dashboard:view",
  },
  team: {
    view: "team.views.js",
    permission: "team:view",
  },
  planos: {
    view: "planos.views.js",
    permission: "planos:view",
  },
  empresa: {
    view: "empresa.views.js",
    permission: "dashboard:view",
  },
  auditoria: {
    view: "logs.views.js",
    permission: "auditoria:view",
  },
  backup: {
    view: "backup.views.js",
    permission: "backup:view",
  },
  export: {
    view: "export.views.js",
    permission: "relatorios:view",
  },
  master: {
    view: "master.views.js",
    permission: "master:access",
  },
  pagamento: {
    view: "pagamento.views.js",
    permission: "backup:view",
  },
  copiloto: {
    view: "copiloto.views.js",
    permission: "dashboard:view",
  },
  marketing: {
    view: "marketing.views.js",
    permission: "dashboard:view",
  },
  "calendario-conteudo": {
    view: "calendario-conteudo.views.js",
    permission: "dashboard:view",
  },
  estoque: {
    view: "estoque.views.js",
    permission: "dashboard:view",
  },
  ocr: {
    view: "ocr.views.js",
    permission: "dashboard:view",
  },
  skincare: {
    view: "skincare.views.js",
    permission: "dashboard:view",
  },
  protocolo: {
    view: "protocolo.views.js",
    permission: "dashboard:view",
  },
  "estudo-caso": {
    view: "estudo-caso.views.js",
    permission: "dashboard:view",
  },
  anamnese: {
    view: "anamnese.views.js",
    permission: "dashboard:view",
  },
  "analise-pele": {
    view: "analise-pele.views.js",
    permission: "dashboard:view",
  },
  "documentos-termos": {
    view: "documentos-termos.views.js",
    permission: "master:access",
  },
  "para-clinicas": {
    view: "para-clinicas.views.js",
    permission: "dashboard:view",
  },
  "select-org": {
    view: "select-org.views.js",
    permission: null,
  },
  onboarding: {
    view: "onboarding.views.js",
    permission: null,
  },
  "accept-invite": {
    view: "accept-invite.views.js",
    permission: null,
  },
  login: {
    view: "login.views.js",
    permission: null,
  },
};

/* =========================
   INIT
========================= */

function isLoginPage() {
  const p = typeof window !== "undefined" ? window.location.pathname : "";
  return p === "/" || p === "/index.html" || p.endsWith("/index.html");
}

/* Redireciona /onboarding para página dedicada; accept-invite e select-org para hash no index */
function normalizeSpaUrl() {
  const p = typeof window !== "undefined" ? window.location.pathname : "";
  const strip = (s) => s.replace(/^\//, "").replace(/\.html$/, "");
  const name = strip(p);
  if (name === "onboarding") {
    window.location.replace("/onboarding.html");
    return true;
  }
  if (name === "accept-invite" || name === "select-org") {
    window.location.replace("/index.html#" + name);
    return true;
  }
  return false;
}

async function init() {
  if (normalizeSpaUrl()) return;

  await protectPage();

  const session = await getSession();
  const hash = (location.hash && location.hash.replace("#", "")) || "";

  // Em index.html sem hash → sempre mostrar login (usuário entrou na página de login)
  if (isLoginPage() && !hash) {
    bindMenu();
    bindLogout();
    hideAllViews();
    showView("login");
    history.replaceState({}, "", "#login");
    initPushNotifications();
    return;
  }

  // Em index.html sem sessão (ex.: hash #accept-invite) → mostrar login
  if (isLoginPage() && !session) {
    bindMenu();
    bindLogout();
    hideAllViews();
    showView("login");
    history.replaceState({}, "", "#login");
    initPushNotifications();
    return;
  }

  bindMenu();
  bindLogout();
  bindSidebarToggle();
  loadTheme();
  bindThemeButton();
  bindTutorialButton();
  bindSkipLink();
  updateThemeButtonIcon();
  /* Copilot FAB: inicializa cedo (só existe em dashboard.html) */
  if (document.getElementById("copilotFab")) {
    import("../views/notificacoes.views.js")
      .then((m) => m.initCopilotPanel?.())
      .catch((e) => console.warn("[SPA] Copilot init:", e));
  }
  await applyMenuPermissions();
  await initCadastrarMenu();
  await initMarketingMenu();
  await initMenuAnamneseVisibility();

  let route = hash || "dashboard";
  if (route === "logs") {
    history.replaceState({}, "", "#auditoria");
    route = "auditoria";
  }

  // Sem hash ou dashboard → bootstrap decide (dashboard / onboarding / accept-invite)
  if (route === "dashboard" || route === "") {
    try {
      const { bootstrapAfterLogin } = await import("./bootstrap.js");
      const { next } = await bootstrapAfterLogin();
      const target = next || "dashboard";
      if (target === "dashboard" && isLoginPage()) {
        window.location.href = "/dashboard.html";
        return;
      }
      await navigate(target);
    } catch (err) {
      console.warn("[SPA] Bootstrap falhou, tentando rota direta", err);
      await navigate(route);
    }
  } else {
    if (route === "onboarding") {
      window.location.href = "/onboarding.html";
      return;
    }
    if ((route === "accept-invite" || route === "select-org") && !session) {
      hideAllViews();
      showView("login");
      history.replaceState({}, "", "#login");
    } else {
      await navigate(route);
    }
  }

  initPushNotifications();

  if (document.getElementById("tutorialWrap")) {
    import("../ui/tutorial.js").then((m) => m.initTutorial()).catch(() => {});
  }
}

/* =========================
   MENU PERMISSIONS
========================= */

async function applyMenuPermissions() {
  const items = document.querySelectorAll("[data-view]");

  for (const item of items) {
    /* Subitens do Cadastrar: tratados em initCadastrarMenu */
    if (item.closest("#cadastrarSubmenu")) continue;
    /* Subitens do Marketing: tratados em initMarketingMenu */
    if (item.closest("#marketingSubmenu")) continue;

    /* Itens dentro do sidebar: não remover, só esconder a linha se sem permissão (mantém layout) */
    const isSidebarItem = item.closest(".sidebar") !== null;

    const view = item.dataset.view;
    const route = routes[view];

    if (!route) {
      if (!isSidebarItem) item.remove();
      continue;
    }

    if (route.permission === null) {
      if (!isSidebarItem) item.remove();
      continue;
    }

    let allowed = false;
    try {
      allowed = await checkPermission(route.permission);
    } catch (_) {
      if (isSidebarItem) allowed = true;
    }

    if (!allowed) {
      if (isSidebarItem) {
        const row = item.closest("li");
        if (row) row.classList.add("menu-item-hidden");
      } else {
        item.remove();
      }
    } else if (isSidebarItem) {
      const row = item.closest("li");
      if (row) row.classList.remove("menu-item-hidden");
    }
  }
}

/**
 * Menu Cadastrar: Clientes + Equipe unificados.
 * - Ambas permissões: expande submenu ao clicar
 * - Apenas uma: clica e navega direto
 * - Nenhuma: oculta o item
 */
async function initCadastrarMenu() {
  const wrap = document.getElementById("cadastrarWrap");
  const btn = document.getElementById("btnCadastrar");
  const submenu = document.getElementById("cadastrarSubmenu");
  if (!wrap || !btn || !submenu) return;

  let canClientes = false;
  let canTeam = false;
  try {
    canClientes = await checkPermission("clientes:view");
    canTeam = await checkPermission("team:view");
  } catch (_) {}

  if (!canClientes && !canTeam) {
    wrap.classList.add("menu-item-hidden");
    return;
  }

  wrap.classList.remove("menu-item-hidden");

  /* Esconder subitens sem permissão */
  const clientesSub = submenu.querySelector("[data-view='clientes']")?.closest("li");
  const teamSub = submenu.querySelector("[data-view='team']")?.closest("li");
  if (clientesSub) clientesSub.classList.toggle("menu-item-hidden", !canClientes);
  if (teamSub) teamSub.classList.toggle("menu-item-hidden", !canTeam);

  submenu.classList.add("sidebar-submenu--collapsed");

  if (canClientes && canTeam) {
    /* Duas opções: toggle submenu */
    btn.onclick = () => {
      submenu.classList.toggle("sidebar-submenu--collapsed");
      btn.setAttribute("aria-expanded", submenu.classList.contains("sidebar-submenu--collapsed") ? "false" : "true");
    };
  } else {
    /* Uma só: navega direto */
    const target = canClientes ? "clientes" : "team";
    btn.onclick = () => navigate(target);
    submenu.classList.add("sidebar-submenu--hidden");
  }
}

/**
 * Menu Marketing: Sugestões + Calendário (conteúdo) como submenu.
 */
async function initMarketingMenu() {
  const wrap = document.getElementById("marketingWrap");
  const btn = document.getElementById("btnMarketing");
  const submenu = document.getElementById("marketingSubmenu");
  if (!wrap || !btn || !submenu) return;

  let canMarketing = false;
  let canCalendario = false;
  try {
    canMarketing = await checkPermission(routes.marketing?.permission || "dashboard:view");
    canCalendario = await checkPermission(routes["calendario-conteudo"]?.permission || "dashboard:view");
  } catch (_) {}

  if (!canMarketing && !canCalendario) {
    wrap.classList.add("menu-item-hidden");
    return;
  }

  wrap.classList.remove("menu-item-hidden");

  const marketingSub = submenu.querySelector("[data-view='marketing']")?.closest("li");
  const calendarioSub = submenu.querySelector("[data-view='calendario-conteudo']")?.closest("li");
  if (marketingSub) marketingSub.classList.toggle("menu-item-hidden", !canMarketing);
  if (calendarioSub) calendarioSub.classList.toggle("menu-item-hidden", !canCalendario);

  submenu.classList.add("sidebar-submenu--collapsed");

  if (canMarketing && canCalendario) {
    btn.onclick = () => {
      submenu.classList.toggle("sidebar-submenu--collapsed");
      btn.setAttribute("aria-expanded", submenu.classList.contains("sidebar-submenu--collapsed") ? "false" : "true");
    };
  } else {
    const target = canMarketing ? "marketing" : "calendario-conteudo";
    btn.onclick = () => navigate(target);
    submenu.classList.add("sidebar-submenu--hidden");
  }
}

/**
 * Mostra o item "Anamnese" no menu só se a org tiver menu_anamnese_visible e o usuário tiver permissão.
 */
async function initMenuAnamneseVisibility() {
  const wrap = document.getElementById("menuWrapAnamnese");
  if (!wrap) return;

  let allowed = false;
  try {
    allowed = await checkPermission(routes.anamnese?.permission || "dashboard:view");
  } catch (_) {}

  let menuAnamneseVisible = false;
  try {
    const { getOrganizationProfile } = await import("../services/organization-profile.service.js");
    const profile = await getOrganizationProfile();
    menuAnamneseVisible = !!profile.menu_anamnese_visible;
  } catch (_) {}

  if (!allowed || !menuAnamneseVisible) {
    wrap.classList.add("menu-item-hidden");
  } else {
    wrap.classList.remove("menu-item-hidden");
  }
}

/* =========================
   NAVEGAÇÃO
========================= */

export async function navigate(route) {

if (!route || typeof route !== "string") {
    return;
}

  if (route === "logs") {
    history.replaceState({}, "", "#auditoria");
    return navigate("auditoria");
  }

  if (route === "bootstrap") {
    const { bootstrapAfterLogin } = await import("./bootstrap.js");
    const { next } = await bootstrapAfterLogin();
    return navigate(next);
  }

  const config = routes[route];

  if (!config) {
    console.error("[SPA] Rota inexistente:", route, typeof route);
    return;
  }

  if (route === "dashboard" && isLoginPage()) {
    window.location.href = "/dashboard.html";
    return;
  }

  // rota pública (onboarding, accept-invite, select-org)
  if (config.permission === null) {
    await renderRoute(route);
    return;
  }

  // rota protegida
  let allowed = false;
  try {
    allowed = await checkPermission(config.permission);
  } catch (err) {
    console.warn("[SPA] Permissão ainda não pronta");
    return;
  }

  if (!allowed) {
    alert("Acesso negado");
    return;
  }

  await renderRoute(route);
}

/* =========================
   RENDERIZAÇÃO
========================= */


async function renderRoute(route) {
  const overlay = document.getElementById("viewLoadingOverlay");
  if (overlay) {
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-busy", "true");
  }
  hideAllViews();
  showView(route);
  setActive(route);
  try {
    await carregarView(route);
  } finally {
    if (overlay) {
      overlay.classList.add("hidden");
      overlay.setAttribute("aria-busy", "false");
    }
  }
  history.pushState({}, "", `#${route}`);
}

/* =========================
   CARREGAR VIEW
========================= */

async function carregarView(viewName) {
  const config = routes[viewName];
  if (!config?.view) return;

  try {
    const module = await import(
      `../views/${config.view}`
    );

    if (module?.init) {
      module.init();
    }

    if (config?.permission !== null) {
      const notif = await import("../views/notificacoes.views.js").catch(() => null);
      if (notif?.initHeaderNotif) notif.initHeaderNotif();
      if (notif?.initCopilotPanel) notif.initCopilotPanel();
      if (notif?.updateBadge) await notif.updateBadge();
      updateAppIdentity().catch(() => {});
    }
  } catch (err) {
    console.error("Erro ao carregar view:", err?.message || err, "(view:", viewName, "| arquivo:", config?.view + ")");
  }
}

/** Atualiza identidade da empresa no sidebar (nome ou logo) e título da página (co-marca). */
async function updateAppIdentity() {
  const el = document.getElementById("sidebarLogo");
  const fallback = el?.dataset.fallback || "SkinClinic";
  try {
    const { getOrganizationProfile } = await import("../services/organization-profile.service.js");
    const profile = await getOrganizationProfile();
    const name = (profile.name || "").trim() || fallback;

    if (el) {
      el.innerHTML = "";
      if (profile.logo_url && /^https?:\/\//i.test(profile.logo_url)) {
        const img = document.createElement("img");
        img.src = profile.logo_url;
        img.alt = name;
        img.className = "sidebar-logo-img";
        el.appendChild(img);
        el.classList.add("sidebar-logo--img");
      } else {
        el.textContent = name;
        el.classList.remove("sidebar-logo--img");
      }
    }

    const headerTitle = document.getElementById("mainHeaderTitle");
    if (headerTitle) headerTitle.textContent = name;

    document.title = name && name !== fallback ? `${name} – SkinClinic` : "SkinClinic";
  } catch (_) {
    if (el) {
      el.innerHTML = "";
      el.textContent = fallback;
      el.classList.remove("sidebar-logo--img");
    }
    const headerTitle = document.getElementById("mainHeaderTitle");
    if (headerTitle) headerTitle.textContent = "SkinClinic";
    document.title = "SkinClinic";
  }
}

/* =========================
   UI HELPERS
========================= */

function hideAllViews() {
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.add("hidden"));
}

function showView(name) {
  const viewEl = document.getElementById("view-" + name);
  if (viewEl) viewEl.classList.remove("hidden");
  const contentArea = document.getElementById("mainContent");
  if (contentArea) {
    contentArea.scrollTop = 0;
  }
  const titleEl = document.getElementById("headerViewTitle");
  if (titleEl && VIEW_TITLES[name]) {
    titleEl.textContent = VIEW_TITLES[name];
  }
  if (viewEl) {
    viewEl.setAttribute("tabindex", "-1");
    viewEl.focus({ preventScroll: true });
  }
}

function setActive(view) {
  document
    .querySelectorAll("[data-view]")
    .forEach((btn) => {
      btn.classList.remove("active");
      if (btn.dataset.view === view) {
        btn.classList.add("active");
      }
    });

  /* Cadastrar: expandir submenu e marcar parent quando em clientes ou team */
  const submenu = document.getElementById("cadastrarSubmenu");
  const btnCadastrar = document.getElementById("btnCadastrar");
  if (submenu && btnCadastrar) {
    if (view === "clientes" || view === "team") {
      submenu.classList.remove("sidebar-submenu--collapsed");
      btnCadastrar.setAttribute("aria-expanded", "true");
      btnCadastrar.classList.add("parent-active");
    } else {
      submenu.classList.add("sidebar-submenu--collapsed");
      btnCadastrar.setAttribute("aria-expanded", "false");
      btnCadastrar.classList.remove("parent-active");
    }
  }

  /* Marketing: expandir submenu e marcar parent quando em marketing ou calendario-conteudo */
  const marketingSubmenu = document.getElementById("marketingSubmenu");
  const btnMarketing = document.getElementById("btnMarketing");
  if (marketingSubmenu && btnMarketing) {
    if (view === "marketing" || view === "calendario-conteudo") {
      marketingSubmenu.classList.remove("sidebar-submenu--collapsed");
      btnMarketing.setAttribute("aria-expanded", "true");
      btnMarketing.classList.add("parent-active");
    } else {
      marketingSubmenu.classList.add("sidebar-submenu--collapsed");
      btnMarketing.setAttribute("aria-expanded", "false");
      btnMarketing.classList.remove("parent-active");
    }
  }
}

/* =========================
   MENU
========================= */

function bindMenu() {
  document
    .querySelectorAll("[data-view]")
    .forEach((btn) => {
      btn.addEventListener("click", async () => {
        await navigate(btn.dataset.view);
      });
    });
}

/* Skip link: ao clicar, foca o conteúdo principal (acessibilidade). */
function bindSkipLink() {
  const skip = document.querySelector(".skip-link");
  const main = document.getElementById("mainContent");
  if (!skip || !main) return;
  skip.addEventListener("click", (e) => {
    e.preventDefault();
    main.focus({ preventScroll: false });
    main.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

/* Botão de tema (claro/escuro): só existe no dashboard. */
function bindThemeButton() {
  const btn = document.getElementById("btnTheme");
  if (!btn) return;
  btn.addEventListener("click", () => {
    toggleTheme();
    updateThemeButtonIcon();
  });
}

/* Botão Tutorial do rodapé do menu: abre o passo a passo. Binding aqui garante que funcione mesmo se initTutorial() atrasar. */
function bindTutorialButton() {
  const btn = document.getElementById("btnTutorialIniciar");
  if (!btn) return;
  btn.addEventListener("click", () => {
    import("../ui/tutorial.js")
      .then((m) => m.startTutorial && m.startTutorial(false))
      .catch((err) => console.warn("[SPA] Tutorial", err));
  });
}

function updateThemeButtonIcon() {
  const btn = document.getElementById("btnTheme");
  if (!btn) return;
  const isDark = document.body.classList.contains("dark");
  btn.textContent = isDark ? "☀️" : "🌙";
  btn.setAttribute("title", isDark ? "Tema claro" : "Tema escuro");
  btn.setAttribute("aria-label", isDark ? "Mudar para tema claro" : "Mudar para tema escuro");
}

/* Sidebar: abre/fecha (guarda estado no localStorage). Usa delegação para garantir que o clique funcione. */
function bindSidebarToggle() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  const KEY = "skinclinic_sidebar_collapsed";
  if (localStorage.getItem(KEY) === "1") {
    sidebar.classList.add("sidebar-collapsed");
  }

  /* Delegação no document: captura clique no botão ou no ícone dentro dele */
  document.addEventListener("click", (e) => {
    const toggle = e.target.closest("#sidebarToggle");
    if (!toggle) return;
    e.preventDefault();
    e.stopPropagation();
    sidebar.classList.toggle("sidebar-collapsed");
    localStorage.setItem(KEY, sidebar.classList.contains("sidebar-collapsed") ? "1" : "0");
  });
}

/* =========================
   LOGOUT
========================= */

function bindLogout() {
  const btn = document.getElementById("btnLogout");
  if (!btn) return;

  btn.addEventListener("click", () => {
    openConfirmModal("Sair?", "Deseja realmente sair da sua conta?", async () => {
      await logout();
      window.location.href = "/index.html";
    });
  });
}

/* =========================
   PUSH
========================= */

async function initPushNotifications() {
  if (!("Notification" in window)) return;

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return;

  const fakeToken = "device-" + Date.now();

  const { saveToken } = await import(
    "../services/push.service.js"
  );

  await saveToken(fakeToken, navigator.userAgent);
}

/* =========================
   BROWSER
========================= */

window.onpopstate = async () => {
  const hash = location.hash.replace("#", "");

  if (!hash) {
    await navigate("bootstrap");
  } else {
    await navigate(hash);
  }
};

/* Links internos com href="#view" (ex.: card margem em risco "Ver na Auditoria") */
window.addEventListener("hashchange", () => {
  const hash = location.hash.replace("#", "").trim();
  if (hash && routes[hash]) navigate(hash);
});

document.addEventListener("DOMContentLoaded", init);
