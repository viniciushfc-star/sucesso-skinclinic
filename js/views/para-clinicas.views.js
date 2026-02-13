/**
 * Para clínicas — documentação/FAQ de posicionamento e suporte no app.
 * Conteúdo estático no HTML; esta view só garante que os links [data-view] não disparem o default do âncora.
 */

import { navigate } from "../core/spa.js";

export async function init() {
  const faq = document.getElementById("paraClinicasFaq");
  if (!faq) return;
  faq.querySelectorAll("a[data-view]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const view = a.getAttribute("data-view");
      if (view) navigate(view);
    });
  });
}
