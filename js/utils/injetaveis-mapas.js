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
  <ellipse cx="100" cy="108" rx="72" ry="92" fill="#fde7d6" stroke="#c4b5a5" stroke-width="1.6"/>
  <path d="M40 78 Q100 18 160 78" fill="none" stroke="#d6c4b4" stroke-width="6" stroke-linecap="round"/>
  <path d="M48 70 Q100 42 152 70" fill="none" stroke="#e8d5c6" stroke-width="10" opacity=".45"/>
  <ellipse cx="72" cy="92" rx="11" ry="7" fill="#fff" stroke="#8b7355" stroke-width="1.1"/>
  <ellipse cx="128" cy="92" rx="11" ry="7" fill="#fff" stroke="#8b7355" stroke-width="1.1"/>
  <circle cx="72" cy="92" r="3.2" fill="#4a3728"/>
  <circle cx="128" cy="92" r="3.2" fill="#4a3728"/>
  <path d="M88 90 Q100 96 112 90" fill="none" stroke="#c4a484" stroke-width="1.2"/>
  <path d="M96 108 L100 128 L104 108" fill="none" stroke="#c4a484" stroke-width="1.1"/>
  <ellipse cx="100" cy="118" rx="7" ry="10" fill="none" stroke="#c4a484" stroke-width="1"/>
  <path d="M86 148 Q100 158 114 148" fill="#c97b7b" stroke="#a85a5a" stroke-width="1"/>
  <path d="M58 168 Q100 188 142 168" fill="none" stroke="#c4a484" stroke-width="1.3"/>
  <path d="M72 198 Q100 212 128 198" fill="#fde7d6" stroke="#c4b5a5" stroke-width="1.2"/>
`;

const FACE_LABELS = `
  <ellipse cx="100" cy="52" rx="38" ry="16" fill="none" stroke="#c4b5fd" stroke-width="0.7" stroke-dasharray="2 2" opacity=".7"/>
  <ellipse cx="100" cy="74" rx="14" ry="8" fill="none" stroke="#c4b5fd" stroke-width="0.7" stroke-dasharray="2 2" opacity=".7"/>
  <ellipse cx="58" cy="92" rx="16" ry="10" fill="none" stroke="#c4b5fd" stroke-width="0.7" stroke-dasharray="2 2" opacity=".7"/>
  <ellipse cx="142" cy="92" rx="16" ry="10" fill="none" stroke="#c4b5fd" stroke-width="0.7" stroke-dasharray="2 2" opacity=".7"/>
  <ellipse cx="58" cy="128" rx="18" ry="14" fill="none" stroke="#c4b5fd" stroke-width="0.7" stroke-dasharray="2 2" opacity=".7"/>
  <ellipse cx="142" cy="128" rx="18" ry="14" fill="none" stroke="#c4b5fd" stroke-width="0.7" stroke-dasharray="2 2" opacity=".7"/>
  <ellipse cx="100" cy="148" rx="18" ry="10" fill="none" stroke="#c4b5fd" stroke-width="0.7" stroke-dasharray="2 2" opacity=".7"/>
  <path d="M52 160 Q58 178 72 190" fill="none" stroke="#c4b5fd" stroke-width="0.7" stroke-dasharray="2 2" opacity=".7"/>
  <path d="M148 160 Q142 178 128 190" fill="none" stroke="#c4b5fd" stroke-width="0.7" stroke-dasharray="2 2" opacity=".7"/>
  <ellipse cx="100" cy="178" rx="14" ry="8" fill="none" stroke="#c4b5fd" stroke-width="0.7" stroke-dasharray="2 2" opacity=".7"/>
  <text x="100" y="38" text-anchor="middle" font-size="7.5" fill="#64748b">Testa</text>
  <text x="100" y="68" text-anchor="middle" font-size="6.5" fill="#64748b">Glabela</text>
  <text x="42" y="92" text-anchor="end" font-size="6.5" fill="#64748b">Pés de galinha</text>
  <text x="158" y="92" font-size="6.5" fill="#64748b">Pés de galinha</text>
  <text x="38" y="128" text-anchor="end" font-size="6.5" fill="#64748b">Malar</text>
  <text x="162" y="128" font-size="6.5" fill="#64748b">Malar</text>
  <text x="100" y="142" text-anchor="middle" font-size="6.5" fill="#64748b">Lábios</text>
  <text x="38" y="168" text-anchor="end" font-size="6.5" fill="#64748b">Mandíbula</text>
  <text x="162" y="168" font-size="6.5" fill="#64748b">Mandíbula</text>
  <text x="100" y="186" text-anchor="middle" font-size="6.5" fill="#64748b">Queixo</text>
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
  <text x="100" y="238" text-anchor="middle" font-size="8" fill="#4e54c8">Clique na área para marcar o ponto</text>
