/** API Node: mesmo módulo que o browser carrega de /js (esta pasta não é servida). */
export {
  ANALISE_PELE_BUCKET,
  extractAnalisePeleObjectPath,
  isOwnedAnalisePelePath,
  collectOwnedAnalisePelePaths,
  sanitizePortalAnaliseRow,
  analisesPeleParaSkincare,
  conteudoAnamneseDaAnalise,
  publicSubmitAnaliseBody,
} from "../js/utils/analise-pele-storage.js";
