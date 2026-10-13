/**
 * Onboarding – página independente (sem SPA).
 * Usada quando o usuário faz login sem organização.
 * Fluxo: session? → já tem org? → mostrar formulário → criar org → dashboard.
 */
import { getSession } from "./core/auth.js";
import {
  loadUserOrganizations,
  createOrgAndSetActive,
  clearActiveOrg,
} from "./core/org.js";
import { redirect } from "./core/base-path.js";
import { userFacingError } from "./core/errors.js";

const form = document.getElementById("onboardingForm");
const input = document.getElementById("orgName");
const errorEl = document.getElementById("onboardingError");

function showError(msg) {
  if (errorEl) {
    errorEl.textContent = msg || "";
    errorEl.classList.toggle("hidden", !msg);
  }
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function init() {
  let session = await getSession();
  if (!session) {
    await delay(400);
    session = await getSession();
  }
  if (!session) {
    redirect("/index.html");
    return;
  }

  clearActiveOrg();

  const orgs = await loadUserOrganizations();
  if (orgs && orgs.length > 0) {
    redirect("/dashboard.html");
    return;
  }

  if (!form || !input) return;

  const vv = window.visualViewport;
  const applyKeyboard = () => {
    const keyboard = vv
      ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      : 0;
    document.documentElement.style.setProperty("--sc-vv-offset", `${keyboard}px`);
    if (document.activeElement === input) {
      input.scrollIntoView({ block: "center", inline: "nearest" });
    }
  };
  if (vv) {
    vv.addEventListener("resize", applyKeyboard);
    vv.addEventListener("scroll", applyKeyboard);
  }
  input.addEventListener("focus", () => setTimeout(applyKeyboard, 80));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = (input.value || "").trim();
    if (!name) {
      showError("Informe o nome da clínica.");
      return;
    }

    showError("");
    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;

    try {
      await createOrgAndSetActive(name);
      redirect("/dashboard.html");
    } catch (err) {
      console.error("[ONBOARDING]", err);
      let msg = userFacingError(err, "Erro ao criar clínica. Tente de novo.");
      const raw = String(err?.message || "");
      if (/row-level|42501|create_clinic|permission denied/i.test(raw)) {
        msg =
          "O banco ainda não deixa criar clínica. No Supabase → SQL Editor, cole e rode o arquivo supabase-fase0-criar-clinica-colar.sql. Depois tente de novo.";
      }
      showError(msg);
      if (btn) btn.disabled = false;
    }
  });
}

init();
