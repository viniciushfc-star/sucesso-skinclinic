/**
 * Mapa de aplicação: órbita 3D na tela, folha 2D na impressão.
 * Pontos continuam em x_pct / y_pct. CSS 3D, sem motor extra. Não muda o prontuário sozinho.
 */

export const MAPA_3D_SCALE_MIN = 1;
export const MAPA_3D_SCALE_MAX = 3.6;
export const MAPA_3D_ROT_Y_MAX = 48;
export const MAPA_3D_ROT_X_MAX = 22;

export function clamp(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

export function cssTransformMapa3d({ rotX = 0, rotY = 0, scale = 1, ox = 50, oy = 50 } = {}) {
  const rx = clamp(rotX, -MAPA_3D_ROT_X_MAX, MAPA_3D_ROT_X_MAX);
  const ry = clamp(rotY, -MAPA_3D_ROT_Y_MAX, MAPA_3D_ROT_Y_MAX);
  const s = clamp(scale, MAPA_3D_SCALE_MIN, MAPA_3D_SCALE_MAX);
  const x = clamp(ox, 0, 100);
  const y = clamp(oy, 0, 100);
  return {
    transformOrigin: `${x}% ${y}%`,
    transform: `rotateX(${rx}deg) rotateY(${ry}deg) scale(${s})`,
    flattened: false,
    rotX: rx,
    rotY: ry,
    scale: s,
    ox: x,
    oy: y,
  };
}

export function cssTransformMapa2dImpressao() {
  return {
    transformOrigin: "50% 50%",
    transform: "none",
    flattened: true,
    rotX: 0,
    rotY: 0,
    scale: 1,
    ox: 50,
    oy: 50,
  };
}

export function htmlToolbarMapa3d({ imprimir = true, vistas = [] } = {}) {
  const chips = (vistas || [])
    .map(
      (v, i) =>
        `<button type="button" class="btn-secondary mapa-3d-btn mapa-3d-vista${i === 0 ? " is-active" : ""}" data-mapa3d-vista="${v.id}" aria-pressed="${i === 0 ? "true" : "false"}">${v.label}</button>`
    )
    .join("");
  return `<div class="mapa-3d-toolbar" role="toolbar" aria-label="Ampliar e girar o mapa">
    ${chips ? `<div class="mapa-3d-vistas" role="group" aria-label="Vista da carta">${chips}</div>` : ""}
    <button type="button" class="btn-secondary mapa-3d-btn" data-mapa3d="zoom-in" title="Ampliar o local">+</button>
    <button type="button" class="btn-secondary mapa-3d-btn" data-mapa3d="zoom-out" title="Reduzir">−</button>
    <button type="button" class="btn-secondary mapa-3d-btn" data-mapa3d="rot-left" title="Girar">Girar E</button>
    <button type="button" class="btn-secondary mapa-3d-btn" data-mapa3d="rot-right" title="Girar">Girar D</button>
    <button type="button" class="btn-secondary mapa-3d-btn" data-mapa3d="tilt" title="Inclinar">Inclinar</button>
    <button type="button" class="btn-secondary mapa-3d-btn" data-mapa3d="reset" title="Vista inicial, sem zoom">Resetar</button>
    ${imprimir ? `<button type="button" class="btn-secondary mapa-3d-btn" data-mapa3d="print" title="Achata em 2D e envia à impressão">Imprimir 2D</button>` : ""}
    <span class="mapa-3d-hint">Arraste para girar</span>
  </div>`;
}

function aplicar(scene, state) {
  const t = state.print
    ? cssTransformMapa2dImpressao()
    : cssTransformMapa3d(state);
  scene.style.transformOrigin = t.transformOrigin;
  scene.style.transform = t.transform;
}

/**
 * @param {HTMLElement} root .mapa-3d
 * @param {{ getPrintRoot?: () => HTMLElement, titulo?: string }} [opts]
 */
export function bindMapa3d(root, opts = {}) {
  if (!root || root._mapa3dBound) return null;
  const scene = root.querySelector(".mapa-3d-scene");
  const viewport = root.querySelector(".mapa-3d-viewport");
  if (!scene || !viewport) return null;
  root._mapa3dBound = true;
  const state = { rotX: 8, rotY: -12, scale: 1, ox: 50, oy: 50, print: false };
  aplicar(scene, state);

  function markVista(id) {
    root.querySelectorAll("[data-mapa3d-vista]").forEach((b) => {
      const on = b.getAttribute("data-mapa3d-vista") === id;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    });
  }

  function act(cmd) {
    if (cmd === "zoom-in") state.scale = clamp(state.scale + 0.35, MAPA_3D_SCALE_MIN, MAPA_3D_SCALE_MAX);
    else if (cmd === "zoom-out") {
      state.scale = clamp(state.scale - 0.35, MAPA_3D_SCALE_MIN, MAPA_3D_SCALE_MAX);
      if (state.scale <= 1.05) {
        state.ox = 50;
        state.oy = 50;
      }
    } else if (cmd === "rot-left") state.rotY = clamp(state.rotY - 10, -MAPA_3D_ROT_Y_MAX, MAPA_3D_ROT_Y_MAX);
    else if (cmd === "rot-right") state.rotY = clamp(state.rotY + 10, -MAPA_3D_ROT_Y_MAX, MAPA_3D_ROT_Y_MAX);
    else if (cmd === "tilt") state.rotX = state.rotX >= 8 ? 2 : 12;
    else if (cmd === "reset") {
      state.rotX = 8;
      state.rotY = -12;
      state.scale = 1;
      state.ox = 50;
      state.oy = 50;
    } else if (cmd === "print") {
      imprimirMapa2d({
        source: typeof opts.getPrintRoot === "function" ? opts.getPrintRoot() : root,
        titulo: opts.titulo || "Mapa de aplicação",
      });
      return;
    }
    aplicar(scene, state);
  }

  root.querySelectorAll("[data-mapa3d]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      act(btn.getAttribute("data-mapa3d"));
    });
  });

  root.querySelectorAll("[data-mapa3d-vista]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute("data-mapa3d-vista");
      markVista(id);
      if (typeof opts.onVista === "function") opts.onVista(id);
    });
  });

  let drag = null;
  viewport.style.touchAction = "none";
  viewport.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    drag = { x: e.clientX, y: e.clientY, moved: false };
    root.dataset.mapa3dDrag = "0";
    viewport.classList.add("is-dragging");
    scene.style.transition = "none";
    viewport.setPointerCapture?.(e.pointerId);
  });
  viewport.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    drag.x = e.clientX;
    drag.y = e.clientY;
    state.rotY = clamp(state.rotY + dx * 0.35, -MAPA_3D_ROT_Y_MAX, MAPA_3D_ROT_Y_MAX);
    state.rotX = clamp(state.rotX - dy * 0.22, -MAPA_3D_ROT_X_MAX, MAPA_3D_ROT_X_MAX);
    aplicar(scene, state);
  });
  const endDrag = (e) => {
    if (!drag) return;
    if (drag.moved) root.dataset.mapa3dDrag = "1";
    drag = null;
    viewport.classList.remove("is-dragging");
    scene.style.transition = "";
    try {
      viewport.releasePointerCapture?.(e.pointerId);
    } catch (_) {}
  };
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);

  viewport.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      state.scale = clamp(state.scale + (e.deltaY < 0 ? 0.2 : -0.2), MAPA_3D_SCALE_MIN, MAPA_3D_SCALE_MAX);
      aplicar(scene, state);
    },
    { passive: false }
  );

  return {
    zoomTo(xPct, yPct) {
      state.ox = clamp(xPct, 0, 100);
      state.oy = clamp(yPct, 0, 100);
      state.scale = Math.max(state.scale, 2.2);
      aplicar(scene, state);
    },
    act,
    state,
  };
}

