import { supabase } from "../core/supabase.js";
import { redirect } from "../core/base-path.js";

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
    if (session) {
      redirect("/dashboard.html");
      return;
    }
    const el = document.querySelector("p");
    if (el) {
      el.textContent = "Não foi possível confirmar o acesso. Volte ao login ou use o link do e-mail de novo.";
    }
    window.setTimeout(() => redirect("/index.html"), 2500);
  } catch (err) {
    console.error("[AUTH CALLBACK]", err);
    redirect("/index.html");
  }
}

init();
