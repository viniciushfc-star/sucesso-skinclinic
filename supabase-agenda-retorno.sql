-- ============================================================
-- AGENDA: retorno (consulta de retorno que não gera receita)
-- Ex.: retorno de botox; não entra no faturamento previsto do dia.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agenda' AND column_name = 'is_retorno'
  ) THEN
    ALTER TABLE public.agenda
      ADD COLUMN is_retorno boolean NOT NULL DEFAULT false;
  END IF;
END $$;

COMMENT ON COLUMN public.agenda.is_retorno IS 'Se true, é retorno (ex.: pós-botox); não gera receita no faturamento previsto.';
