/**
 * UI do modo tutorial: cartão com passo atual, Anterior / Próximo / Pular.
 * Navega para a view de cada passo e atualiza o cartão.
 */

import { navigate } from "../core/spa.js";
import {
  getStep,
  getTotalSteps,
  getSavedStep,
  setSavedStep,
  markTutorialDone,
  resetTutorial,
} from "../services/tutorial.service.js";

const WRAP_ID = "tutorialWrap";
const TITLE_ID = "tutorialTitle";
const BODY_ID = "tutorialBody";
const PROGRESS_ID = "tutorialProgress";
const BTN_PREV_ID = "tutorialBtnPrev";
const BTN_NEXT_ID = "tutorialBtnNext";
const BTN_SKIP_ID = "tutorialBtnSkip";

let currentIndex = 0;

function getWrap() {
  return document.getElementById(WRAP_ID);
}

function getTitleEl() {
  return document.getElementById(TITLE_ID);
}

function getBodyEl() {
  return document.getElementById(BODY_ID);
}

function getProgressEl() {
  return document.getElementById(PROGRESS_ID);
}

function getBtnPrev() {
  return document.getElementById(BTN_PREV_ID);
}

function getBtnNext() {
  return document.getElementById(BTN_NEXT_ID);
}

function getBtnSkip() {
  return document.getElementById(BTN_SKIP_ID);
}

function renderStep(index) {
  const step = getStep(index);
  if (!step) return;

  const titleEl = getTitleEl();
  const bodyEl = getBodyEl();
  const progressEl = getProgressEl();
  const btnPrev = getBtnPrev();
  const btnNext = getBtnNext();
  const total = getTotalSteps();

  if (titleEl) titleEl.textContent = step.title;
  if (bodyEl) bodyEl.textContent = step.body;
  if (progressEl) progressEl.textContent = `Passo ${index + 1} de ${total}`;

  if (btnPrev) {
    btnPrev.classList.toggle("hidden", index <= 0);
    btnPrev.disabled = index <= 0;
  }
  if (btnNext) {
    btnNext.textContent = index >= total - 1 ? "Concluir" : "Próximo";
  }
}

function showWrap(show) {
  const wrap = getWrap();
  if (!wrap) return;
  if (show) {
    wrap.classList.remove("hidden");
    wrap.setAttribute("aria-hidden", "false");
  } else {
    wrap.classList.add("hidden");
    wrap.setAttribute("aria-hidden", "true");
  }
}

/**
 * Avança para o passo indicado: navega para a view e atualiza o cartão.
 * @param {number} index - Índice do passo (0-based)
 */
export async function goToStep(index) {
  const step = getStep(index);
  if (!step) return;

  currentIndex = index;
  setSavedStep(index);

  if (step.openTab && typeof sessionStorage !== "undefined") {
    sessionStorage.setItem("financeiro_open_tab", step.openTab);
  }
  await navigate(step.view);
  renderStep(index);
  showWrap(true);
}

/**
 * Inicia o tutorial. Se fromStart === true, começa do passo 0; senão continua de onde parou.
 * @param {boolean} fromStart - Se true, reseta e começa do zero
 */
export async function startTutorial(fromStart = false) {
  if (fromStart) resetTutorial();
  const start = fromStart ? 0 : getSavedStep();
  await goToStep(start);
}

/**
 * Esconde o tutorial e marca como concluído (para "Pular").
 */
export function skipTutorial() {
  markTutorialDone();
  showWrap(false);
}

/**
 * Liga os botões do cartão (Próximo, Anterior, Pular).
 * Deve ser chamado após o DOM do tutorial estar disponível.
 */
export function bindTutorialButtons() {
  const wrap = getWrap();
  if (!wrap) return;

  const btnPrev = getBtnPrev();
  const btnNext = getBtnNext();
  const btnSkip = getBtnSkip();

  if (btnPrev) {
    btnPrev.addEventListener("click", () => {
      if (currentIndex > 0) goToStep(currentIndex - 1);
    });
  }

  if (btnNext) {
    btnNext.addEventListener("click", () => {
      const total = getTotalSteps();
      if (currentIndex >= total - 1) {
        markTutorialDone();
        showWrap(false);
      } else {
        goToStep(currentIndex + 1);
      }
    });
  }

  if (btnSkip) {
    btnSkip.addEventListener("click", skipTutorial);
  }
}

/**
 * Inicializa o tutorial: bind dos botões do cartão (Anterior, Próximo, Pular) e do botão "Iniciar ou refazer" (Para clínicas).
 * O botão "Tutorial" do rodapé do menu é ligado em spa.js (bindTutorialButton) para garantir que funcione sempre.
 */
export async function initTutorial() {
  bindTutorialButtons();

  const btnRestart = document.getElementById("btnTutorialRecomecar");
  if (btnRestart) {
    btnRestart.addEventListener("click", () => startTutorial(true));
  }
}
