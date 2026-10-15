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
    <radialGradient id="scFaceLight" cx="36%" cy="28%" r="62%">
      <stop offset="0%" stop-color="#fffaf4" stop-opacity=".55"/>
      <stop offset="100%" stop-color="#c4a990" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <path d="M100 18 C132 18 160 46 164 88 C168 124 160 156 144 180 C128 200 112 210 100 214 C88 210 72 200 56 180 C40 156 32 124 36 88 C40 46 68 18 100 18 Z" fill="url(#scFaceSkin)" stroke="#6f5d4e" stroke-width="1.35"/>
  <path d="M100 18 C132 18 160 46 164 88 C168 124 160 156 144 180 C128 200 112 210 100 214 C88 210 72 200 56 180 C40 156 32 124 36 88 C40 46 68 18 100 18 Z" fill="url(#scFaceLight)"/>
  <path d="M46 76 C62 36 138 36 154 76" fill="none" stroke="#8a7666" stroke-width="2.2" stroke-linecap="round" opacity=".55"/>
  <path d="M28 102 C22 88 28 72 40 78 C46 92 40 108 28 102 Z" fill="#ead9c6" stroke="#6f5d4e" stroke-width="1"/>
  <path d="M172 102 C178 88 172 72 160 78 C154 92 160 108 172 102 Z" fill="#ead9c6" stroke="#6f5d4e" stroke-width="1"/>
  <path d="M58 78 C70 72 82 74 88 80" fill="none" stroke="#5c4a3c" stroke-width="1.35" stroke-linecap="round"/>
  <path d="M142 78 C130 72 118 74 112 80" fill="none" stroke="#5c4a3c" stroke-width="1.35" stroke-linecap="round"/>
  <path d="M62 90 C66 86 78 86 82 91 C78 95 66 95 62 90 Z" fill="none" stroke="#5c4a3c" stroke-width="1.05"/>
  <path d="M138 90 C134 86 122 86 118 91 C122 95 134 95 138 90 Z" fill="none" stroke="#5c4a3c" stroke-width="1.05"/>
  <ellipse cx="72" cy="91" rx="2.1" ry="2.4" fill="#3f2f24"/>
  <ellipse cx="128" cy="91" rx="2.1" ry="2.4" fill="#3f2f24"/>
  <path d="M98 96 L100 124 L102 96" fill="none" stroke="#8a7666" stroke-width="1.05"/>
  <path d="M100 108 C96 118 96 126 100 128 C104 126 104 118 100 108 Z" fill="none" stroke="#8a7666" stroke-width="1"/>
  <path d="M92 126 C96 130 104 130 108 126" fill="none" stroke="#b08978" stroke-width=".8" opacity=".7"/>
  <path d="M86 146 C94 142 106 142 114 146 C108 154 92 154 86 146 Z" fill="none" stroke="#8a5a55" stroke-width="1.15"/>
  <path d="M90 148 C96 152 104 152 110 148" fill="none" stroke="#8a5a55" stroke-width=".7"/>
  <path d="M58 166 C78 182 122 182 142 166" fill="none" stroke="#8a7666" stroke-width="1.15"/>
  <path d="M78 196 C90 206 110 206 122 196 C114 208 86 208 78 196 Z" fill="url(#scFaceSkin)" stroke="#6f5d4e" stroke-width="1.15"/>
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