export function imprimirMapa2d({ source, titulo } = {}) {
  if (!source) return;
  document.querySelectorAll(".mapa-print-sheet").forEach((n) => n.remove());
  const sheet = document.createElement("div");
  sheet.className = "mapa-print-sheet";
  const clone = source.cloneNode(true);
  clone.querySelectorAll(".mapa-3d-toolbar").forEach((n) => n.remove());
  clone.querySelectorAll(".mapa-3d-scene").forEach((n) => {
    n.style.transform = "none";
    n.style.transformOrigin = "50% 50%";
  });
  clone.querySelectorAll(".hidden").forEach((n) => {
    if (n.classList.contains("injetaveis-mapa-panel") || n.classList.contains("anamnese-mapa-panel")) {
      /* painéis de outra aba ficam fora */
    }
  });
  const h = document.createElement("h1");
  h.className = "mapa-print-title";
  h.textContent = titulo || "Mapa de aplicação (2D)";
  const note = document.createElement("p");
  note.className = "mapa-print-note";
  note.textContent = "Folha achatada para impressão. Na tela o mapa gira e amplia; o prontuário não muda.";
  sheet.appendChild(h);
  sheet.appendChild(note);
  sheet.appendChild(clone);
  document.body.appendChild(sheet);
  document.body.classList.add("mapa-print-active");

  const cleanup = () => {
    sheet.remove();
    document.body.classList.remove("mapa-print-active");
    window.removeEventListener("afterprint", cleanup);
    if (mq) mq.removeEventListener("change", onMq);
  };
  const onMq = (ev) => {
    if (!ev.matches) cleanup();
  };
  const mq = typeof matchMedia === "function" ? matchMedia("print") : null;
  if (mq && mq.addEventListener) mq.addEventListener("change", onMq);
  window.addEventListener("afterprint", cleanup);
  window.print();
}