</svg>
`;

export const BARRIGA_SVG = `
<svg viewBox="0 0 200 268" class="anamnese-mapa-svg" aria-label="Corpo — ombros, abdômen, flancos e quadril">
  <path d="M78 18 Q88 8 100 8 Q112 8 122 18 L138 48 Q152 62 154 88 L150 128 Q154 168 146 200 L138 238 Q100 258 62 238 L54 200 Q46 168 50 128 L46 88 Q48 62 62 48 Z" fill="#fde7d6" stroke="#c4b5a5" stroke-width="1.6"/>
  <ellipse cx="72" cy="58" rx="18" ry="12" fill="#f8dcc8" stroke="#d6c4b4" stroke-width="0.8" opacity=".7"/>
  <ellipse cx="128" cy="58" rx="18" ry="12" fill="#f8dcc8" stroke="#d6c4b4" stroke-width="0.8" opacity=".7"/>
  <circle cx="100" cy="148" r="5.5" fill="none" stroke="#c4a484" stroke-width="1.2"/>
  <line x1="100" y1="78" x2="100" y2="232" stroke="#e8d5c6" stroke-width="1" stroke-dasharray="3 3"/>
  <line x1="58" y1="148" x2="142" y2="148" stroke="#e8d5c6" stroke-width="1" stroke-dasharray="3 3"/>
  <text x="100" y="38" text-anchor="middle" font-size="7" fill="#64748b">Decote</text>
  <text x="100" y="108" text-anchor="middle" font-size="7.5" fill="#64748b">Epigástrio</text>
  <text x="100" y="138" text-anchor="middle" font-size="7.5" fill="#64748b">Abdômen</text>
  <text x="42" y="148" text-anchor="end" font-size="7" fill="#64748b">Flanco</text>
  <text x="158" y="148" font-size="7" fill="#64748b">Flanco</text>
  <text x="100" y="188" text-anchor="middle" font-size="7.5" fill="#64748b">Infraumbilical</text>
  <text x="100" y="222" text-anchor="middle" font-size="7" fill="#64748b">Quadril</text>
  <text x="100" y="262" text-anchor="middle" font-size="8" fill="#4e54c8">Clique na região para marcar</text>
</svg>
`;

export const GLUTEOS_SVG = `
<svg viewBox="0 0 220 210" class="anamnese-mapa-svg" aria-label="Glúteos — áreas de aplicação">
  <ellipse cx="78" cy="88" rx="48" ry="62" fill="#fde7d6" stroke="#c4b5a5" stroke-width="1.6"/>
  <ellipse cx="142" cy="88" rx="48" ry="62" fill="#fde7d6" stroke="#c4b5a5" stroke-width="1.6"/>
  <path d="M78 148 Q110 138 142 148" fill="none" stroke="#d6c4b4" stroke-width="1.2"/>
  <line x1="78" y1="40" x2="78" y2="148" stroke="#e8d5c6" stroke-width="1" stroke-dasharray="3 3"/>
  <line x1="142" y1="40" x2="142" y2="148" stroke="#e8d5c6" stroke-width="1" stroke-dasharray="3 3"/>
  <text x="78" y="28" text-anchor="middle" font-size="7.5" fill="#64748b">Superior E</text>
  <text x="142" y="28" text-anchor="middle" font-size="7.5" fill="#64748b">Superior D</text>
  <text x="28" y="92" text-anchor="end" font-size="7" fill="#64748b">Lateral</text>
  <text x="192" y="92" font-size="7" fill="#64748b">Lateral</text>
  <text x="78" y="168" text-anchor="middle" font-size="7.5" fill="#64748b">Inferior E</text>
  <text x="142" y="168" text-anchor="middle" font-size="7.5" fill="#64748b">Inferior D</text>
  <text x="110" y="198" text-anchor="middle" font-size="8" fill="#4e54c8">Clique na área para marcar</text>
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
