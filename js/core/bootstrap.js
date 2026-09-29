import { loadUserOrganizations, setActiveOrg } from "./org.js";
import { getInviteByEmail } from "../services/invite.service.js";
import { getSession } from "./auth.js";

export async function bootstrapAfterLogin() {
  console.log("[BOOTSTRAP] Iniciando pós-login");

  const session = await getSession();
  const email = session?.user?.email;

  if (!email) {
    return { next: "login" };
  }

  // 1️⃣ carrega organizações do usuário
  const orgs = await loadUserOrganizations();

  // 2️⃣ se tiver org, define ANTES de qualquer outro service
  if (orgs && orgs.length > 0) {
    setActiveOrg(orgs[0].org_id);
    return { next: "dashboard" };
  }

  // 3️⃣ somente se NÃO tiver org, verifica convite
  const invite = await getInviteByEmail(email);

  if (invite) {
    return { next: "accept-invite" };
  }

  // 4️⃣ fallback → onboarding
  return { next: "onboarding" };
}
