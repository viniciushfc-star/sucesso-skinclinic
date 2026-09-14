import { updatePassword, authErrorMessage } from "../core/auth.js";
import { supabase } from "../core/supabase.js";
import { redirect } from "../core/base-path.js";

const form = document.getElementById("newPasswordForm");
const button = form?.querySelector("button[type='submit']") || form?.querySelector("button");
const passInput = document.getElementById("password");
const confirmInput = document.getElementById("confirmPassword");

function log(type, msg, data = null) {
  console[type](`[NEW-PASSWORD] ${msg}`, data || "");
}

const msgBox = document.getElementById("newPasswordMsg") || document.createElement("div");
if (!msgBox.id) {
  msgBox.id = "newPasswordMsg";
  msgBox.style.marginTop = "10px";
  msgBox.style.fontSize = "14px";
  form?.appendChild(msgBox);
}

function setLoading(state) {
  if (!button) return;
  button.disabled = state;
  button.innerText = state ? "Salvando..." : "Salvar nova senha";
}

function showMessage(text, type = "error") {
  msgBox.innerText = text;
  msgBox.style.color = type === "error" ? "#b91c1c" : "#15803d";
}

(function bindPasswordToggles() {
  const pairs = [
    { inputId: "password", btnId: "togglePasswordNew" },
    { inputId: "confirmPassword", btnId: "togglePasswordConfirmNew" },
  ];
  pairs.forEach(({ inputId, btnId }) => {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    if (!input || !btn) return;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      btn.setAttribute("aria-label", isPassword ? "Ocultar senha" : "Mostrar senha");
      btn.setAttribute("title", isPassword ? "Ocultar senha" : "Mostrar senha");
      btn.textContent = isPassword ? "🙈" : "👁";
    });
  });
})();

async function waitForRecoverySession(ms = 2500) {
  const started = Date.now();
  while (Date.now() - started < ms) {
    const { data } = await supabase.auth.getSession();
    if (data?.session) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  const { data } = await supabase.auth.getSession();
  return Boolean(data?.session);
}

async function boot() {
  if (!form) {
    log("error", "Formulário não encontrado");
    return;
  }

  const ok = await waitForRecoverySession();
  if (!ok) {
    showMessage(
      "Este link expirou ou a página foi aberta sem o e-mail. Volte ao login, clique em “Esqueci minha senha” e use o link novo da caixa de entrada (não copie só o endereço /new-password.html)."
    );
    if (button) button.disabled = true;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msgBox.innerText = "";

    const password = passInput?.value || "";
    const confirm = confirmInput?.value || "";

    if (password.length < 6) {
      showMessage("A senha deve ter no mínimo 6 caracteres");
      return;
    }
    if (password !== confirm) {
      showMessage("As senhas não conferem");
      return;
    }

    setLoading(true);
    try {
      const stillOk = await waitForRecoverySession(800);
      if (!stillOk) {
        throw new Error("Link expirado ou inválido. Solicite um novo em “Esqueci minha senha”.");
      }
      await updatePassword(password);
      log("info", "Senha atualizada");
      showMessage("Senha alterada. Vamos para o login…", "success");
      window.setTimeout(() => {
        window.location.assign("/index.html");
      }, 1200);
    } catch (err) {
      log("error", "Erro update senha", err);
      showMessage(authErrorMessage(err, "Não foi possível alterar a senha."));
    } finally {
      setLoading(false);
    }
  });
}

boot();
