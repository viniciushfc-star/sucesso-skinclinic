import { createOrgAndSetActive } from "../core/org.js";
import { redirect } from "../core/base-path.js";
import { userFacingError } from "../core/errors.js";

const form = document.getElementById("createOrgForm");
const input = document.getElementById("orgName");

if (!form || !input) {
  document.body?.insertAdjacentHTML(
    "afterbegin",
    "<p role=\"alert\" style=\"color:#b91c1c;padding:12px\">Página de criar clínica incompleta. Use /onboarding.html</p>"
  );
} else {
  const msg = document.createElement("p");
  msg.id = "createOrgMsg";
  msg.setAttribute("role", "status");
  form.appendChild(msg);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";
    try {
      if (!input.value.trim()) {
        msg.style.color = "#b91c1c";
        msg.textContent = "Informe o nome da clínica";
        return;
      }
      await createOrgAndSetActive(input.value.trim());
      msg.style.color = "#15803d";
      msg.textContent = "Clínica criada. Abrindo o sistema…";
      redirect("/dashboard.html");
    } catch (err) {
      console.error("[CREATE-ORG]", err);
      msg.style.color = "#b91c1c";
      msg.textContent = userFacingError(err, "Não foi possível criar a clínica.");
    }
  });
}
