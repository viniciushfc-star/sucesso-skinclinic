import { getActiveOrg, createOrgAndSetActive, loadUserOrganizations }
  from "../core/org.js";

import { showLoader, hideLoader }
  from "../ui/loader.js";

import { toast }
  from "../ui/toast.js";

import { navigate }
  from "../core/spa.js";

export async function init() {
  const container = document.getElementById("view-onboarding");

  // Esta página não tem a view de onboarding (ex.: dashboard.html) → redireciona para index
  if (!container) {
    window.location.href = "/index.html#onboarding";
    return;
  }

  const activeOrg = getActiveOrg();
  // Só redireciona se o usuário realmente tiver org no servidor (evita localStorage antigo)
  if (activeOrg) {
    const orgs = await loadUserOrganizations();
    if (orgs && orgs.length > 0) {
      navigate("bootstrap");
      return;
    }
  }

  container.innerHTML = `
    <h1>Bem-vindo ao SkinClinic</h1>
    <p>Vamos começar criando sua clínica.</p>

    <label for="orgName">
      Nome da clínica
    </label>

    <input
      type="text"
      id="orgName"
      name="orgName"
      autocomplete="organization"
    />

    <button
      type="button"
      id="btnCreateOrg"
    >
      Criar clínica
    </button>
  `;

  bindCreateOrg();
}


function bindCreateOrg() {
  const btn = document.getElementById("btnCreateOrg");
  const input = document.getElementById("orgName");

  if (!btn || !input) return;

btn.onclick = async () => {
  const name = input.value.trim();

  if (!name) {
    alert("Informe o nome da clínica");
    return;
  }

  try {
    console.log("[ONBOARDING] criando organização:", name);

    // 1. cria a org e define como ativa
    await createOrgAndSetActive(name);

    console.log("[ONBOARDING] organização criada, redirecionando para dashboard");

    // 2. redireciona para o dashboard (org já está ativa no localStorage)
    window.location.href = "/index.html#dashboard";

  } catch (err) {
    console.error("[ONBOARDING] erro ao criar org", err);
    alert("Erro ao criar clínica");
  }
};
}
