import { sendReset }
from "../core/auth.js"

import { toast }
from "../ui/toast.js"
/* =========================
   ELEMENTOS
========================= */

const form = document.getElementById("resetForm");
const button = form.querySelector("button");
const emailInput = document.getElementById("email");

const msgBox = document.createElement("div");
msgBox.style.marginTop = "10px";
msgBox.style.fontSize = "14px";
form.appendChild(msgBox);

/* =========================
   HELPERS
========================= */

function log(type, msg, data = null) {
  console[type](`[RESET] ${msg}`, data || "");
}

function setLoading(state) {
  button.disabled = state;
  button.innerText = state
    ? "Enviando..."
    : "Enviar link";
}

function showMessage(text, type = "error") {
  msgBox.innerText = text;
  msgBox.style.color =
    type === "error"
      ? "#e74c3c"
      : "#2ecc71";
}

/* =========================
   SUBMIT
========================= */

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  msgBox.innerText = "";

  const email = emailInput.value.trim();

  if (!email || !email.includes("@")) {
    showMessage("Informe um email válido");
    return;
  }

  setLoading(true);

  try {
    await sendReset(email);

    log("info", "Reset enviado", email);
    showMessage(
      "Email enviado com sucesso!",
      "success"
    );

    form.reset();

  } catch (err) {
    log("error", "Erro reset", err);
    showMessage("Erro ao enviar email");

  } finally {
    setLoading(false);
  }
});
