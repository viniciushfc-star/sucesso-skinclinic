/**
 * Mensagem visível à clínica. Código técnico (403, PGRST, JWT) vira português.
 */

const HTTP_PT = {
  400: "O pedido não pôde ser aceito. Falta algum dado ou o formato não serve.",
  401: "Sua sessão acabou. Entre de novo para continuar.",
  403: "Este perfil não pode fazer isso. Peça à administradora se precisar.",
  404: "Não encontramos isso. Pode ter sido removido ou o endereço mudou.",
  408: "A espera passou do tempo. Tente de novo.",
  409: "Isso já existe ou está em conflito com outro registro.",
  422: "Algum campo está inválido. Confira o que foi preenchido.",
  429: "Muitas tentativas seguidas. Espere um minuto e tente de novo.",
  500: "O servidor falhou agora. Tente de novo em instantes.",
  502: "O servidor não respondeu direito. Tente de novo em instantes.",
  503: "O serviço está temporariamente fora. Tente de novo em instantes.",
  504: "O servidor demorou demais. Tente de novo em instantes.",
};

function textoDe(err) {
  if (err == null) return "";
  if (typeof err === "string" || typeof err === "number") return String(err).trim();
  return String(
    err.message ||
      err.error_description ||
      err.error ||
      err.msg ||
      err.hint ||
      err.details ||
      ""
  ).trim();
}

function statusDe(err) {
  const direto = Number(err?.status || err?.statusCode || err?.httpStatus);
  if (direto >= 400 && direto < 600) return direto;
  const t = textoDe(err);
  const soNumero = t.match(/^(?:erro:?\s*|http\s+)?(\d{3})$/i);
  if (soNumero) return Number(soNumero[1]);
  const http = t.match(/\bHTTP\s+(\d{3})\b/i);
  if (http) return Number(http[1]);
  return 0;
}

