/**
 * Antropometria e bioimpedância no módulo corporal da anamnese.
 * Cálculos: IMC, RCQ, Waist/Height ratio, classificação metabólica.
 */

/**
 * IMC = peso (kg) / altura² (m)
 */
export function calcIMC(pesoKg, alturaM) {
  if (!pesoKg || !alturaM || alturaM <= 0) return null;
  const imc = Number(pesoKg) / (Number(alturaM) ** 2);
  return Math.round(imc * 10) / 10;
}

/**
 * RCQ = circunferência da cintura (cm) / circunferência do quadril (cm)
 */
export function calcRCQ(cinturaCm, quadrilCm) {
  if (!cinturaCm || !quadrilCm || Number(quadrilCm) === 0) return null;
  const rcq = Number(cinturaCm) / Number(quadrilCm);
  return Math.round(rcq * 100) / 100;
}

/**
 * Waist-to-height ratio = cintura (cm) / altura (cm)
 */
export function calcWaistHeightRatio(cinturaCm, alturaCm) {
  if (!cinturaCm || !alturaCm || Number(alturaCm) === 0) return null;
  const ratio = Number(cinturaCm) / Number(alturaCm);
  return Math.round(ratio * 100) / 100;
}

/**
 * Classificação do IMC (OMS).
 */
export function classificacaoIMC(imc) {
  if (imc == null) return null;
  if (imc < 18.5) return { label: "Abaixo do peso", faixa: "baixo_peso" };
  if (imc < 25) return { label: "Peso normal", faixa: "normal" };
  if (imc < 30) return { label: "Sobrepeso", faixa: "sobrepeso" };
  if (imc < 35) return { label: "Obesidade I", faixa: "obesidade_i" };
  if (imc < 40) return { label: "Obesidade II", faixa: "obesidade_ii" };
  return { label: "Obesidade III", faixa: "obesidade_iii" };
}

/**
 * Classificação metabólica por RCQ (adultos – pontos de corte comuns).
 * Homem: alto ≥0,90; Mulher: alto ≥0,85.
 */
export function classificacaoRCQ(rcq, sexo) {
  if (rcq == null) return null;
  const limiar = (sexo || "").toLowerCase() === "m" || (sexo || "").toLowerCase() === "masculino" ? 0.9 : 0.85;
  const risco = rcq >= limiar ? "alto" : "normal";
  return { label: risco === "alto" ? "Risco metabólico aumentado (RCQ alto)" : "RCQ dentro do limite", risco };
}

/**
 * Waist/height: >0,5 sugere risco aumentado (comum para ambos os sexos).
 */
export function classificacaoWaistHeight(ratio) {
  if (ratio == null) return null;
  const risco = ratio > 0.5 ? "aumentado" : "normal";
  return { label: ratio > 0.5 ? "Risco aumentado (cintura/altura > 0,5)" : "Dentro do limite", risco };
}

/**
 * Monta objeto anthropometry com todos os cálculos a partir de medidas brutas.
 * Entrada: { peso_kg, altura_m, altura_cm?, cintura_cm, quadril_cm?, sexo? }
 * Saída: + imc, rcq, waist_height_ratio, classificacao_imc, classificacao_rcq, classificacao_waist_height, classificacao_metabolica (resumo).
 */
export function buildAnthropometry(raw) {
  if (!raw) return null;
  const peso = raw.peso_kg != null ? Number(raw.peso_kg) : null;
  const alturaM = raw.altura_m != null ? Number(raw.altura_m) : (raw.altura_cm != null ? Number(raw.altura_cm) / 100 : null);
  const alturaCm = alturaM != null ? alturaM * 100 : (raw.altura_cm != null ? Number(raw.altura_cm) : null);
  const cintura = raw.cintura_cm != null ? Number(raw.cintura_cm) : null;
  const quadril = raw.quadril_cm != null ? Number(raw.quadril_cm) : null;

  const imc = calcIMC(peso, alturaM);
  const rcq = calcRCQ(cintura, quadril);
  const waistHeight = calcWaistHeightRatio(cintura, alturaCm);

  const classificacao_imc = classificacaoIMC(imc);
  const classificacao_rcq = classificacaoRCQ(rcq, raw.sexo);
  const classificacao_waist_height = classificacaoWaistHeight(waistHeight);

  const classificacao_metabolica = [
    classificacao_imc?.label,
    classificacao_rcq?.label,
    classificacao_waist_height?.label
  ].filter(Boolean).join(" · ") || null;

  return {
    peso_kg: peso,
    altura_m: alturaM,
    altura_cm: alturaCm,
    cintura_cm: cintura,
    quadril_cm: quadril,
    sexo: raw.sexo || null,
    imc,
    rcq,
    waist_height_ratio: waistHeight,
    classificacao_imc,
    classificacao_rcq,
    classificacao_waist_height,
    classificacao_metabolica,
    bioimpedancia_raw: raw.bioimpedancia_raw || null
  };
}
