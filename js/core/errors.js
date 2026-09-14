/**
 * Mensagem visível ao usuário. Nunca engolir o motivo real.
 */
export function userFacingError(err, fallback = "Não foi possível concluir. Tente de novo.") {
  const code = String(err?.code || err?.error_code || err?.status || "")
  const raw = String(err?.message || err?.error_description || err?.msg || err?.hint || "").trim()
  const s = `${raw} ${code}`.toLowerCase()

  if (s.includes("campos obrigatórios")) return "Preencha nome, CPF, e-mail e senha."
  if (s.includes("senhas não conferem") || s.includes("senhas nao conferem")) return "As senhas não são iguais."
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
  if (
    s.includes("signups not allowed") ||
    s.includes("signup is disabled") ||
    s.includes("signups are disabled") ||
    s.includes("sign up is disabled") ||
    s.includes("email signups")
  ) {
    return "O cadastro por e-mail está desligado no Supabase. Ligue “Allow new users to sign up” em Authentication → Providers → Email, ou crie o usuário em Authentication → Users."
  }
  if (s.includes("rate") || s.includes("over_email") || s.includes("too many")) {
    return "Muitas tentativas. Aguarde um minuto e tente de novo."
  }
  if (s.includes("database error") || s.includes("saving new user") || s.includes("error saving")) {
    return "O banco recusou o usuário novo (geralmente trigger de perfil). No Supabase: Authentication → veja o erro, e SQL do profiles."
  }
  if (s.includes("redirect") && (s.includes("not allowed") || s.includes("whitelist") || s.includes("allow"))) {
    return "URL de retorno não autorizada. Em Authentication → URL Configuration, inclua https://skinclinic-one.vercel.app/** e /new-password.html"
  }
  if (s.includes("failed to fetch") || s.includes("networkerror") || s.includes("load failed")) {
    return "Falha de conexão. Verifique a internet e tente de novo."
  }
  if (code === "42501" || s.includes("row-level security") || s.includes("rls")) {
    return "O banco recusou a operação (permissão). Confirme que está logado e que o SQL de isolamento foi aplicado."
  }
  if (code === "23505" || s.includes("duplicate")) {
    return "Já existe um registro com esses dados."
  }
  if (s.includes("does not provide an export") || s.includes("failed to resolve module")) {
    return "A página quebrou ao carregar (módulo ausente). Recarregue com Ctrl+F5; se persistir, o deploy está incompleto."
  }
  if (raw && raw.length < 220 && !raw.startsWith("{")) return raw
  return fallback
}
