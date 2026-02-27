/**
 * SVGs e rótulos para mapa de injetáveis (rosto, barriga, glúteos).
 * Usado na anamnese (edição) e no perfil do cliente (visualização ampliada).
 */

export const PRODUTOS_APLICACAO = [
  { id: "botox", label: "Toxina botulínica (Botox)", unidade: "UI" },
  { id: "bioestimulador", label: "Bioestimulador", unidade: "UI" },
  { id: "preenchimento", label: "Preenchimento (AH)", unidade: "ml" },
  { id: "outro", label: "Outro", unidade: "un" }
];

/** SVG rosto (vista frontal) — sem texto de instrução para uso em visualização */
export const FACE_SVG = `
<svg viewBox="0 0 200 260" class="anamnese-mapa-svg" aria-label="Rosto">
  <ellipse cx="100" cy="100" rx="75" ry="95" fill="#fefce8" stroke="#cbd5e1" stroke-width="1.5"/>
  <ellipse cx="70" cy="85" rx="12" ry="14" fill="none" stroke="#94a3b8" stroke-width="1"/>
  <ellipse cx="130" cy="85" rx="12" ry="14" fill="none" stroke="#94a3b8" stroke-width="1"/>
  <path d="M 65 130 Q 100 150 135 130" fill="none" stroke="#94a3b8" stroke-width="1"/>
  <ellipse cx="100" cy="165" rx="15" ry="18" fill="none" stroke="#94a3b8" stroke-width="1"/>
</svg>
`;

export const FACE_SVG_EDIT = `
<svg viewBox="0 0 200 260" class="anamnese-mapa-svg" aria-label="Rosto: clique para marcar ponto de aplicação">
  <ellipse cx="100" cy="100" rx="75" ry="95" fill="#fefce8" stroke="#cbd5e1" stroke-width="1.5"/>
  <ellipse cx="70" cy="85" rx="12" ry="14" fill="none" stroke="#94a3b8" stroke-width="1"/>
  <ellipse cx="130" cy="85" rx="12" ry="14" fill="none" stroke="#94a3b8" stroke-width="1"/>
  <path d="M 65 130 Q 100 150 135 130" fill="none" stroke="#94a3b8" stroke-width="1"/>
  <ellipse cx="100" cy="165" rx="15" ry="18" fill="none" stroke="#94a3b8" stroke-width="1"/>
  <text x="100" y="235" text-anchor="middle" font-size="9" fill="#64748b">Clique no rosto para adicionar ponto</text>
</svg>
`;

export const BARRIGA_SVG = `
<svg viewBox="0 0 180 220" class="anamnese-mapa-svg" aria-label="Barriga">
  <ellipse cx="90" cy="70" rx="55" ry="25" fill="none" stroke="#cbd5e1" stroke-width="1.5"/>
  <path d="M 35 70 Q 90 180 145 70" fill="#fefce8" stroke="#cbd5e1" stroke-width="1.5"/>
</svg>
`;

export const GLUTEOS_SVG = `
<svg viewBox="0 0 200 180" class="anamnese-mapa-svg" aria-label="Glúteos">
  <ellipse cx="65" cy="75" rx="45" ry="55" fill="#fefce8" stroke="#cbd5e1" stroke-width="1.5"/>
  <ellipse cx="135" cy="75" rx="45" ry="55" fill="#fefce8" stroke="#cbd5e1" stroke-width="1.5"/>
</svg>
`;

export const MAPAS = [
  { id: "rosto", label: "Rosto", svg: FACE_SVG },
  { id: "barriga", label: "Barriga", svg: BARRIGA_SVG },
  { id: "gluteos", label: "Glúteos", svg: GLUTEOS_SVG }
];
