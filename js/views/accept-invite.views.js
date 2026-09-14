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

import { redirect } from "../core/base-path.js";
import { userFacingError } from "../core/errors.js";

export async function init() {
  const container = document.getElementById("view-accept-invite");
  if (!container) return;

  const session = await getSession();
  const email = session?.user?.email;

  if (!email) {
    redirect("/index.html");
    return;
  }

  let invite;
  try {
    invite = await getInviteByEmail(email);
  } catch (err) {
    toast(userFacingError(err, "Não foi possível buscar o convite."), "error");
    return;
  }

  if (!invite) {
    toast("Convite não encontrado para este e-mail.");
    redirect("/onboarding.html");
    return;
  }

  container.innerHTML = `
    <h1>Você foi convidado</h1>
    <p>Clínica: <strong>${invite.organization_name}</strong></p>
    <p id="acceptInviteMsg" role="status"></p>
    <button id="btnAcceptInvite">Entrar na clínica</button>
  `;

  bindAccept(invite);
}

function bindAccept(invite) {
  const btn = document.getElementById("btnAcceptInvite");
  const msgEl = document.getElementById("acceptInviteMsg");
  if (!btn) return;

  btn.onclick = async () => {
    btn.disabled = true;
    try {
      showLoader();
      await acceptInviteAndSetActive(invite);
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
      toast("Bem-vindo à clínica!");
      redirect("/dashboard.html");
    } catch (err) {
      console.error(err);
      const msg = userFacingError(err, "Não foi possível aceitar o convite.");
      toast(msg, "error");
      if (msgEl) {
        msgEl.style.color = "#b91c1c";
        msgEl.textContent = msg;
      }
    } finally {
      hideLoader();
      btn.disabled = false;
    }
  };
}
