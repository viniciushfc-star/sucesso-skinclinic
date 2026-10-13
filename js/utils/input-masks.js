/** Máscaras de CPF e telefone (BR) — aplicam desde a 1ª tecla. */

export function digitsOnly(value, max) {
  const d = String(value || "").replace(/\D/g, "");
  return max ? d.slice(0, max) : d;
}

export function formatCpf(value) {
  let v = digitsOnly(value, 11);
  v = v.replace(/(\d{3})(\d)/, "$1.$2");
  v = v.replace(/(\d{3})(\d)/, "$1.$2");
  v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return v;
}

/** Celular (00) 00000-0000 ou fixo (00) 0000-0000 */
export function formatPhone(value) {
  let v = digitsOnly(value, 11);
  if (v.length > 6) {
    if (v[2] === "9") v = v.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
    else v = v.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  } else if (v.length > 2) {
    v = v.replace(/(\d{2})(\d{0,4})/, "($1) $2");
  } else if (v.length) {
    v = "(" + v;
  }
  return v.replace(/-$/, "").replace(/ $/, "");
}

export function applyCpfMask(input) {
  if (!input) return;
  input.value = formatCpf(input.value);
}

export function applyPhoneMask(input) {
  if (!input) return;
  input.value = formatPhone(input.value);
}

export function bindCpfMask(input) {
  if (!input) return;
  input.setAttribute("inputmode", "numeric");
  input.setAttribute("autocomplete", "off");
  input.setAttribute("maxlength", "14");
  if (!input.getAttribute("placeholder")) input.placeholder = "000.000.000-00";
  const run = () => applyCpfMask(input);
  input.addEventListener("input", run);
  input.addEventListener("focus", run);
  run();
}

export function bindPhoneMask(input) {
  if (!input) return;
  input.setAttribute("type", "tel");
  input.setAttribute("inputmode", "tel");
  input.setAttribute("autocomplete", "tel");
  input.setAttribute("maxlength", "15");
  if (!input.getAttribute("placeholder")) input.placeholder = "(00) 00000-0000";
  const run = () => applyPhoneMask(input);
  input.addEventListener("input", run);
  input.addEventListener("focus", run);
  run();
}
