/* =========================
   IMPORTS
========================= */
import { loginEmail, loginGoogle, registerEmail }
  from "../core/auth.js";

import { bootstrapAfterLogin }
  from "../core/bootstrap.js";

import { clearActiveOrg }
  from "../core/org.js";

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
document.addEventListener("DOMContentLoaded", init);

function init() {
  if (modal) modal.classList.add("hidden");
  bindLogin();
  bindRegister();
  bindGoogle();
  if (btnRegister) btnRegister.addEventListener("click", () => modal?.classList.remove("hidden"));
  if (closeBtn) closeBtn.addEventListener("click", () => modal?.classList.add("hidden"));
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

      if (result.next === "dashboard") {
        window.location.href = "/dashboard.html";
        return;
      }

      if (result.next === "onboarding") {
        clearActiveOrg();
        window.location.href = "/onboarding.html";
        return;
      }

      if (result.next === "accept-invite") {
        window.location.href = "/index.html#accept-invite";
        return;
      }

      toast("Estado de usuário inválido");

    } catch (err) {
      console.error("[LOGIN]", err);
      toast(err.message || "Erro ao entrar");
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
