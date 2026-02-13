import { getInviteByEmail } 
from "../services/invite.service.js";

import { acceptInviteAndSetActive } 
from "../core/org.js";

import { showLoader, hideLoader }
 from "../ui/loader.js";

import { toast }
 from "../ui/toast.js";

import { getSession }
 from "../core/auth.js";

import { audit }
 from "../services/audit.service.js";


export async function init() {
  const container = document.getElementById("view-accept-invite");
  if (!container) return;

  const session = await getSession();
  const email = session?.user?.email;

  if (!email) {
    window.location.href = "/index.html";
    return;
  }

  const invite = await getInviteByEmail(email);

  if (!invite) {
    toast("Convite não encontrado");
    window.location.href = "/onboarding.html";
    return;
  }

  container.innerHTML = `
    <h1>Você foi convidado</h1>
    <p>Clínica: <strong>${invite.organization_name}</strong></p>
    <button id="btnAcceptInvite">Entrar na clínica</button>
  `;

  bindAccept(invite);
}

function bindAccept(invite) {
  const btn = document.getElementById("btnAcceptInvite");
  if (!btn) return;

  btn.onclick = async () => {
   btn.disabled = true;
    try {
      showLoader();
      await acceptInviteAndSetActive(invite);
      toast("Bem-vindo à clínica!");
      window.location.href = "/dashboard.html";
    } 
await audit({
  action: "team.accept_invite",
  tableName: "organization_invites",
  recordId: invite.id || invite.email || null,
  permissionUsed: "team:invite",
  metadata: {
    org_id: invite.org_id,
    role_assigned: invite.role,
    invited_email: invite.email || null
  }
});

catch (err) {
      console.error(err);
      toast("Erro ao aceitar convite");
    } finally {
      hideLoader();
  btn.disabled = false;

    }
  };
}

