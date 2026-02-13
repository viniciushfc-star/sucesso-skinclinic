import { updatePassword } from "../core/auth.js";

/* =========================
   ELEMENTOS
========================= */

const form = document.getElementById("newPasswordForm");
const button = form.querySelector("button");

const passInput =
  document.getElementById("password");

const confirmInput =
  document.getElementById("confirmPassword");

const msgBox = document.createElement("div");
msgBox.style.marginTop = "10px";
msgBox.style.fontSize = "14px";
form.appendChild(msgBox);

/* =========================
   HELPERS
========================= */

function log(type, msg, data = null) {
  console[type](`[NEW-PASSWORD] ${msg}`, data || "");
}

function setLoading(state) {
  button.disabled = state;
  button.innerText = state
    ? "Salvando..."
    : "Salvar nova senha";
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

  const password = passInput.value;
  const confirm = confirmInput.value;

  if (password.length < 6) {
    showMessage(
      "A senha deve ter no mínimo 6 caracteres"
    );
    return;
  }

  if (password !== confirm) {
    showMessage("As senhas não conferem");
    return;
  }

  setLoading(true);

  try {
    await updatePassword(password);

    log("info", "Senha atualizada");

    showMessage(
      "Senha alterada com sucesso!",
      "success"
    );

    setTimeout(() => {
      window.location.href = "/";
    }, 2000);

  } catch (err) {
    log("error", "Erro update senha", err);
    showMessage(
      err.message || "Erro ao alterar senha"
    );

  } finally {
    setLoading(false);
  }
});
