/**
 * Flags de funcionalidades — ative quando a negociação/integração estiver pronta.
 * Em standby: a tela existe no app mas não aparece no menu nem em Configurações.
 */

/** Pagamento pelo app (taxa melhor + ganho da operadora). Ative quando fechar negociação com a operadora. */
export const PAGAMENTO_APP_ENABLED = false;

/**
 * Contabilidade feita pelo SkinClinic (PGDAS, DCTF, e-Social, transmissão).
 * Hoje o Financeiro só organiza caixa + pasta do contador + estimativa.
 * Ligue quando houver responsável técnico e módulo de apuração oficial.
 */
export const CONTABILIDADE_INTERNA_ENABLED = false;
