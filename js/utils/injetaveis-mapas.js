/**
 * SVGs e rótulos para mapa de injetáveis (rosto, corpo, glúteos).
 * Usado na anamnese (edição) e no perfil do cliente (visualização).
 */

export const PRODUTOS_APLICACAO = [
  { id: "botox", label: "Toxina botulínica (Botox)", unidade: "UI" },
  { id: "bioestimulador", label: "Bioestimulador", unidade: "UI" },
  { id: "preenchimento", label: "Preenchimento (AH)", unidade: "ml" },
  { id: "outro", label: "Outro", unidade: "un" },
];

const FACE_DRAW = `
  <defs>
    <linearGradient id="scFaceSkin" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f6eee6"/>
      <stop offset="48%" stop-color="#ead9c6"/>
      <stop offset="100%" stop-color="#dcc4ad"/>
    </linearGradient>
  </defs>
  <image href="/img/mapas/rosto-frente.jpg" x="0" y="0" width="200" height="226" preserveAspectRatio="xMidYMid slice"/>
`;

const FACE_LABELS = `
  <g fill="none" stroke="#0f5c62" stroke-width="0.65" stroke-dasharray="2.2 2" opacity=".42">
    <ellipse cx="100" cy="52" rx="38" ry="16"/>
    <ellipse cx="100" cy="74" rx="14" ry="8"/>
    <ellipse cx="58" cy="92" rx="16" ry="10"/>
    <ellipse cx="142" cy="92" rx="16" ry="10"/>
    <ellipse cx="58" cy="128" rx="18" ry="14"/>
    <ellipse cx="142" cy="128" rx="18" ry="14"/>
    <ellipse cx="100" cy="148" rx="18" ry="10"/>
    <path d="M52 160 Q58 178 72 190"/>
    <path d="M148 160 Q142 178 128 190"/>
    <ellipse cx="100" cy="178" rx="14" ry="8"/>
  </g>
  <g font-family="ui-sans-serif,system-ui,sans-serif" fill="#57534e">
    <text x="100" y="38" text-anchor="middle" font-size="7.2">Testa</text>
    <text x="100" y="68" text-anchor="middle" font-size="6.2">Glabela</text>
    <text x="40" y="92" text-anchor="end" font-size="6.2">Pés de galinha</text>
    <text x="160" y="92" font-size="6.2">Pés de galinha</text>
    <text x="36" y="128" text-anchor="end" font-size="6.2">Malar</text>
    <text x="164" y="128" font-size="6.2">Malar</text>
    <text x="100" y="141" text-anchor="middle" font-size="6.2">Lábios</text>
    <text x="36" y="168" text-anchor="end" font-size="6.2">Mandíbula</text>
    <text x="164" y="168" font-size="6.2">Mandíbula</text>
    <text x="100" y="186" text-anchor="middle" font-size="6.2">Queixo</text>
  </g>
`;

export const FACE_SVG = `
<svg viewBox="0 0 200 230" class="anamnese-mapa-svg" aria-label="Rosto — áreas de aplicação">
  ${FACE_DRAW}
  ${FACE_LABELS}
</svg>
`;

export const FACE_SVG_EDIT = `
<svg viewBox="0 0 200 246" class="anamnese-mapa-svg" aria-label="Rosto: clique na área de aplicação">
  ${FACE_DRAW}
  ${FACE_LABELS}
  <text x="100" y="238" text-anchor="middle" font-size="7.5" fill="#0f5c62" font-family="ui-sans-serif,system-ui,sans-serif">Clique na área para marcar o ponto</text>
</svg>
`;

