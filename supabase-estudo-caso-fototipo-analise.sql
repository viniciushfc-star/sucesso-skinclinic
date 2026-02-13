-- ============================================================
-- Estudo de caso: diferenciar tipo de pele, fototipo e análise de pele
-- Tipo de pele = classificação funcional (oleosa, mista, seca, etc.)
-- Fototipo = Fitzpatrick (I a VI) — reação ao sol
-- Análise de pele = resumo da avaliação (contexto); protocolo = procedimento aplicado
-- ============================================================

ALTER TABLE public.estudo_casos
  ADD COLUMN IF NOT EXISTS fototipo text,
  ADD COLUMN IF NOT EXISTS analise_pele_resumo text;

COMMENT ON COLUMN public.estudo_casos.tipo_pele IS 'Tipo de pele: oleosa, mista, seca, normal, sensível (classificação funcional).';
COMMENT ON COLUMN public.estudo_casos.fototipo IS 'Fototipo de Fitzpatrick: I a VI (reação ao sol, cor da pele).';
COMMENT ON COLUMN public.estudo_casos.analise_pele_resumo IS 'Resumo da análise de pele (avaliação); contexto diferente do protocolo aplicado.';