function soCodigoTecnico(raw) {
  const t = String(raw || "").trim();
  if (!t) return true;
  if (t.length > 220 || t.startsWith("{") || t.startsWith("[")) return true;
  if (/^(?:erro:?\s*|http\s+)?\d{3,}$/i.test(t)) return true;
  if (/^https?:\/\//i.test(t) && t.length < 12) return true;
  if (/^(PGRST\d+|42P01|42501|23505|23503|23514|22P02|P0001|28000|28P01|42703|42704)\b/i.test(t)) return true;
  if (/^[a-z][a-z0-9_]{2,48}$/i.test(t) && /_/.test(t)) return true;
  if (/permission denied|jwt expired|not authorized|row-level security|failed to fetch/i.test(t)) return true;
  if (/^[A-Z][A-Z0-9_]{2,40}$/.test(t)) return true;
  return false;
}

/**
 * @param {unknown} err
 * @param {string} [fallback]
 */
export function userFacingError(err, fallback = "Não foi possível concluir. Tente de novo.") {
  const code = String(err?.code || err?.error_code || "").trim();
  const raw = textoDe(err);
  const status = statusDe(err);
  const s = `${raw} ${code} ${status}`.toLowerCase();

  if (s.includes("campos obrigatórios")) return "Preencha nome, CPF, e-mail e senha.";
  if (s.includes("senhas não conferem") || s.includes("senhas nao conferem")) return "As senhas não são iguais.";
  if (
    code === "email_exists" ||
    s.includes("already registered") ||
    s.includes("user already") ||
    s.includes("email already")
  ) {
    return "Este e-mail já tem conta. Entre com a senha ou use “Esqueci minha senha”.";
  }
  if (code === "weak_password" || (s.includes("password") && (s.includes("least") || s.includes("6 character") || s.includes("too short") || s.includes("weak")))) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  if (code === "email_address_invalid" || s.includes("invalid email") || s.includes("unable to validate email")) {
    return "E-mail inválido. Confira o endereço.";
  }
  if (
    s.includes("signups not allowed") ||
    s.includes("signup is disabled") ||
    s.includes("signups are disabled") ||
    s.includes("sign up is disabled") ||
    s.includes("email signups")
  ) {
    return "O cadastro por e-mail está desligado no Supabase. Ligue “Allow new users to sign up” em Authentication → Providers → Email, ou crie o usuário em Authentication → Users.";
  }
  if (s.includes("over_email") || s.includes("too many requests") || status === 429) {
    return HTTP_PT[429];
  }
  if (s.includes("database error") || s.includes("saving new user") || s.includes("error saving")) {
    return "O banco recusou o usuário novo (geralmente trigger de perfil). No Supabase: Authentication → veja o erro, e SQL do profiles.";
  }
  if (s.includes("redirect") && (s.includes("not allowed") || s.includes("whitelist") || s.includes("allow"))) {
    return "URL de retorno não autorizada. Em Authentication → URL Configuration, inclua https://skinclinic-one.vercel.app/** e /new-password.html";
  }
  if (s.includes("failed to fetch") || s.includes("networkerror") || s.includes("load failed") || s.includes("network request failed")) {
    return "Falha de conexão. Verifique a internet e tente de novo.";
  }
  if (s.includes("jwt expired") || s.includes("invalid jwt") || s.includes("session") && s.includes("expired")) {
    return HTTP_PT[401];
  }
  if (code === "42501" || s.includes("row-level security") || /\brls\b/.test(s) || s.includes("permission denied for")) {
    return "O banco recusou a operação (permissão). Confirme que está logada e que o SQL de isolamento foi aplicado.";
  }
  if (code === "PGRST116" || s.includes("pgrst116") || s.includes("cannot coerce the result to a single json object")) {
    return "Nada foi salvo. Confira se você tem permissão de editar nesta clínica.";
  }
  if (code === "PGRST205" || code === "42P01" || s.includes("pgrst205") || s.includes("42p01") || s.includes("schema cache") || s.includes("could not find the table")) {
    return "Falta uma tabela no banco. Cole o SQL correspondente no Editor SQL do Supabase.";
  }
  if (code === "PGRST204" || (s.includes("could not find the") && s.includes("column"))) {
    return "Falta uma coluna no banco. O SQL desta funcionalidade ainda não foi colado.";
  }
  if (code === "23505" || s.includes("duplicate")) {
    return "Já existe um registro com esses dados.";
  }
  if (code === "23503") {
    return "Esse registro está ligado a outro. Não dá para apagar assim.";
  }
  if (code === "23514" || s.includes("check constraint")) {
    if (s.includes("role")) {
      return "O banco ainda não aceita a função Profissional ou Recepção. Rode o SQL supabase-fase0-equipe-fotos-convite-colar.sql.";
    }
    return "O banco recusou um valor deste formulário.";
  }
  if (s.includes("does not provide an export") || s.includes("failed to resolve module")) {
    return "A página quebrou ao carregar (módulo ausente). Recarregue com Ctrl+F5; se persistir, o deploy está incompleto.";
  }
  if (s.includes("forbidden") || s.includes("not allowed for this role") || s.includes("insufficient")) {
    return HTTP_PT[403];
  }
  if (s.includes("unauthorized") || s.includes("not authenticated") || s.includes("no authorization")) {
    return HTTP_PT[401];
  }

  if (HTTP_PT[status]) return HTTP_PT[status];

  if (raw && !soCodigoTecnico(raw)) return raw;
  return fallback;
}

/**
 * Lê corpo de resposta HTTP e devolve texto em português (nunca só o número).
 */
export async function mensagemDeRespostaHttp(res) {
  const status = Number(res?.status) || 0;
  let body = {};
  try {
    body = await res.clone().json();
  } catch (_) {
    try {
      const t = await res.clone().text();
      if (t && t.length < 220) body = { message: t };
    } catch (_) {}
  }
  return userFacingError({
    status,
    code: body.code || body.error_code,
    message: body.error || body.message || body.msg || "",
  });
}
