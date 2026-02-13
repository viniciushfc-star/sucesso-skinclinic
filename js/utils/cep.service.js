/**
 * Busca de CEP via ViaCEP (https://viacep.com.br).
 * Retorna logradouro, bairro, localidade, uf.
 */

const VIACEP_URL = "https://viacep.com.br/ws";

/**
 * Busca endereço pelo CEP.
 * @param {string} cep - CEP com ou sem formatação (apenas dígitos)
 * @returns {Promise<{logradouro: string, bairro: string, localidade: string, uf: string} | null>}
 */
export async function buscarCep(cep) {
  const raw = String(cep || "").replace(/\D/g, "");
  if (raw.length !== 8) return null;

  try {
    const resp = await fetch(`${VIACEP_URL}/${raw}/json/`);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.erro) return null;
    return {
      logradouro: data.logradouro || "",
      bairro: data.bairro || "",
      localidade: data.localidade || "",
      uf: data.uf || "",
    };
  } catch {
    return null;
  }
}

/**
 * Aplica máscara 00000-000 no input de CEP.
 * @param {HTMLInputElement} input
 */
export function maskCepInput(input) {
  if (!input) return;
  let v = input.value.replace(/\D/g, "");
  if (v.length > 8) v = v.slice(0, 8);
  if (v.length > 5) v = v.replace(/(\d{5})(\d{0,3})/, "$1-$2");
  input.value = v;
}

/**
 * Preenche campos de endereço a partir do resultado da busca.
 * @param {object} result - Resultado de buscarCep
 * @param {object} fields - { cidade?, estado?, endereco? } - elementos input
 * @param {boolean} overwrite - se false, só preenche quando vazio
 */
export function fillAddressFields(result, fields, overwrite = false) {
  if (!result) return false;
  const { logradouro, bairro, localidade, uf } = result;
  const enderecoText = [logradouro, bairro].filter(Boolean).join(" - ");

  if (fields.cidade && (overwrite || !fields.cidade.value?.trim())) {
    fields.cidade.value = localidade;
  }
  if (fields.estado && (overwrite || !fields.estado.value?.trim())) {
    fields.estado.value = uf;
  }
  if (fields.endereco && (overwrite || !fields.endereco.value?.trim())) {
    fields.endereco.value = enderecoText;
  }
  return true;
}
