import { loadUserOrganizations, setActiveOrg, getActiveOrg, clearActiveOrg } from "./org.js";
import { getInviteByEmail } from "../services/invite.service.js";
import { getSession } from "./auth.js";
import { supabase } from "./supabase.js";

async function countClients(orgId) {
  const { count, error } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  if (error) return -1;
  return Number(count) || 0;
}

/** Não fica na org vazia (ex.: Clínica QA) se outra membership tiver pacientes. */
async function pickActiveOrg(orgs) {
  const ids = [];
  const seen = new Set();
  for (const o of orgs) {
    if (!o?.org_id || seen.has(o.org_id)) continue;
    seen.add(o.org_id);
    ids.push(o.org_id);
  }
  const stored = getActiveOrg();
  if (stored && seen.has(stored) && (await countClients(stored)) > 0) {
    return stored;
  }
  let best = ids[0];
  let nBest = -1;
  for (const id of ids) {
    const n = await countClients(id);
    if (n > nBest) {
      nBest = n;
      best = id;
    }
  }
  return best;
}

export async function bootstrapAfterLogin() {
  console.log("[BOOTSTRAP] Iniciando pós-login");

  const session = await getSession();
  const email = session?.user?.email;

  if (!email) {
    return { next: "login" };
  }

  const orgs = await loadUserOrganizations();

  if (orgs && orgs.length > 0) {
    setActiveOrg(await pickActiveOrg(orgs));
    return { next: "dashboard" };
  }

  clearActiveOrg();

  let invite = null;
  try {
    invite = await getInviteByEmail(email);
  } catch (err) {
    console.warn("[BOOTSTRAP] Convite indisponível, seguindo para onboarding", err);
  }

  if (invite) {
    return { next: "accept-invite" };
  }

  return { next: "onboarding" };
}
