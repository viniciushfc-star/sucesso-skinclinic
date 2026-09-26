/**
 * Plano/pacote (o combinado) vs protocolo aplicado (o feito).
 * Mostra divergência; não altera preço nem trava o atendimento.
 */

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function nomesCompativeis(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

export function textoAplicado(a) {
  const nome = a?.protocolos?.nome || "";
  const desc = a?.descricao || "";
  return [nome, desc].filter((x) => String(x).trim()).join(" ");
}

export function nomePlanejado(p) {
  return String(p?.procedure_name || p?.nome_pacote || "").trim();
}

/**
 * @returns {{ temDivergencia: boolean, linhas: Array }}
 */
export function compararPlanoVsAplicado({ pacotes = [], aplicados = [] } = {}) {
  const linhas = [];
  for (const p of pacotes || []) {
    const nome = nomePlanejado(p);
    const used = Number(p.sessoes_utilizadas) || 0;
    if (used <= 0 || !nome) continue;
    const hit = (aplicados || []).some((a) => nomesCompativeis(nome, textoAplicado(a)));
    if (!hit) {
      linhas.push({
        tipo: "consumo_sem_aplicado",
        nome,
        justificativa: null,
        detalhe: `${used} sessão(ões) do pacote sem registro do que foi aplicado.`,
      });
    }
  }
  const comPlano = (pacotes || []).some((p) => nomePlanejado(p));
  if (comPlano) {
    for (const a of aplicados || []) {
      const t = textoAplicado(a);
      if (!t) continue;
      const hit = (pacotes || []).some((p) => nomesCompativeis(nomePlanejado(p), t));
      if (!hit) {
        const obs = String(a.observacao || "").trim();
        linhas.push({
          tipo: "aplicado_fora_do_plano",
          nome: t.slice(0, 80),
          justificativa: obs || null,
          detalhe: obs
            ? "Método diferente do pacote; a observação conta como justificativa."
            : "Registro que não bate com o pacote. Anote na observação se foi adaptação.",
        });
      }
    }
  }
  return { temDivergencia: linhas.length > 0, linhas };
}
