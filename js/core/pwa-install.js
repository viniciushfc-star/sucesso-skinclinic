import { getBase } from "./base-path.js";

let deferredPrompt = null;

export function initPwa() {
  if (typeof navigator?.serviceWorker !== "undefined") {
    const base = getBase();
    navigator.serviceWorker.register(base + "/sw.js?v=v6", { scope: base + "/" }).catch(() => {});
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButtons(true);
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    showInstallButtons(false);
  });

  document.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("[data-pwa-install]");
    if (!btn) return;
    ev.preventDefault();
    if (!deferredPrompt) {
      alert("No Android/Chrome: menu do navegador → Adicionar à tela inicial. No iPhone: Compartilhar → Adicionar à Tela de Início.");
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => {});
    deferredPrompt = null;
    showInstallButtons(false);
  });
}

function showInstallButtons(visible) {
  document.querySelectorAll("[data-pwa-install]").forEach((el) => {
    el.classList.toggle("hidden", !visible);
  });
}