export const FACE_TQ_SVG = `
<svg viewBox="0 0 200 230" class="anamnese-mapa-svg" aria-label="Rosto em 3/4 — áreas de aplicação">
  <defs>
    <linearGradient id="scFaceTqSkin" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f7f0e8"/>
      <stop offset="100%" stop-color="#d4baa3"/>
    </linearGradient>
  </defs>
  <image href="/img/mapas/rosto-tres-quartos.jpg" x="0" y="0" width="200" height="226" preserveAspectRatio="xMidYMid slice"/>
  <g fill="none" stroke="#0f5c62" stroke-width="0.65" stroke-dasharray="2.2 2" opacity=".5">
    <ellipse cx="108" cy="52" rx="28" ry="14"/>
    <ellipse cx="92" cy="96" rx="14" ry="10"/>
    <ellipse cx="78" cy="128" rx="16" ry="12"/>
    <ellipse cx="108" cy="148" rx="16" ry="9"/>
    <ellipse cx="108" cy="176" rx="12" ry="7"/>
  </g>
  <g font-family="ui-sans-serif,system-ui,sans-serif" fill="#0f5c62">
    <text x="108" y="34" text-anchor="middle" font-size="7">Testa</text>
    <text x="40" y="98" text-anchor="end" font-size="6.2">Orbicular</text>
    <text x="40" y="132" text-anchor="end" font-size="6.2">Malar</text>
    <text x="108" y="142" text-anchor="middle" font-size="6.2">Lábios</text>
    <text x="108" y="190" text-anchor="middle" font-size="6.2">Queixo</text>
  </g>
</svg>
`;

export const FACE_PROFILE_SVG = `
<svg viewBox="0 0 200 230" class="anamnese-mapa-svg" aria-label="Rosto em perfil — áreas de aplicação">
  <defs>
    <linearGradient id="scFaceProfSkin" x1="0.2" y1="0" x2="0.9" y2="1">
      <stop offset="0%" stop-color="#f7f0e8"/>
      <stop offset="100%" stop-color="#d0b69e"/>
    </linearGradient>
  </defs>
  <image href="/img/mapas/rosto-perfil.jpg" x="0" y="0" width="200" height="226" preserveAspectRatio="xMidYMid slice"/>
  <g fill="none" stroke="#0f5c62" stroke-width="0.65" stroke-dasharray="2.2 2" opacity=".5">
    <ellipse cx="108" cy="48" rx="20" ry="14"/>
    <ellipse cx="138" cy="100" rx="14" ry="10"/>
    <ellipse cx="132" cy="148" rx="12" ry="11"/>
    <ellipse cx="108" cy="178" rx="16" ry="12"/>
  </g>
  <g font-family="ui-sans-serif,system-ui,sans-serif" fill="#0f5c62">
    <text x="108" y="30" text-anchor="middle" font-size="7">Testa</text>
    <text x="172" y="102" font-size="6.2">Nariz</text>
    <text x="168" y="150" font-size="6.2">Lábios</text>
    <text x="108" y="198" text-anchor="middle" font-size="6.2">Queixo</text>
  </g>
</svg>
`;

export const BARRIGA_SVG = `
<svg viewBox="0 0 200 268" class="anamnese-mapa-svg" aria-label="Corpo — ombros, abdômen, flancos e quadril">
  <defs>
    <linearGradient id="scBodySkin" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f6eee6"/>
      <stop offset="45%" stop-color="#ead9c6"/>
      <stop offset="100%" stop-color="#d8c0aa"/>
    </linearGradient>
  </defs>
  <image href="/img/mapas/corpo-frente.jpg" x="0" y="0" width="200" height="252" preserveAspectRatio="xMidYMid slice"/>
  <g font-family="ui-sans-serif,system-ui,sans-serif" fill="#0f5c62">
    <text x="100" y="58" text-anchor="middle" font-size="7">Decote</text>
    <text x="100" y="108" text-anchor="middle" font-size="7.2">Epigástrio</text>
    <text x="100" y="138" text-anchor="middle" font-size="7.2">Abdômen</text>
    <text x="28" y="150" text-anchor="end" font-size="6.8">Flanco</text>
    <text x="172" y="150" font-size="6.8">Flanco</text>
    <text x="100" y="188" text-anchor="middle" font-size="7.2">Infraumbilical</text>
    <text x="100" y="226" text-anchor="middle" font-size="7">Quadril</text>
  </g>
  <text x="100" y="262" text-anchor="middle" font-size="7.5" fill="#0f5c62" font-family="ui-sans-serif,system-ui,sans-serif">Clique na região para marcar</text>
</svg>
`;

