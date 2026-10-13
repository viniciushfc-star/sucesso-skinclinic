/**
 * Login da paciente no portal — separado do login da equipe.
 * Senha só no cadastro dela; o link da ficha continua valendo.
 */

export function emailPortalNorm(s) {
  return String(s || "").trim().toLowerCase();
}

export function senhaPortalOk(s) {
  const t = String(s || "");
  return t.length >= 8 && t.length <= 72 && !/\s/.test(t);
}
