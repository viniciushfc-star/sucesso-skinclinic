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
    window.location.href = "/index.html";
    return;
  }

  clearActiveOrg();

  const orgs = await loadUserOrganizations();
  if (orgs && orgs.length > 0) {
    window.location.href = "/dashboard.html";
    return;
  }

  if (!form || !input) return;

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
      window.location.href = "/dashboard.html";
    } catch (err) {
      console.error("[ONBOARDING]", err);
      showError(err.message || "Erro ao criar clínica. Tente de novo.");
      if (btn) btn.disabled = false;
    }
  });
}

init();
