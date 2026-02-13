import { createOrgAndSetActive } from "../core/org.js";

const form = document.getElementById("createOrgForm");
const input = document.getElementById("orgName");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  try {
    if (!input.value.trim()) {
      alert("Informe o nome da clínica");
      return;
    }

    await createOrgAndSetActive(input.value.trim());

    // após criar e vincular → dashboard
    window.location.href = "/dashboard.html";

  } catch (err) {
    console.error("[CREATE-ORG]", err);
    alert("Erro ao criar clínica");
  }
});