export const GLUTEOS_SVG = `
<svg viewBox="0 0 220 210" class="anamnese-mapa-svg" aria-label="Glúteos — áreas de aplicação">
  <defs>
    <linearGradient id="scGluteSkin" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f6eee6"/>
      <stop offset="50%" stop-color="#ead9c6"/>
      <stop offset="100%" stop-color="#d4baa4"/>
    </linearGradient>
  </defs>
  <image href="/img/mapas/gluteos.jpg" x="0" y="0" width="220" height="196" preserveAspectRatio="xMidYMid slice"/>
  <g font-family="ui-sans-serif,system-ui,sans-serif" fill="#0f5c62">
    <text x="78" y="18" text-anchor="middle" font-size="7.2">Superior E</text>
    <text x="142" y="18" text-anchor="middle" font-size="7.2">Superior D</text>
    <text x="18" y="96" text-anchor="end" font-size="6.8">Lateral</text>
    <text x="202" y="96" font-size="6.8">Lateral</text>
    <text x="78" y="188" text-anchor="middle" font-size="7.2">Inferior E</text>
    <text x="142" y="188" text-anchor="middle" font-size="7.2">Inferior D</text>
  </g>
  <text x="110" y="208" text-anchor="middle" font-size="7.5" fill="#0f5c62" font-family="ui-sans-serif,system-ui,sans-serif">Clique na área para marcar</text>
</svg>
`;

export const BODY_BACK_SVG = `
<svg viewBox="0 0 200 268" class="anamnese-mapa-svg" aria-label="Corpo — costas, dorso e glúteos">
  <defs>
    <linearGradient id="scBodyBackSkin" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f6eee6"/>
      <stop offset="45%" stop-color="#ead9c6"/>
      <stop offset="100%" stop-color="#d4baa4"/>
    </linearGradient>
  </defs>
  <image href="/img/mapas/corpo-costas.jpg" x="0" y="0" width="200" height="260" preserveAspectRatio="xMidYMid slice"/>
  <g font-family="ui-sans-serif,system-ui,sans-serif" fill="#0f5c62">
    <text x="100" y="56" text-anchor="middle" font-size="7">Ombros</text>
    <text x="100" y="108" text-anchor="middle" font-size="7.2">Dorso</text>
    <text x="28" y="150" text-anchor="end" font-size="6.8">Flanco</text>
    <text x="172" y="150" font-size="6.8">Flanco</text>
    <text x="100" y="198" text-anchor="middle" font-size="7.2">Lombar</text>
    <text x="100" y="232" text-anchor="middle" font-size="7">Glúteos</text>
  </g>
</svg>
`;

export const MAPAS = [
  { id: "rosto", label: "Rosto", svg: FACE_SVG },
  { id: "barriga", label: "Corpo", svg: BARRIGA_SVG },
  { id: "gluteos", label: "Glúteos", svg: GLUTEOS_SVG },
];

export const MAPAS_EDIT = [
  { id: "rosto", label: "Rosto", svg: FACE_SVG_EDIT },
  { id: "barriga", label: "Corpo", svg: BARRIGA_SVG },
  { id: "gluteos", label: "Glúteos", svg: GLUTEOS_SVG },
];

export function pontoStatus(p) {
  return p && p.status === "planejado" ? "planejado" : "aplicado";
}

export function vistasDoMapa(mapa) {
  if (mapa === "rosto") {
    return [
      { id: "frente", label: "Frente" },
      { id: "tres_quartos", label: "3/4" },
      { id: "perfil", label: "Perfil" },
    ];
  }
  if (mapa === "barriga") {
    return [
      { id: "frente", label: "Frente" },
      { id: "costas", label: "Costas" },
    ];
  }
  return [{ id: "costas", label: "Costas" }];
}

export function vistaPadraoDoMapa(mapa) {
  return mapa === "gluteos" ? "costas" : "frente";
}

export function labelVista(id) {
  if (id === "tres_quartos") return "3/4";
  if (id === "perfil") return "Perfil";
  if (id === "costas") return "Costas";
  return "Frente";
}

export function vistaDoPonto(p, mapa) {
  const v = p && String(p.vista || "").trim();
  if (v) return v;
  return vistaPadraoDoMapa(mapa || p?.mapa);
}

export function svgDoMapa(mapa, vista, { edit = false } = {}) {
  if (mapa === "rosto") {
    if (vista === "perfil") return FACE_PROFILE_SVG;
    if (vista === "tres_quartos") return FACE_TQ_SVG;
    return edit ? FACE_SVG_EDIT : FACE_SVG;
  }
  if (mapa === "barriga") {
    if (vista === "costas") return BODY_BACK_SVG;
    return BARRIGA_SVG;
  }
  return GLUTEOS_SVG;
}
