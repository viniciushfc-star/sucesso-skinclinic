import { inviteUser }
 from "../core/org.js";

import { audit } 
from "../services/audit.service.js";


const form = document.getElementById("inviteForm");
const emailInput = document.getElementById("inviteEmail");
const roleSelect = document.getElementById("inviteRole");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  try {
    await inviteUser({
      email: emailInput.value.trim(),
      role: roleSelect.value
    });
await audit({
  action: "team.invite",
  tableName: "organization_invites",
  recordId: email, // enquanto não houver ID
  permissionUsed: "team:invite",
  metadata: {
    invited_email: email,
    role_assigned: role,
    job_title: jobTitle
  }
});


    alert("Convite enviado com sucesso!");
    form.reset();

  } catch (err) {
    console.error("[INVITE-VIEW]", err);
    alert(err.message || "Erro ao enviar convite");
  }
});
