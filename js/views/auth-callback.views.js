import { supabase } from "../core/supabase.js";
import { redirect } from "../core/base-path.js";
import { bootstrapAfterLogin } from "../core/bootstrap.js";
import { clearActiveOrg } from "../core/org.js";

export function init() {
  validateSession();
}

async function waitForSession(ms = 2500) {
  const started = Date.now();
  while (Date.now() - started < ms) {
    const { data } = await supabase.auth.getSession();
    if (data?.session) return data.session;
    await new Promise((r) => setTimeout(r, 200));
  }
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

async function validateSession() {
  try {
    const session = await waitForSession();
    if (!session) {
      const el = document.querySelector("p");
      if (el) {
        el.textContent = "Não foi possível confirmar o acesso. Volte ao login ou use o link do e-mail de novo.";
      }
      window.setTimeout(() => redirect("/index.html"), 2500);
      return;
    }

    clearActiveOrg();
    const { next } = await bootstrapAfterLogin();
    if (next === "onboarding") {
      redirect("/onboarding.html");
      return;
    }
    if (next === "accept-invite") {
      redirect("/index.html#accept-invite");
      return;
    }
    redirect("/dashboard.html");
  } catch (err) {
    console.error("[AUTH CALLBACK]", err);
    clearActiveOrg();
    redirect("/onboarding.html");
  }
}

init();
