import { supabase } from "./supabase.js"

/* ======================
   LOGGER (apoio)
====================== */

function log(type, msg, data = null) {
  console[type](`[AUTH] ${msg}`, data || "")
}

/* ======================
   LOGIN COM EMAIL
====================== */

export async function loginEmail(email, password) {
  try {
    if (!email || !password) {
      throw new Error("Email e senha obrigatórios")
    }

    log("info", "Tentativa login", email)

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password
      })

    if (error) throw error
    if (!data?.session?.user) {
      throw new Error("Sessão inválida")
    }

    /* ======================
       ✅ LOGIN BEM-SUCEDIDO
       (termina aqui)
    ====================== */
    log("info", "Login sucesso", data.session.user.email)

    return data.session.user

  } catch (err) {
    log("error", "Erro login", err)
    throw err
  }
}

/* ======================
   LOGIN COM GOOGLE
====================== */

export async function loginGoogle() {
  try {
    log("info", "Login Google iniciado")

    const { data, error } =
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth-callback.html`
        }
      })

    if (error) throw error
    return data

  } catch (err) {
    log("error", "Erro Google", err)
    throw err
  }
}


/* ======================
   REGISTER
====================== */

export async function registerEmail(name, cpf, email, password) {
  try {
    if (!name || !cpf || !email || !password) {
      throw new Error("Campos obrigatórios")
    }

    const { data, error } =
      await supabase.auth.signUp({
        email,
        password,
        options: { data: { name, cpf } }
      })

    if (error) throw error

    log("info", "Usuário criado", data.user?.id)
    return data

  } catch (err) {
    log("error", "Erro cadastro", err)
    throw err
  }
}

/* ======================
   RESET / SESSION
====================== */

export async function sendReset(email) {
  if (!email) throw new Error("Email obrigatório")

  await supabase.auth.resetPasswordForEmail(
    email,
    { redirectTo: `${window.location.origin}/new-password.html` }
  )
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session || null
}

export async function logout() {
  await supabase.auth.signOut()
  log("info", "Logout realizado")
}
/* ======================
   PROTECT PAGE
====================== */

export async function protectPage() {
  const isLoginPage =
    typeof window !== "undefined" &&
    (window.location.pathname === "/" ||
     window.location.pathname === "/index.html" ||
     window.location.pathname.endsWith("/index.html"));

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error("[AUTH] Erro ao verificar sessão", error);
    if (!isLoginPage) window.location.href = "/index.html";
    return;
  }

  if (!data?.session) {
    if (!isLoginPage) {
      console.warn("[AUTH] Sessão inexistente, redirecionando para login");
      window.location.href = "/index.html";
    }
    return;
  }

  // sessão válida → segue o fluxo
}

