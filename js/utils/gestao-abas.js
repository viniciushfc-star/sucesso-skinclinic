/**
 * Abas locais da Gestão (estoque, equipe). Sem rota nova.
 */

export function bindGestaoAbas(root, storageKey, fallback) {
  if (!root) return () => {};

  function show(name) {
    const existe = root.querySelector(`[data-gestao-pane="${name}"]`);
    const alvo = existe ? name : fallback;
    root.querySelectorAll("[data-gestao-tab]").forEach((b) => {
      const on = b.getAttribute("data-gestao-tab") === alvo;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
    });
    root.querySelectorAll("[data-gestao-pane]").forEach((p) => {
      p.classList.toggle("hidden", p.getAttribute("data-gestao-pane") !== alvo);
    });
    try {
      sessionStorage.setItem(storageKey, alvo);
    } catch (_) {}
  }

  if (!root.dataset.abasBound) {
    root.dataset.abasBound = "1";
    root.querySelectorAll("[data-gestao-tab]").forEach((b) => {
      b.addEventListener("click", () => show(b.getAttribute("data-gestao-tab")));
    });
  }

  let start = fallback;
  try {
    start = sessionStorage.getItem(storageKey) || fallback;
  } catch (_) {}
  show(start);
  return show;
}
