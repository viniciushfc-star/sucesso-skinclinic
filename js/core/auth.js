import { supabase } from "./supabase.js"
import { getBase, redirect, urlFor } from "./base-path.js"

/* ======================
   LOGGER (apoio)
====================== */

function log(type, msg, data = null) {
  console[type](`[AUTH] ${msg}`, data || "")
}

/** Mensagem em português a partir de erro do Auth (Supabase) — nunca genérica demais. */
export function authErrorMessage(err, fallback = "Não foi possível concluir. Tente de novo.") {
  const code = String(err?.code || err?.error_code || "")
  const raw = String(err?.message || err?.error_description || err?.msg || "").trim()
  const s = `${raw} ${code}`.toLowerCase()

  if (s.includes("campos obrigatórios")) {
    return "Preencha nome, CPF, e-mail e senha."
  }
  if (s.includes("senhas não conferem") || s.includes("senhas nao conferem")) {
    return "As senhas não são iguais."
  }
  if (
    code === "email_exists" ||
    s.includes("already registered") ||
    s.includes("user already") ||
    s.includes("email already")
  ) {
    return "Este e-mail já tem conta. Entre com a senha ou use “Esqueci minha senha”."
  }
  if (code === "weak_password" || (s.includes("password") && (s.includes("least") || s.includes("6 character") || s.includes("too short") || s.includes("weak")))) {
    return "A senha precisa ter pelo menos 6 caracteres."
  }
  if (code === "email_address_invalid" || s.includes("invalid email") || s.includes("unable to validate email")) {
    return "E-mail inválido. Confira o endereço."
  }
  if (s.includes("signups not allowed") || s.includes("signup is disabled") || s.includes("sign up is disabled")) {
    return "O cadastro público está desligado. Peça um convite à clínica ou ative Signups no Supabase Auth."
  }
  if (s.includes("rate") || s.includes("over_email") || s.includes("too many")) {
    return "Muitas tentativas. Aguarde um minuto e tente de novo."
  }
  if (s.includes("database error") || s.includes("saving new user") || s.includes("error saving")) {
    return "O banco recusou o usuário novo (geralmente trigger de perfil). No Supabase: Authentication → veja o erro, e SQL do profiles."
  }
  if (s.includes("redirect") && (s.includes("not allowed") || s.includes("whitelist") || s.includes("allow"))) {
    return "URL de retorno não autorizada. Em Authentication → URL Configuration, inclua https://skinclinic-one.vercel.app"
  }
  if (s.includes("failed to fetch") || s.includes("networkerror") || s.includes("load failed")) {
    return "Falha de conexão com o servidor de login. Verifique a internet."
  }
  if (raw && raw.length < 180 && !raw.startsWith("{")) {
    return raw
  }
  return fallback
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

    const origin = typeof window !== "undefined" ? window.location.origin : ""
    const { data, error } =
      await supabase.auth.signUp({
        email: String(email).trim(),
        password,
        options: {
          data: { name: String(name).trim(), cpf: String(cpf).trim() },
          emailRedirectTo: origin ? `${origin}/auth-callback.html` : undefined,
        }
      })

    if (error) throw error

    const identities = data?.user?.identities
    if (data?.user && Array.isArray(identities) && identities.length === 0) {
      throw new Error("Este e-mail já tem conta. Entre com a senha ou use “Esqueci minha senha”.")
    }

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
    { redirectTo: urlFor("/new-password.html") }
  )
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session || null
}

/** Chaves de sessionStorage que guardam estado de navegação (perfil, edição, etc.). Limpar ao sair para não vazar entre usuários. */
const SESSION_KEYS_TO_CLEAR = [
  "clientePerfilId", "clientePerfilOpenEdit", "clientePerfilOpenTab", "clientePerfilAgendaId",
  "profissionalPerfilId", "procedimentoEditId", "teamShowManage",
  "anamnese_client_id", "anamnese_agenda_id", "anamnese_procedimento", "anamnese_funcao_slug",
  "skincare_client_id", "skincare_from_profile", "skincare_protocol_id",
  "financeiro_open_tab", "precificacaoValorSimulador",
  "protocolo_analise_id", "calendario_paste_content",
];

export function clearSessionState() {
  if (typeof sessionStorage === "undefined") return;
  SESSION_KEYS_TO_CLEAR.forEach((key) => sessionStorage.removeItem(key));
  log("info", "Session state cleared");
}

export async function logout() {
  clearSessionState();
  await supabase.auth.signOut();
  log("info", "Logout realizado");
}
/* ======================
   PROTECT PAGE
====================== */

export async function protectPage() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : ""
  const base = getBase()
  const isLoginPage =
    typeof window !== "undefined" &&
    (pathname === "/" || pathname === base || pathname === base + "/" ||
     pathname.endsWith("/index.html") || pathname === base + "/index.html");

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error("[AUTH] Erro ao verificar sessão", error);
    if (!isLoginPage) redirect("/index.html");
    return;
  }

  if (!data?.session) {
    if (!isLoginPage) {
      console.warn("[AUTH] Sessão inexistente, redirecionando para login");
      redirect("/index.html");
    }
    return;
  }

  // sessão válida → segue o fluxo
}

/* ======================
   SESSÃO EXPIRADA / 401
====================== */

/**
 * Redireciona para login e limpa estado quando a sessão for invalidada
 * (ex.: token expirado, logout em outra aba). Chame uma vez no bootstrap do app.
 */
export function setupSessionExpiredRedirect() {
  function isLoginPage() {
    const pathname = typeof window !== "undefined" ? window.location.pathname : "";
    const base = getBase();
    return pathname === "/" || pathname === base || pathname === base + "/" ||
      pathname.endsWith("/index.html") || pathname === base + "/index.html";
  }
  supabase.auth.onAuthStateChange(function (event, session) {
    if (event === "SIGNED_OUT" || event === "TOKEN_REFRESH_FAILED") {
      clearSessionState();
      if (!isLoginPage()) {
        log("warn", "Sessão encerrada ou expirada, redirecionando para login");
        redirect("/index.html");
      }
    }
  });
}

/**
 * Útil após uma chamada à API/Supabase: se o erro for 401 ou PGRST301 (JWT expirado),
 * redireciona para login. Use em serviços que fazem fetch direto (ex.: /api/*).
 */
export function redirectToLoginIfUnauthorized(error) {
  const code = error?.code || error?.status;
  const msg = String(error?.message || error?.error_description || "").toLowerCase();
  if (code === 401 || code === "401" || msg.includes("jwt") && (msg.includes("expired") || msg.includes("invalid"))) {
    clearSessionState();
    if (typeof window !== "undefined" && !window.location.pathname.endsWith("index.html"))
      redirect("/index.html");
    return true;
  }
  return false;
}