export const BARRIGA_SVG = `
<svg viewBox="0 0 200 268" class="anamnese-mapa-svg" aria-label="Corpo — ombros, abdômen, flancos e quadril">
  <defs>
    <linearGradient id="scBodySkin" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f6eee6"/>
      <stop offset="45%" stop-color="#ead9c6"/>
      <stop offset="100%" stop-color="#d8c0aa"/>
    </linearGradient>
  </defs>
  <path d="M92 10 C96 4 104 4 108 10 L116 28 C138 36 156 52 158 78 L154 118 C158 148 154 178 146 208 L138 242 C118 256 82 256 62 242 L54 208 C46 178 42 148 46 118 L42 78 C44 52 62 36 84 28 Z" fill="url(#scBodySkin)" stroke="#6f5d4e" stroke-width="1.35"/>
  <path d="M84 28 C70 42 62 58 64 78" fill="none" stroke="#8a7666" stroke-width=".9" opacity=".7"/>
  <path d="M116 28 C130 42 138 58 136 78" fill="none" stroke="#8a7666" stroke-width=".9" opacity=".7"/>
  <path d="M78 72 C88 82 112 82 122 72" fill="none" stroke="#b08978" stroke-width=".75" opacity=".55"/>
  <path d="M72 92 C82 108 92 112 100 108" fill="none" stroke="#c4a990" stroke-width=".7" opacity=".45"/>
  <path d="M128 92 C118 108 108 112 100 108" fill="none" stroke="#c4a990" stroke-width=".7" opacity=".45"/>
  <circle cx="100" cy="150" r="4.2" fill="none" stroke="#6f5d4e" stroke-width="1.05"/>
  <line x1="100" y1="86" x2="100" y2="236" stroke="#0f5c62" stroke-width=".55" stroke-dasharray="2.4 2.4" opacity=".28"/>
  <line x1="56" y1="150" x2="144" y2="150" stroke="#0f5c62" stroke-width=".55" stroke-dasharray="2.4 2.4" opacity=".28"/>
  <path d="M62 206 C78 218 122 218 138 206" fill="none" stroke="#8a7666" stroke-width=".85" opacity=".55"/>
  <g font-family="ui-sans-serif,system-ui,sans-serif" fill="#57534e">
    <text x="100" y="40" text-anchor="middle" font-size="7">Decote</text>
    <text x="100" y="108" text-anchor="middle" font-size="7.2">Epigástrio</text>
    <text x="100" y="138" text-anchor="middle" font-size="7.2">Abdômen</text>
    <text x="40" y="150" text-anchor="end" font-size="6.8">Flanco</text>
    <text x="160" y="150" font-size="6.8">Flanco</text>
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
  <path d="M78 18 C102 10 118 10 142 18 L160 44 C180 62 186 90 176 124 C166 156 148 174 140 184 C126 176 114 172 110 156 L110 48 C110 32 96 20 78 18 Z" fill="url(#scGluteSkin)" stroke="#6f5d4e" stroke-width="1.25"/>
  <path d="M142 18 C118 10 102 10 78 18 L60 44 C40 62 34 90 44 124 C54 156 72 174 80 184 C94 176 106 172 110 156 L110 48 C110 32 124 20 142 18 Z" fill="url(#scGluteSkin)" stroke="#6f5d4e" stroke-width="1.25"/>
  <path d="M110 48 L110 168" fill="none" stroke="#6f5d4e" stroke-width="1.2"/>
  <path d="M80 184 C94 194 110 196 110 172" fill="none" stroke="#8a7666" stroke-width=".9" opacity=".7"/>
  <path d="M140 184 C126 194 110 196 110 172" fill="none" stroke="#8a7666" stroke-width=".9" opacity=".7"/>
  <path d="M70 36 C88 48 96 72 94 110" fill="none" stroke="#0f5c62" stroke-width=".55" stroke-dasharray="2.4 2.4" opacity=".3"/>
  <path d="M150 36 C132 48 124 72 126 110" fill="none" stroke="#0f5c62" stroke-width=".55" stroke-dasharray="2.4 2.4" opacity=".3"/>
  <g font-family="ui-sans-serif,system-ui,sans-serif" fill="#57534e">
    <text x="78" y="26" text-anchor="middle" font-size="7.2">Superior E</text>
    <text x="142" y="26" text-anchor="middle" font-size="7.2">Superior D</text>
    <text x="26" y="96" text-anchor="end" font-size="6.8">Lateral</text>
    <text x="194" y="96" font-size="6.8">Lateral</text>
    <text x="78" y="196" text-anchor="middle" font-size="7.2">Inferior E</text>
    <text x="142" y="196" text-anchor="middle" font-size="7.2">Inferior D</text>
  </g>
  <text x="110" y="208" text-anchor="middle" font-size="7.5" fill="#0f5c62" font-family="ui-sans-serif,system-ui,sans-serif">Clique na área para marcar</text>
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
