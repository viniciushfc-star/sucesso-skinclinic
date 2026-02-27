/* =========================
   IMPORTS
========================= */
import { loginEmail, loginGoogle, registerEmail }
  from "../core/auth.js";

import { bootstrapAfterLogin }
  from "../core/bootstrap.js";

import { clearActiveOrg }
  from "../core/org.js";

import { redirect }
  from "../core/base-path.js";

import { toast } 
  from "../ui/toast.js";

import { showLoader, hideLoader }
  from "../ui/loader.js";

/* =========================
   ELEMENTOS
========================= */
const formLogin = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const btnRegister = document.getElementById("registerBtn");
const btnGoogle = document.getElementById("btnGoogle");

const modal = document.getElementById("registerModal");
const closeBtn = document.getElementById("closeModal");

const formRegister = document.getElementById("registerForm");
const nameInput = document.getElementById("name");
const cpfInput = document.getElementById("cpf");
const regEmailInput = document.getElementById("registerEmail");
const regPasswordInput = document.getElementById("registerPassword");
const regConfirmInput = document.getElementById("confirmPassword");

/* =========================
   INIT
========================= */
let loginInitDone = false;

function init() {
  if (loginInitDone) return;
  loginInitDone = true;
  if (modal) modal.classList.add("hidden");
  bindLogin();
  bindRegister();
  bindGoogle();
  bindPasswordToggles();
  if (btnRegister) btnRegister.addEventListener("click", () => modal?.classList.remove("hidden"));
  if (closeBtn) closeBtn.addEventListener("click", () => modal?.classList.add("hidden"));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

/** Botão olho: mostrar/ocultar senha */
function bindPasswordToggles() {
  const pairs = [
    { inputId: "password", btnId: "togglePasswordLogin" },
    { inputId: "registerPassword", btnId: "togglePasswordRegister" },
    { inputId: "confirmPassword", btnId: "togglePasswordConfirm" },
  ];
  pairs.forEach(({ inputId, btnId }) => {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    if (!input || !btn) return;
    btn.type = "button";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      input.focus();
      btn.setAttribute("aria-label", isPassword ? "Ocultar senha" : "Mostrar senha");
      btn.setAttribute("title", isPassword ? "Ocultar senha" : "Mostrar senha");
      btn.textContent = isPassword ? "🙈" : "👁";
    });
  });
}

/* =========================
   LOGIN
========================= */
function bindLogin() {
  if (!formLogin) return;

  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      showLoader();

      const data = await loginEmail(
        emailInput.value,
        passwordInput.value
      );

      // 🔹 LOGIN BEM-SUCEDIDO (sessão válida)
     if (!data) {
         throw new Error("Falha ao autenticar usuário");
       }


      // 🔹 DECISÃO DE FLUXO CENTRALIZADA
      const result = await bootstrapAfterLogin();

      if (result.next === "dashboard" || result.next === "agenda") {
        redirect("/dashboard.html");
        return;
      }

      if (result.next === "onboarding") {
        clearActiveOrg();
        redirect("/onboarding.html");
        return;
      }

      if (result.next === "accept-invite") {
        redirect("/index.html#accept-invite");
        return;
      }

      toast("Estado de usuário inválido");

    } catch (err) {
      console.error("[LOGIN]", err);
      const msg = String(err?.message || err?.error_description || err?.msg || "Erro ao entrar").trim();
      if (msg.includes("Email not confirmed") || String(err?.message || "").includes("email_not_confirmed")) {
        toast("Confirme seu e-mail. Verifique a caixa de entrada (e o spam) e clique no link enviado no cadastro.", "error");
      } else if (msg.includes("Invalid login credentials") || msg.includes("invalid_credentials") || msg.toLowerCase().includes("invalid")) {
        toast("E-mail ou senha incorretos. Tente novamente ou use \"Esqueci minha senha\".", "error");
      } else {
        toast(msg || "Erro ao entrar. Tente novamente.", "error");
      }
    } finally {
      hideLoader();
    }
  });
} // ✅ FECHAMENTO QUE FALTAVA

/* =========================
   CADASTRO
========================= */
function bindRegister() {
  if (!formRegister) return;

  formRegister.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      showLoader();

      await registerEmail(
        nameInput.value,
        cpfInput.value,
        regEmailInput.value,
        regPasswordInput.value
      );

      toast("Conta criada! Verifique seu email.");
      modal.classList.add("hidden");

    } catch (err) {
      console.error("[REGISTER]", err);
      toast("Erro ao cadastrar");
    } finally {
      hideLoader();
    }
  });
}

/* =========================
   GOOGLE
========================= */
function bindGoogle() {
  if (!btnGoogle) return;

  btnGoogle.onclick = async () => {
    try {
      await loginGoogle();
    } catch (err) {
      console.error("[GOOGLE]", err);
      toast("Erro ao conectar com Google");
    }
  };
}
